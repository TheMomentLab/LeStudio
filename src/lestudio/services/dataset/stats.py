from __future__ import annotations

import hashlib
import json
import threading
import time
import uuid
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from ... import path_policy
from ...lib.async_job_manager import TERMINAL_JOB_STATUS, _cleanup_finished_jobs
from ...routes._state import DatasetJobState
from .listing import discover_parquet_files


def compute_stats_signature(source_path: Path, info_path: Path, pq_files: list[Path]) -> str:
    h = hashlib.sha256()
    info_stat = info_path.stat()
    h.update(f"info:{info_stat.st_mtime_ns}:{info_stat.st_size}".encode())
    h.update(f"pq_count:{len(pq_files)}".encode())
    for p in pq_files:
        try:
            ps = p.stat()
            rel = p.relative_to(source_path)
            h.update(f"{rel}:{ps.st_mtime_ns}:{ps.st_size}".encode())
        except Exception:
            h.update(str(p).encode("utf-8"))
    return h.hexdigest()


def _build_dataset_summary(episode_stats: list[dict[str, Any]], np_mod) -> dict[str, Any]:
    def _pct(vals: Sequence[int | float], p: int) -> float:
        arr = np_mod.array(vals, dtype=float)
        return round(float(np_mod.percentile(arr, p)), 4) if len(arr) else 0.0

    frames_vals = [int(e.get("frames", 0)) for e in episode_stats]
    move_vals = [float(e.get("movement", 0.0)) for e in episode_stats]
    jerk_vals = [float(e.get("jerk_score", 0.0)) for e in episode_stats]
    jerk_ratio_vals = [float(e.get("jerk_ratio", 0.0)) for e in episode_stats]

    if not episode_stats:
        return {
            "frames": {"min": 0, "max": 0, "p25": 0.0, "p75": 0.0, "median": 0.0},
            "movement": {"min": 0.0, "max": 0.0, "p25": 0.0, "p75": 0.0, "median": 0.0},
            "jerk_score": {"min": 0.0, "max": 0.0, "p25": 0.0, "p75": 0.0, "median": 0.0},
            "jerk_ratio": {"min": 0.0, "max": 0.0, "p25": 0.0, "p75": 0.0, "median": 0.0},
        }

    return {
        "frames": {
            "min": min(frames_vals),
            "max": max(frames_vals),
            "p25": _pct(frames_vals, 25),
            "p75": _pct(frames_vals, 75),
            "median": _pct(frames_vals, 50),
        },
        "movement": {
            "min": round(min(move_vals), 4),
            "max": round(max(move_vals), 4),
            "p25": _pct(move_vals, 25),
            "p75": _pct(move_vals, 75),
            "median": _pct(move_vals, 50),
        },
        "jerk_score": {
            "min": round(min(jerk_vals), 4),
            "max": round(max(jerk_vals), 4),
            "p25": _pct(jerk_vals, 25),
            "p75": _pct(jerk_vals, 75),
            "median": _pct(jerk_vals, 50),
        },
        "jerk_ratio": {
            "min": round(min(jerk_ratio_vals), 4),
            "max": round(max(jerk_ratio_vals), 4),
            "p25": _pct(jerk_ratio_vals, 25),
            "p75": _pct(jerk_ratio_vals, 75),
            "median": _pct(jerk_ratio_vals, 50),
        },
    }


