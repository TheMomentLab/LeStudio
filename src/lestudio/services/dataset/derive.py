from __future__ import annotations

import json
import re
import subprocess
import threading
import time
import uuid
from typing import Any

from ... import path_policy
from ...command_builders import build_derive_args
from ...lib.async_job_manager import TERMINAL_JOB_STATUS, _cleanup_finished_jobs
from ...routes._state import DatasetJobState
from .stats import _cleanup_runtime_refs


def start_derive_dataset_job(
    jobs_state: DatasetJobState,
    python_exe: str,
    user: str,
    repo: str,
    new_repo_id: str,
    keep_indices_raw: object,
) -> dict[str, Any]:
    if not new_repo_id:
        return {"ok": False, "status_code": 400, "error": "new_repo_id is required"}
    if not re.match(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", new_repo_id):
        return {"ok": False, "status_code": 400, "error": "new_repo_id must be user/repo format"}
    if not isinstance(keep_indices_raw, list) or len(keep_indices_raw) == 0:
        return {"ok": False, "status_code": 400, "error": "keep_indices must be a non-empty array"}

    source_repo_id = f"{user}/{repo}"
    if source_repo_id == new_repo_id:
        return {"ok": False, "status_code": 400, "error": "new_repo_id must differ from source repo"}

    source_path = path_policy.dataset_local_dir(source_repo_id)
    info_path = source_path / "meta" / "info.json"
    if not info_path.exists():
        return {"ok": False, "status_code": 404, "error": f"Dataset {source_repo_id} not found locally"}

    try:
        info = json.loads(info_path.read_text())
        total_episodes = int(info.get("total_episodes", 0))
    except Exception as exc:
        return {"ok": False, "status_code": 500, "error": f"Failed to parse info.json: {exc}"}

    keep_indices: list[int] = []
    for idx, raw in enumerate(keep_indices_raw):
        try:
            keep_indices.append(int(str(raw)))
        except Exception:
            return {"ok": False, "status_code": 400, "error": f"keep_indices[{idx}] must be an integer"}

    keep_set = sorted(set(keep_indices))
    invalid = [i for i in keep_set if i < 0 or i >= total_episodes]
    if invalid:
        preview = ", ".join(str(i) for i in invalid[:20])
        return {
            "ok": False,
            "status_code": 400,
            "error": f"keep_indices out of range [0, {max(0, total_episodes - 1)}]: {preview}",
        }
    if len(keep_set) == 0:
        return {"ok": False, "status_code": 400, "error": "keep_indices must not be empty"}
    if len(keep_set) >= total_episodes:
        return {"ok": False, "status_code": 400, "error": "all episodes selected; derive would be identical"}

    all_indices = list(range(total_episodes))
    keep_lookup = set(keep_set)
    delete_indices = [i for i in all_indices if i not in keep_lookup]

    _cleanup_finished_jobs(jobs_state.derive_jobs_lock, jobs_state.derive_jobs)
    _cleanup_runtime_refs(jobs_state)

    job_id = uuid.uuid4().hex[:12]
    now = time.time()
    with jobs_state.derive_jobs_lock:
        jobs_state.derive_jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "phase": "queued",
            "progress": 0,
            "source_repo_id": source_repo_id,
            "new_repo_id": new_repo_id,
            "keep_count": len(keep_set),
            "delete_count": len(delete_indices),
            "started_at": now,
            "updated_at": now,
            "logs": [],
            "error": "",
            "cancel_requested": False,
        }

    def run_derive_job():
        with jobs_state.derive_jobs_lock:
            job = jobs_state.derive_jobs.get(job_id)
            if not job:
                return
            if bool(job.get("cancel_requested", False)):
                job["status"] = "cancelled"
                job["phase"] = "cancelled"
                job["progress"] = 0
                job["error"] = "Cancelled by user"
                job["updated_at"] = time.time()
                return
            job["status"] = "running"
            job["phase"] = "preparing"
            job["progress"] = 5
            job["updated_at"] = time.time()

        cfg = {
            "source_repo_id": source_repo_id,
            "new_repo_id": new_repo_id,
            "delete_indices": delete_indices,
        }
        cmd = build_derive_args(python_exe, cfg)

        proc = None
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            with jobs_state.derive_procs_lock:
                jobs_state.derive_procs[job_id] = proc
        except Exception as exc:
            with jobs_state.derive_jobs_lock:
                job2 = jobs_state.derive_jobs.get(job_id)
                if job2:
                    job2["status"] = "error"
                    job2["error"] = str(exc)
                    job2["updated_at"] = time.time()
            return

        progress = 5
        if proc and proc.stdout is not None:
            for raw in proc.stdout:
                with jobs_state.derive_jobs_lock:
                    job3 = jobs_state.derive_jobs.get(job_id)
                    if not job3:
                        continue
                    if bool(job3.get("cancel_requested", False)):
                        try:
                            proc.terminate()
                        except Exception:
                            pass
                        continue

                line = raw.rstrip("\n")
                with jobs_state.derive_jobs_lock:
                    job4 = jobs_state.derive_jobs.get(job_id)
                    if not job4:
                        continue
                    logs = job4["logs"]
                    logs.append(line)
                    if len(logs) > 300:
                        del logs[:-300]
                    job4["phase"] = "processing"
                    m = re.search(r"(\d{1,3})%", line)
                    if m:
                        pct = max(0, min(99, int(m.group(1))))
                        progress = max(progress, pct)
                    else:
                        progress = min(95, progress + 1)
                    job4["progress"] = progress
                    job4["updated_at"] = time.time()

        rc = proc.wait() if proc else -1
        with jobs_state.derive_jobs_lock:
            job5 = jobs_state.derive_jobs.get(job_id)
            if not job5:
                return
            if bool(job5.get("cancel_requested", False)):
                job5["status"] = "cancelled"
                job5["phase"] = "cancelled"
                job5["progress"] = 0
                job5["error"] = "Cancelled by user"
            elif rc == 0:
                job5["status"] = "success"
                job5["phase"] = "completed"
                job5["progress"] = 100
            else:
                job5["status"] = "error"
                job5["phase"] = "error"
                if not job5["error"]:
                    tail = "\n".join(job5["logs"][-10:])
                    job5["error"] = tail or f"Process exited with code {rc}"
            job5["updated_at"] = time.time()

        with jobs_state.derive_procs_lock:
            jobs_state.derive_procs.pop(job_id, None)

    threading.Thread(target=run_derive_job, daemon=True).start()
    return {"ok": True, "job_id": job_id}


def get_derive_job_status(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    _cleanup_finished_jobs(jobs_state.derive_jobs_lock, jobs_state.derive_jobs)
    _cleanup_runtime_refs(jobs_state)
    with jobs_state.derive_jobs_lock:
        job = jobs_state.derive_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Derive job not found"}
        return {"ok": True, **job}


def cancel_derive_job(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    with jobs_state.derive_jobs_lock:
        job = jobs_state.derive_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Derive job not found"}

        status = str(job.get("status", ""))
        if status in TERMINAL_JOB_STATUS:
            return {"ok": False, "error": f"Job already finished ({status})"}

        job["cancel_requested"] = True
        if status == "queued":
            job["status"] = "cancelled"
            job["phase"] = "cancelled"
            job["progress"] = 0
            job["error"] = "Cancelled by user"
        job["updated_at"] = time.time()

    with jobs_state.derive_procs_lock:
        proc = jobs_state.derive_procs.get(job_id)
        if proc is not None:
            try:
                proc.terminate()
            except Exception:
                pass
    return {"ok": True, "job_id": job_id}
