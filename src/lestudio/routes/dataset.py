"""Dataset viewer and HuggingFace Hub routes."""
from __future__ import annotations

import datetime
import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.responses import Response

from lestudio.routes._state import AppState


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    token_file = state.config_dir / "hf_token"

    def _resolve_hf_token() -> tuple[str, str]:
        token_env = (os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN") or "").strip()
        if token_env:
            return token_env, "env"

        if token_file.exists():
            try:
                token_saved = token_file.read_text().strip()
            except Exception:
                token_saved = ""
            if token_saved:
                os.environ["HF_TOKEN"] = token_saved
                os.environ["HUGGINGFACE_HUB_TOKEN"] = token_saved
                return token_saved, "file"

        return "", "none"

    def _mask_token(token: str) -> str:
        if not token:
            return ""
        if len(token) <= 8:
            return "*" * len(token)
        return f"{token[:4]}...{token[-4:]}"

    # ─── Dataset List / Info ───────────────────────────────────────────────────
    @router.get("/api/datasets")
    def api_datasets_list():
        base = Path.home() / ".cache" / "huggingface" / "lerobot"
        datasets = []
        if base.exists():
            for user_dir in base.iterdir():
                if not user_dir.is_dir():
                    continue
                for ds_dir in user_dir.iterdir():
                    if not ds_dir.is_dir():
                        continue
                    info_path = ds_dir / "meta" / "info.json"
                    if info_path.exists():
                        try:
                            info = json.loads(info_path.read_text())
                            mtime = info_path.stat().st_mtime
                            mdate = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                            data_size_raw = info.get("data_files_size_in_mb", 0)
                            video_size_raw = info.get("video_files_size_in_mb", 0)
                            try:
                                info_size = float(data_size_raw or 0) + float(video_size_raw or 0)
                            except Exception:
                                info_size = 0.0

                            # info.json에 사이즈 정보가 있으면 rglob 스킵
                            # (rglob은 수백 개 파일 stat() 호출 → 데이터셋이 클수록 매우 느렸)
                            if info_size > 0:
                                size_mb = round(info_size, 1)
                            else:
                                try:
                                    total_bytes = sum(f.stat().st_size for f in ds_dir.rglob('*') if f.is_file())
                                    size_mb = round(total_bytes / (1024 * 1024), 1)
                                except Exception:
                                    size_mb = 0.0
                            datasets.append({
                                "id": f"{user_dir.name}/{ds_dir.name}",
                                "total_episodes": info.get("total_episodes", 0),
                                "total_frames": info.get("total_frames", 0),
                                "fps": info.get("fps", 30),
                                "modified": mdate,
                                "timestamp": mtime,
                                "size_mb": size_mb
                            })
                        except Exception:
                            pass
        datasets.sort(key=lambda x: x["timestamp"], reverse=True)
        return {"datasets": datasets}

    @router.get("/api/datasets/{user}/{repo}")
    def api_dataset_info(user: str, repo: str):
        repo_id = f"{user}/{repo}"
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / user / repo
        info_path = base / "meta" / "info.json"

        if not info_path.exists():
            return JSONResponse(status_code=404, content={"detail": "Dataset not found"})

        try:
            info = json.loads(info_path.read_text())
            cameras = [k for k, v in info.get("features", {}).items() if v.get("dtype") == "video"]

            episodes = []
            episodes_dir = base / "meta" / "episodes"
            if episodes_dir.exists():
                try:
                    pd = __import__("pandas")

                    rows = []
                    for pq_path in sorted(episodes_dir.glob("**/*.parquet")):
                        try:
                            base_cols = ["episode_index", "length", "tasks"]
                            video_cols = []
                            for cam in cameras:
                                video_cols.append(f"videos/{cam}/chunk_index")
                                video_cols.append(f"videos/{cam}/file_index")
                                video_cols.append(f"videos/{cam}/from_timestamp")
                                video_cols.append(f"videos/{cam}/to_timestamp")
                            try:
                                df = pd.read_parquet(pq_path, columns=base_cols + video_cols)
                            except Exception:
                                df = pd.read_parquet(pq_path)
                            for _, row in df.iterrows():
                                tasks = row.get("tasks", [])
                                if tasks is None:
                                    tasks = []
                                elif not isinstance(tasks, list):
                                    tasks = list(tasks)
                                length_value = row.get("length", row.get("episode_length", row.get("num_frames", row.get("frame_count", 0))))
                                if length_value is None or pd.isna(length_value):
                                    length_value = 0
                                episode_index_value = row.get("episode_index", row.get("episode_id", 0))
                                if episode_index_value is None or pd.isna(episode_index_value):
                                    episode_index_value = 0
                                video_files = {}
                                for cam in cameras:
                                    chunk_key = f"videos/{cam}/chunk_index"
                                    file_key = f"videos/{cam}/file_index"
                                    from_key = f"videos/{cam}/from_timestamp"
                                    to_key = f"videos/{cam}/to_timestamp"
                                    if chunk_key in row and file_key in row:
                                        chunk_val = row.get(chunk_key)
                                        file_val = row.get(file_key)
                                        if not pd.isna(chunk_val) and not pd.isna(file_val):
                                            from_val = row.get(from_key) if from_key in row else None
                                            to_val = row.get(to_key) if to_key in row else None
                                            video_files[cam] = {
                                                "chunk_index": int(chunk_val),
                                                "file_index": int(file_val),
                                                "from_timestamp": None if from_val is None or pd.isna(from_val) else float(from_val),
                                                "to_timestamp": None if to_val is None or pd.isna(to_val) else float(to_val),
                                            }
                                rows.append({
                                    "episode_index": int(episode_index_value),
                                    "length": int(length_value),
                                    "tasks": tasks,
                                    "video_files": video_files,
                                })
                        except Exception:
                            continue

                    rows.sort(key=lambda x: x["episode_index"])
                    episodes = rows
                except Exception:
                    episodes = []

            if not episodes:
                for ep_idx in range(info.get("total_episodes", 0)):
                    episodes.append({
                        "episode_index": ep_idx,
                        "length": 0,
                        "tasks": [],
                        "video_files": {},
                    })

            return {
                "dataset_id": repo_id,
                "total_episodes": info.get("total_episodes", 0),
                "total_frames": info.get("total_frames", 0),
                "fps": info.get("fps", 30),
                "cameras": cameras,
                "episodes": episodes
            }
        except Exception as e:
            return JSONResponse(status_code=500, content={"detail": f"Failed to load dataset: {str(e)}"})

    @router.get("/api/datasets/{user}/{repo}/videos/{camera}/{chunk}/{file}")
    def api_dataset_video(request: Request, user: str, repo: str, camera: str, chunk: str, file: str):
        # Serve MP4 with HTTP 206 Range support so browser <video> can seek freely
        video_path = Path.home() / ".cache" / "huggingface" / "lerobot" / user / repo / "videos" / camera / chunk / file
        if not video_path.exists():
            return Response(status_code=404, content="Video not found")
        file_size = video_path.stat().st_size
        range_header = request.headers.get("range")
        return _serve_video_file(video_path, file_size, range_header=range_header)

    @router.delete("/api/datasets/{user}/{repo}")
    def api_dataset_delete(user: str, repo: str):
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / user / repo
        if not base.exists():
            return JSONResponse(status_code=404, content={"detail": "Dataset not found"})
        try:
            shutil.rmtree(base)
            return {"ok": True}
        except Exception as e:
            return JSONResponse(status_code=500, content={"detail": f"Failed to delete dataset: {str(e)}"})

    @router.get("/api/datasets/{user}/{repo}/quality")
    def api_dataset_quality(user: str, repo: str):
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / user / repo
        info_path = base / "meta" / "info.json"
        if not info_path.exists():
            return {"ok": False, "error": "Dataset not found"}

        checks = []
        score = 100
        category_weight = {
            "metadata": 1.2,
            "episodes": 1.1,
            "videos": 1.4,
            "distribution": 0.8,
            "general": 1.0,
        }
        category_penalty: dict[str, int] = {k: 0 for k in category_weight.keys()}

        def add_check(level: str, name: str, message: str, category: str = "general"):
            nonlocal score
            cat = category if category in category_weight else "general"
            checks.append({"level": level, "name": name, "message": message, "category": cat})
            base_val = 0
            if level == "error":
                base_val = 20
            elif level == "warn":
                base_val = 8
            if base_val > 0:
                penalty = int(round(base_val * category_weight[cat]))
                category_penalty[cat] += penalty
                score -= penalty

        try:
            info = json.loads(info_path.read_text())
        except Exception as e:
            return {"ok": False, "error": f"Failed to parse info.json: {e}"}

        total_expected = int(info.get("total_episodes", 0) or 0)
        total_frames = int(info.get("total_frames", 0) or 0)
        fps = int(info.get("fps", 0) or 0)
        if fps <= 0:
            add_check("error", "fps", "FPS in info.json is invalid or missing", "metadata")
        elif fps < 5:
            add_check("warn", "fps", f"FPS is low ({fps})", "metadata")
        else:
            add_check("ok", "fps", f"FPS looks valid ({fps})", "metadata")

        cameras = [k for k, v in info.get("features", {}).items() if isinstance(v, dict) and v.get("dtype") == "video"]
        if not cameras:
            add_check("warn", "cameras", "No video camera features found in dataset metadata", "metadata")
        else:
            add_check("ok", "cameras", f"Detected {len(cameras)} camera streams", "metadata")

        episodes = []
        episodes_dir = base / "meta" / "episodes"
        if episodes_dir.exists():
            try:
                pd = __import__("pandas")
                for pq_path in sorted(episodes_dir.glob("**/*.parquet")):
                    try:
                        df = pd.read_parquet(pq_path, columns=["episode_index", "length"])
                    except Exception:
                        try:
                            df = pd.read_parquet(pq_path, columns=["episode_index", "episode_length"])
                        except Exception:
                            df = pd.read_parquet(pq_path)
                    for _, row in df.iterrows():
                        length_value = row.get("length", row.get("episode_length", row.get("num_frames", row.get("frame_count", 0))))
                        if length_value is None or pd.isna(length_value):
                            length_value = 0
                        episode_index_value = row.get("episode_index", row.get("episode_id", 0))
                        if episode_index_value is None or pd.isna(episode_index_value):
                            episode_index_value = 0
                        episodes.append({
                            "episode_index": int(episode_index_value),
                            "length": int(length_value),
                        })
            except Exception as e:
                add_check("warn", "episodes", f"Could not parse episode parquet files: {e}", "episodes")

        actual_episodes = len(episodes)
        if total_expected > 0 and actual_episodes > 0 and actual_episodes != total_expected:
            add_check("warn", "episode_count", f"Expected {total_expected} episodes, found {actual_episodes}", "episodes")
        else:
            add_check("ok", "episode_count", f"Episode count: {max(total_expected, actual_episodes)}", "episodes")

        non_positive_lengths = [ep for ep in episodes if ep["length"] <= 0]
        if non_positive_lengths:
            add_check("warn", "episode_length_zero", f"Episodes with non-positive length: {len(non_positive_lengths)}", "episodes")

        zero_byte_videos = 0
        total_videos = 0
        per_camera_files: dict[str, int] = {cam: 0 for cam in cameras}
        videos_root = base / "videos"
        if videos_root.exists():
            for p in videos_root.rglob("*.mp4"):
                total_videos += 1
                parts = p.parts
                if "videos" in parts:
                    idx = parts.index("videos")
                    if idx + 1 < len(parts):
                        cam_name = parts[idx + 1]
                        per_camera_files[cam_name] = per_camera_files.get(cam_name, 0) + 1
                try:
                    if p.stat().st_size == 0:
                        zero_byte_videos += 1
                except Exception:
                    zero_byte_videos += 1

        if total_videos == 0:
            add_check("warn", "videos", "No video files found under videos/", "videos")
        elif zero_byte_videos > 0:
            add_check("warn", "videos", f"Found {zero_byte_videos} zero-byte/corrupt candidate video files", "videos")
        else:
            add_check("ok", "videos", f"Video files present: {total_videos}", "videos")

        missing_camera_files = [cam for cam, cnt in per_camera_files.items() if cnt <= 0]
        if cameras and missing_camera_files:
            add_check("warn", "camera_coverage", f"Cameras without any video files: {', '.join(missing_camera_files)}", "videos")
        elif cameras:
            add_check("ok", "camera_coverage", "All camera streams have video files", "videos")

        avg_ep_len = 0
        median_ep_len = 0
        if episodes:
            lengths = sorted(ep["length"] for ep in episodes)
            avg_ep_len = round(sum(lengths) / max(1, len(lengths)), 2)
            mid = len(lengths) // 2
            if len(lengths) % 2 == 0:
                median_ep_len = round((lengths[mid - 1] + lengths[mid]) / 2, 2)
            else:
                median_ep_len = round(lengths[mid], 2)
            if avg_ep_len <= 1:
                add_check("warn", "episode_length", "Average episode length is very short", "distribution")
            else:
                add_check("ok", "episode_length", f"Average episode length: {avg_ep_len} frames", "distribution")

            if median_ep_len > 0:
                ratio = avg_ep_len / max(1e-6, median_ep_len)
                if ratio > 2.5 or ratio < 0.4:
                    add_check("warn", "episode_length_distribution", "Episode lengths are highly imbalanced", "distribution")
                else:
                    add_check("ok", "episode_length_distribution", "Episode length distribution looks reasonable", "distribution")

        if total_frames <= 0:
            add_check("warn", "total_frames", "Total frame count is zero or missing", "metadata")
        else:
            add_check("ok", "total_frames", f"Total frames: {total_frames}", "metadata")

        score = max(0, min(100, score))
        has_error = any(c["level"] == "error" for c in checks)
        return {
            "ok": not has_error,
            "score": score,
            "checks": checks,
            "score_breakdown": category_penalty,
            "stats": {
                "dataset_id": f"{user}/{repo}",
                "total_expected_episodes": total_expected,
                "total_detected_episodes": actual_episodes,
                "total_frames": total_frames,
                "fps": fps,
                "camera_count": len(cameras),
                "camera_file_counts": per_camera_files,
                "video_files": total_videos,
                "zero_byte_videos": zero_byte_videos,
                "avg_episode_length": avg_ep_len,
                "median_episode_length": median_ep_len,
                "non_positive_episode_count": len(non_positive_lengths),
            },
        }

    # ─── Episode Tags ──────────────────────────────────────────────────────────
    @router.get("/api/datasets/{user}/{repo}/tags")
    def api_episode_tags_get(user: str, repo: str):
        tags_dir = state.config_dir / "episode-tags"
        tags_file = tags_dir / f"{user}_{repo}.json"
        if tags_file.exists():
            try:
                tags = json.loads(tags_file.read_text())
            except Exception:
                tags = {}
        else:
            tags = {}
        return {"ok": True, "tags": tags}

    @router.post("/api/datasets/{user}/{repo}/tags")
    def api_episode_tags_post(user: str, repo: str, body: dict | None = None):
        payload = body or {}
        episode_index = str(payload.get("episode_index", ""))
        tag = str(payload.get("tag", "untagged"))
        VALID_TAGS = {"good", "bad", "review", "untagged"}
        if tag not in VALID_TAGS:
            return {"ok": False, "error": f"Invalid tag. Must be one of: {', '.join(sorted(VALID_TAGS))}"}
        if not episode_index:
            return {"ok": False, "error": "episode_index is required"}
        tags_dir = state.config_dir / "episode-tags"
        tags_dir.mkdir(parents=True, exist_ok=True)
        tags_file = tags_dir / f"{user}_{repo}.json"
        if tags_file.exists():
            try:
                tags = json.loads(tags_file.read_text())
            except Exception:
                tags = {}
        else:
            tags = {}
        if tag == "untagged":
            tags.pop(episode_index, None)
        else:
            tags[episode_index] = tag
        tags_file.write_text(json.dumps(tags, indent=2))
        return {"ok": True, "episode_index": episode_index, "tag": tag}

    # ─── Dataset Push ──────────────────────────────────────────────────────────
    @router.post("/api/datasets/{user}/{repo}/push")
    async def api_dataset_push(user: str, repo: str, data: dict | None = None):
        payload = data or {}
        local_path = Path.home() / ".cache" / "huggingface" / "lerobot" / user / repo
        if not local_path.exists():
            return {"ok": False, "error": "Dataset not found in local cache"}

        target_repo_id = str(payload.get("target_repo_id", f"{user}/{repo}")).strip() or f"{user}/{repo}"
        private = bool(payload.get("private", False))

        token, _ = _resolve_hf_token()
        if not token:
            return {"ok": False, "error": "HF_TOKEN (or HUGGINGFACE_HUB_TOKEN) is not set"}

        cli = shutil.which("huggingface-cli")
        if not cli:
            return {"ok": False, "error": "huggingface-cli is not installed in this environment"}

        job_id = uuid.uuid4().hex[:12]
        now = time.time()
        with state.push_jobs_lock:
            state.push_jobs[job_id] = {
                "job_id": job_id,
                "status": "queued",
                "phase": "queued",
                "progress": 0,
                "repo_id": target_repo_id,
                "dataset_id": f"{user}/{repo}",
                "started_at": now,
                "updated_at": now,
                "logs": [],
                "error": "",
            }

        def run_push_job():
            with state.push_jobs_lock:
                if job_id not in state.push_jobs:
                    return
                state.push_jobs[job_id]["status"] = "running"
                state.push_jobs[job_id]["phase"] = "preparing"
                state.push_jobs[job_id]["progress"] = 5
                state.push_jobs[job_id]["updated_at"] = time.time()

            cmd = [cli, "upload", target_repo_id, str(local_path), ".", "--repo-type", "dataset"]
            if private:
                cmd.append("--private")

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env={**os.environ, "HF_TOKEN": token, "HUGGINGFACE_HUB_TOKEN": token},
                    bufsize=1,
                )
            except Exception as e:
                with state.push_jobs_lock:
                    state.push_jobs[job_id]["status"] = "error"
                    state.push_jobs[job_id]["error"] = str(e)
                    state.push_jobs[job_id]["updated_at"] = time.time()
                return

            progress = 5
            if proc.stdout is not None:
                for raw in proc.stdout:
                    line = raw.rstrip("\n")
                    with state.push_jobs_lock:
                        job = state.push_jobs.get(job_id)
                        if not job:
                            continue
                        logs = job["logs"]
                        logs.append(line)
                        if len(logs) > 300:
                            del logs[:-300]

                        job["phase"] = "uploading"

                        m = re.search(r"(\d{1,3})%", line)
                        ratio = re.search(r"\b([0-9]{1,6})\s*/\s*([0-9]{1,6})\b", line)
                        if m:
                            pct = max(0, min(99, int(m.group(1))))
                            progress = max(progress, pct)
                        elif ratio:
                            done = int(ratio.group(1))
                            total = max(1, int(ratio.group(2)))
                            pct = max(0, min(99, int((done / total) * 100)))
                            progress = max(progress, pct)
                        else:
                            progress = min(95, progress + 1)
                        job["progress"] = progress
                        job["updated_at"] = time.time()

            rc = proc.wait()
            with state.push_jobs_lock:
                job = state.push_jobs.get(job_id)
                if not job:
                    return
                if rc == 0:
                    job["phase"] = "finalizing"
                    job["progress"] = max(97, int(job.get("progress", 0)))
                    job["updated_at"] = time.time()
                    job["status"] = "success"
                    job["phase"] = "completed"
                    job["progress"] = 100
                else:
                    job["status"] = "error"
                    job["phase"] = "error"
                    if not job["error"]:
                        tail = "\n".join(job["logs"][-5:]).strip()
                        job["error"] = tail or f"Upload failed with exit code {rc}"
                job["updated_at"] = time.time()

        threading.Thread(target=run_push_job, daemon=True).start()
        return {"ok": True, "job_id": job_id}

    @router.get("/api/datasets/push/status/{job_id}")
    def api_dataset_push_status(job_id: str):
        with state.push_jobs_lock:
            job = state.push_jobs.get(job_id)
            if not job:
                return {"ok": False, "error": "Push job not found"}
            return {"ok": True, **job}

    # ─── HF Identity ─────────────────────────────────────────────────────────
    _whoami_cache: dict[str, object] = {}  # {"result": ..., "expires": float, "token": str}

    @router.get("/api/hf/token/status")
    def api_hf_token_status():
        token, source = _resolve_hf_token()
        return {
            "ok": True,
            "has_token": bool(token),
            "source": source,
            "masked_token": _mask_token(token),
        }

    @router.put("/api/hf/token")
    @router.post("/api/hf/token")
    async def api_hf_token_set(data: dict[str, object] | None = None):
        payload = data or {}
        token = str(payload.get("token", "")).strip()
        if not token:
            return {"ok": False, "error": "token is required"}
        try:
            token_file.parent.mkdir(parents=True, exist_ok=True)
            token_file.write_text(token)
            try:
                os.chmod(token_file, 0o600)
            except Exception:
                pass
            os.environ["HF_TOKEN"] = token
            os.environ["HUGGINGFACE_HUB_TOKEN"] = token
            _whoami_cache.clear()
            return {"ok": True, "has_token": True, "source": "env"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    @router.delete("/api/hf/token")
    def api_hf_token_clear():
        os.environ.pop("HF_TOKEN", None)
        os.environ.pop("HUGGINGFACE_HUB_TOKEN", None)
        try:
            if token_file.exists():
                token_file.unlink()
        except Exception as e:
            return {"ok": False, "error": str(e)}
        _whoami_cache.clear()
        return {"ok": True, "has_token": False, "source": "none"}

    @router.get("/api/hf/whoami")
    def api_hf_whoami():
        """Return the HuggingFace username associated with the current token."""
        # ok:True만 캐싱 (5분). 토큰이 달라지면 즉시 무효화.
        token, _ = _resolve_hf_token()
        if not token:
            _whoami_cache.clear()
            return {"ok": False, "username": None, "error": "no_token"}
        cached = _whoami_cache.get("result")
        expires_raw = _whoami_cache.get("expires", 0.0)
        expires = float(expires_raw) if isinstance(expires_raw, (int, float)) else 0.0
        token_cached = _whoami_cache.get("token")
        if (cached
                and time.monotonic() < expires
                and isinstance(token_cached, str)
                and token_cached == token):
            return cached

        try:
            from huggingface_hub import whoami  # type: ignore
            info = whoami(token=token)
            username = info.get("name", None) if isinstance(info, dict) else None
            if not username:
                return {"ok": False, "username": None, "error": "no_username"}
            result = {"ok": True, "username": username}
            _whoami_cache["result"] = result
            _whoami_cache["expires"] = time.monotonic() + 300.0  # 5분
            _whoami_cache["token"] = token
            return result
        except ImportError:
            return {"ok": False, "username": None, "error": "huggingface_hub_not_installed"}
        except Exception:
            return {"ok": False, "username": None, "error": "auth_failed"}

    # ─── Hub Search / Download ─────────────────────────────────────────────────
    @router.get("/api/hub/datasets/search")
    def api_hub_datasets_search(query: str = "", limit: int = 20, tag: str = "lerobot"):
        """Search HuggingFace Hub for LeRobot datasets."""
        try:
            from huggingface_hub import list_datasets  # type: ignore
        except ImportError:
            return {"ok": False, "error": "huggingface_hub is not installed", "datasets": []}

        limit = max(1, min(limit, 100))
        try:
            search_tags = [tag] if tag else []
            kwargs: dict = {"tags": search_tags, "limit": limit, "full": False}
            if query:
                kwargs["search"] = query
            results = []
            for ds in list_datasets(**kwargs):
                entry = {
                    "id": ds.id,
                    "downloads": getattr(ds, "downloads", 0) or 0,
                    "likes": getattr(ds, "likes", 0) or 0,
                    "tags": list(getattr(ds, "tags", []) or []),
                    "last_modified": str(getattr(ds, "last_modified", "") or ""),
                }
                results.append(entry)
            return {"ok": True, "datasets": results}
        except Exception as e:
            return {"ok": False, "error": str(e), "datasets": []}

    @router.post("/api/hub/datasets/download")
    async def api_hub_datasets_download(data: dict | None = None):
        """Download a dataset from HuggingFace Hub to local cache."""
        payload = data or {}
        repo_id = str(payload.get("repo_id", "")).strip()
        if not repo_id or "/" not in repo_id:
            return {"ok": False, "error": "repo_id must be in user/repo format"}

        job_id = uuid.uuid4().hex[:12]
        now = time.time()
        with state.download_jobs_lock:
            state.download_jobs[job_id] = {
                "job_id": job_id,
                "repo_id": repo_id,
                "status": "queued",
                "progress": 0,
                "logs": [],
                "error": "",
                "started_at": now,
                "updated_at": now,
            }

        def run_download_job():
            with state.download_jobs_lock:
                job = state.download_jobs.get(job_id)
                if not job:
                    return
                job["status"] = "running"
                job["progress"] = 5
                job["updated_at"] = time.time()

            rc = -1
            try:
                from huggingface_hub import snapshot_download  # type: ignore
                local_dir = Path.home() / ".cache" / "huggingface" / "lerobot" / repo_id
                cli = shutil.which("huggingface-cli")
                if cli:
                    cmd = [cli, "download", repo_id, "--repo-type", "dataset", "--local-dir", str(local_dir)]
                    env = {**os.environ}
                    proc = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        env=env,
                        bufsize=1,
                    )
                    progress = 5
                    if proc.stdout:
                        for raw in proc.stdout:
                            line = raw.rstrip("\n")
                            with state.download_jobs_lock:
                                job2 = state.download_jobs.get(job_id)
                                if not job2:
                                    continue
                                job2["logs"].append(line)
                                if len(job2["logs"]) > 200:
                                    del job2["logs"][:-200]
                                m = re.search(r"(\d{1,3})%", line)
                                ratio = re.search(r"\b([0-9]{1,6})\s*/\s*([0-9]{1,6})\b", line)
                                if m:
                                    pct = max(0, min(99, int(m.group(1))))
                                    progress = max(progress, pct)
                                elif ratio:
                                    done = int(ratio.group(1))
                                    total = max(1, int(ratio.group(2)))
                                    pct = max(0, min(99, int((done / total) * 100)))
                                    progress = max(progress, pct)
                                else:
                                    progress = min(95, progress + 1)
                                job2["progress"] = progress
                                job2["updated_at"] = time.time()
                    rc = proc.wait()
                else:
                    snapshot_download(repo_id=repo_id, repo_type="dataset", local_dir=str(local_dir))
                    rc = 0

                with state.download_jobs_lock:
                    job3 = state.download_jobs.get(job_id)
                    if not job3:
                        return
                    if rc == 0:
                        job3["status"] = "success"
                        job3["progress"] = 100
                    else:
                        job3["status"] = "error"
                        tail = "\n".join(job3["logs"][-5:]).strip()
                        job3["error"] = tail or f"Download failed (exit {rc})"
                    job3["updated_at"] = time.time()

            except Exception as e:
                with state.download_jobs_lock:
                    job4 = state.download_jobs.get(job_id)
                    if job4:
                        job4["status"] = "error"
                        job4["error"] = str(e)
                        job4["updated_at"] = time.time()

        threading.Thread(target=run_download_job, daemon=True).start()
        return {"ok": True, "job_id": job_id}

    @router.get("/api/hub/datasets/download/status/{job_id}")
    def api_hub_download_status(job_id: str):
        with state.download_jobs_lock:
            job = state.download_jobs.get(job_id)
            if not job:
                return {"ok": False, "error": "Download job not found"}
            return {"ok": True, **job}

    return router


def _serve_video_file(video_path: Path, file_size: int, range_header: str | None):
    """Serve a video file with optional HTTP 206 Range support."""
    from fastapi.responses import FileResponse
    from fastapi.responses import StreamingResponse
    from starlette.responses import Response

    if range_header:
        try:
            range_val = range_header.strip().lower().replace("bytes=", "")
            start_str, end_str = range_val.split("-", 1)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except Exception:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        chunk_size = end - start + 1

        def _iter_file(path: Path, s: int, length: int, buf: int = 1 << 20):
            with open(path, "rb") as fh:
                fh.seek(s)
                remaining = length
                while remaining > 0:
                    data = fh.read(min(buf, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(
            _iter_file(video_path, start, chunk_size),
            status_code=206,
            headers=headers,
            media_type="video/mp4",
        )
    return FileResponse(video_path, media_type="video/mp4", headers={"Accept-Ranges": "bytes"})