def compute_episode_stats(
    source_path: Path,
    cancel_event: threading.Event | None = None,
    progress_cb=None,
) -> dict[str, Any]:
    pd = __import__("pandas")
    np = __import__("numpy")

    pq_files = discover_parquet_files(source_path)
    if not pq_files:
        raise FileNotFoundError("No parquet files found")

    states: dict[int, dict[str, Any]] = {}
    total_files = len(pq_files)

    for file_idx, pq_path in enumerate(pq_files, start=1):
        if cancel_event and cancel_event.is_set():
            raise RuntimeError("cancelled")

        df = pd.read_parquet(
            pq_path,
            columns=["action", "timestamp", "frame_index", "episode_index"],
        )

        if len(df) == 0:
            if progress_cb:
                progress_cb(file_idx, total_files)
            continue

        for ep_idx, group in df.groupby("episode_index"):
            try:
                ep_key = int(ep_idx)
            except Exception:
                continue

            st = states.get(ep_key)
            if st is None:
                st = {
                    "frames": 0,
                    "min_ts": None,
                    "max_ts": None,
                    "movement_sum": 0.0,
                    "movement_count": 0,
                    "jerk_sum": 0.0,
                    "jerk_count": 0,
                    "max_jerk": 0.0,
                    "prev_action": None,
                    "prev_vel": None,
                }
                states[ep_key] = st

            ordered = group.sort_values("frame_index")
            for row in ordered.itertuples(index=False):
                if cancel_event and cancel_event.is_set():
                    raise RuntimeError("cancelled")

                st["frames"] = int(st.get("frames", 0) or 0) + 1

                ts = getattr(row, "timestamp", None)
                if ts is not None and not pd.isna(ts):
                    ts_val = float(ts)
                    if st["min_ts"] is None or ts_val < st["min_ts"]:
                        st["min_ts"] = ts_val
                    if st["max_ts"] is None or ts_val > st["max_ts"]:
                        st["max_ts"] = ts_val

                action_raw = getattr(row, "action", None)
                action = None
                if action_raw is not None:
                    try:
                        action = np.asarray(action_raw, dtype=float).reshape(-1)
                        if action.size == 0:
                            action = None
                    except Exception:
                        action = None

                if action is None:
                    continue

                prev_action = st.get("prev_action")
                if prev_action is not None and getattr(prev_action, "shape", None) == action.shape:
                    vel = action - prev_action
                    vel_norm = float(np.linalg.norm(vel))
                    st["movement_sum"] = float(st.get("movement_sum", 0.0) or 0.0) + vel_norm
                    st["movement_count"] = int(st.get("movement_count", 0) or 0) + 1

                    prev_vel = st.get("prev_vel")
                    if prev_vel is not None and getattr(prev_vel, "shape", None) == vel.shape:
                        jerk = vel - prev_vel
                        jerk_norm = float(np.linalg.norm(jerk))
                        st["jerk_sum"] = float(st.get("jerk_sum", 0.0) or 0.0) + jerk_norm
                        st["jerk_count"] = int(st.get("jerk_count", 0) or 0) + 1
                        if jerk_norm > float(st.get("max_jerk", 0.0) or 0.0):
                            st["max_jerk"] = jerk_norm
                    st["prev_vel"] = vel
                else:
                    st["prev_vel"] = None

                st["prev_action"] = action

        if progress_cb:
            progress_cb(file_idx, total_files)

    episode_stats: list[dict[str, Any]] = []
    for ep_idx in sorted(states.keys()):
        st = states[ep_idx]
        n_frames = int(st["frames"])
        min_ts = st["min_ts"]
        max_ts = st["max_ts"]
        duration_s = float(max_ts - min_ts) if min_ts is not None and max_ts is not None and n_frames > 1 else 0.0

        movement = float(st["movement_sum"] / st["movement_count"]) if st["movement_count"] > 0 else 0.0
        jerk_score = float(st["jerk_sum"] / st["jerk_count"]) if st["jerk_count"] > 0 else 0.0
        max_jerk = float(st["max_jerk"])
        jerk_ratio = float(jerk_score / max(1e-6, movement)) if movement > 0 else 0.0

        episode_stats.append(
            {
                "episode_index": ep_idx,
                "frames": n_frames,
                "duration_s": round(duration_s, 3),
                "movement": round(movement, 4),
                "jerk_score": round(jerk_score, 4),
                "max_jerk": round(max_jerk, 4),
                "jerk_ratio": round(jerk_ratio, 4),
            }
        )

    return {
        "episodes": episode_stats,
        "dataset_summary": _build_dataset_summary(episode_stats, np),
        "computed_at": time.time(),
        "episode_count": len(episode_stats),
    }


def get_episode_stats(user: str, repo: str) -> dict[str, Any]:
    source_path = path_policy.dataset_local_dir(f"{user}/{repo}")
    info_path = source_path / "meta" / "info.json"
    if not info_path.exists():
        return {"ok": False, "status_code": 404, "error": "Dataset not found locally"}

    pq_files = discover_parquet_files(source_path)
    if not pq_files:
        return {"ok": False, "status_code": 404, "error": "No parquet files found"}

    cache_file = source_path / ".lestudio_ep_stats.json"
    signature = compute_stats_signature(source_path, info_path, pq_files)
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text())
            if cached.get("cache_signature") == signature:
                return {
                    "ok": True,
                    "cached": True,
                    **{k: v for k, v in cached.items() if k != "cache_signature"},
                }
        except Exception:
            pass

    try:
        result = compute_episode_stats(source_path)
    except Exception as exc:
        return {"ok": False, "status_code": 500, "error": f"Failed to compute stats: {exc}"}

    payload = {"cache_signature": signature, **result}
    try:
        cache_file.write_text(json.dumps(payload))
    except Exception:
        pass

    return {"ok": True, "cached": False, **result}


def _cleanup_runtime_refs(jobs_state: DatasetJobState) -> None:
    with jobs_state.derive_jobs_lock:
        derive_status = {jid: str(job.get("status", "")) for jid, job in jobs_state.derive_jobs.items()}
    with jobs_state.derive_procs_lock:
        stale_proc_ids = [
            jid
            for jid in jobs_state.derive_procs.keys()
            if jid not in derive_status or derive_status.get(jid) in TERMINAL_JOB_STATUS
        ]
        for jid in stale_proc_ids:
            jobs_state.derive_procs.pop(jid, None)

    with jobs_state.stats_jobs_lock:
        stats_status = {jid: str(job.get("status", "")) for jid, job in jobs_state.stats_jobs.items()}
    with jobs_state.stats_cancel_lock:
        stale_cancel_ids = [
            jid
            for jid in jobs_state.stats_cancel_events.keys()
            if jid not in stats_status or stats_status.get(jid) in TERMINAL_JOB_STATUS
        ]
        for jid in stale_cancel_ids:
            jobs_state.stats_cancel_events.pop(jid, None)


def start_episode_stats_recompute_job(
    jobs_state: DatasetJobState,
    user: str,
    repo: str,
    force: bool,
) -> dict[str, Any]:
    dataset_id = f"{user}/{repo}"
    source_path = path_policy.dataset_local_dir(dataset_id)
    info_path = source_path / "meta" / "info.json"
    if not info_path.exists():
        return {"ok": False, "status_code": 404, "error": "Dataset not found locally"}

    pq_files = discover_parquet_files(source_path)
    if not pq_files:
        return {"ok": False, "status_code": 404, "error": "No parquet files found"}

    cache_file = source_path / ".lestudio_ep_stats.json"
    signature = compute_stats_signature(source_path, info_path, pq_files)

    if not force and cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text())
            if cached.get("cache_signature") == signature:
                return {"ok": True, "status": "ready", "cached": True, "job_id": ""}
        except Exception:
            pass

    _cleanup_finished_jobs(jobs_state.stats_jobs_lock, jobs_state.stats_jobs)
    _cleanup_runtime_refs(jobs_state)

    job_id = uuid.uuid4().hex[:12]
    now = time.time()
    cancel_event = threading.Event()

    with jobs_state.stats_cancel_lock:
        jobs_state.stats_cancel_events[job_id] = cancel_event

    with jobs_state.stats_jobs_lock:
        jobs_state.stats_jobs[job_id] = {
            "job_id": job_id,
            "dataset_id": dataset_id,
            "status": "queued",
            "phase": "queued",
            "progress": 0,
            "started_at": now,
            "updated_at": now,
            "logs": [],
            "error": "",
            "cancel_requested": False,
        }

    def run_stats_job():
        with jobs_state.stats_jobs_lock:
            job = jobs_state.stats_jobs.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["phase"] = "reading"
            job["progress"] = 3
            job["updated_at"] = time.time()

        def on_progress(done_files: int, total_files: int):
            pct = 5 + int((max(1, done_files) / max(1, total_files)) * 85)
            with jobs_state.stats_jobs_lock:
                job2 = jobs_state.stats_jobs.get(job_id)
                if not job2:
                    return
                if bool(job2.get("cancel_requested", False)):
                    cancel_event.set()
                    return
                job2["progress"] = max(int(job2.get("progress", 0)), min(95, pct))
                job2["phase"] = "processing"
                job2["updated_at"] = time.time()

        try:
            result = compute_episode_stats(source_path, cancel_event=cancel_event, progress_cb=on_progress)
            if cancel_event.is_set():
                with jobs_state.stats_jobs_lock:
                    job3 = jobs_state.stats_jobs.get(job_id)
                    if job3:
                        job3["status"] = "cancelled"
                        job3["phase"] = "cancelled"
                        job3["progress"] = 0
                        job3["error"] = "Cancelled by user"
                        job3["updated_at"] = time.time()
                return

            payload = {"cache_signature": signature, **result}
            try:
                cache_file.write_text(json.dumps(payload))
            except Exception:
                pass

            with jobs_state.stats_jobs_lock:
                job4 = jobs_state.stats_jobs.get(job_id)
                if job4:
                    job4["status"] = "success"
                    job4["phase"] = "completed"
                    job4["progress"] = 100
                    job4["updated_at"] = time.time()
        except Exception as exc:
            with jobs_state.stats_jobs_lock:
                job5 = jobs_state.stats_jobs.get(job_id)
                if job5:
                    if cancel_event.is_set() or bool(job5.get("cancel_requested", False)):
                        job5["status"] = "cancelled"
                        job5["phase"] = "cancelled"
                        job5["progress"] = 0
                        job5["error"] = "Cancelled by user"
                    else:
                        job5["status"] = "error"
                        job5["phase"] = "error"
                        job5["error"] = str(exc)
                    job5["updated_at"] = time.time()

    threading.Thread(target=run_stats_job, daemon=True).start()
    return {"ok": True, "status": "queued", "cached": False, "job_id": job_id}


def get_episode_stats_job_status(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    _cleanup_finished_jobs(jobs_state.stats_jobs_lock, jobs_state.stats_jobs)
    _cleanup_runtime_refs(jobs_state)
    with jobs_state.stats_jobs_lock:
        job = jobs_state.stats_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Stats job not found"}
        return {"ok": True, **job}


def cancel_episode_stats_job(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    with jobs_state.stats_jobs_lock:
        job = jobs_state.stats_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Stats job not found"}
        status = str(job.get("status", ""))
        if status in TERMINAL_JOB_STATUS:
            return {"ok": False, "error": f"Job already finished ({status})"}
        job["cancel_requested"] = True
        if status == "queued":
            job["status"] = "cancelled"
            job["phase"] = "cancelled"
            job["error"] = "Cancelled by user"
            job["progress"] = 0
        job["updated_at"] = time.time()

    with jobs_state.stats_cancel_lock:
        ev = jobs_state.stats_cancel_events.get(job_id)
        if ev:
            ev.set()
    return {"ok": True, "job_id": job_id}
