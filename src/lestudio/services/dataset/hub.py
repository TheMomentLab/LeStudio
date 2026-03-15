from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from ... import path_policy
from ...lib.async_job_manager import _cleanup_finished_jobs
from ...routes._state import DatasetJobState

_WHOAMI_CACHE: dict[str, object] = {}


def resolve_hf_token(token_file: Path) -> tuple[str, str]:
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


def mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 8:
        return "*" * len(token)
    return f"{token[:4]}...{token[-4:]}"


def _resolve_hf_token_file(token_file: Path | None = None, config_dir: Path | None = None) -> Path:
    if token_file is not None:
        return token_file
    if config_dir is not None:
        return config_dir / "hf_token"
    return path_policy.config_dir_default() / "hf_token"


def start_dataset_push_job(
    jobs_state: DatasetJobState,
    token_file: Path,
    user: str,
    repo: str,
    payload: dict[str, object],
) -> dict[str, Any]:
    local_path = path_policy.dataset_local_dir(f"{user}/{repo}")
    if not local_path.exists():
        return {"ok": False, "error": "Dataset not found in local cache"}

    target_repo_id = str(payload.get("target_repo_id", f"{user}/{repo}")).strip() or f"{user}/{repo}"
    private = bool(payload.get("private", False))

    token, _ = resolve_hf_token(token_file)
    if not token:
        return {"ok": False, "error": "HF_TOKEN (or HUGGINGFACE_HUB_TOKEN) is not set"}

    cli = shutil.which("huggingface-cli")
    if not cli:
        return {"ok": False, "error": "huggingface-cli is not installed in this environment"}

    _cleanup_finished_jobs(jobs_state.push_jobs_lock, jobs_state.push_jobs)
    job_id = uuid.uuid4().hex[:12]
    now = time.time()
    with jobs_state.push_jobs_lock:
        jobs_state.push_jobs[job_id] = {
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
        with jobs_state.push_jobs_lock:
            if job_id not in jobs_state.push_jobs:
                return
            jobs_state.push_jobs[job_id]["status"] = "running"
            jobs_state.push_jobs[job_id]["phase"] = "preparing"
            jobs_state.push_jobs[job_id]["progress"] = 5
            jobs_state.push_jobs[job_id]["updated_at"] = time.time()

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
        except Exception as exc:
            with jobs_state.push_jobs_lock:
                jobs_state.push_jobs[job_id]["status"] = "error"
                jobs_state.push_jobs[job_id]["error"] = str(exc)
                jobs_state.push_jobs[job_id]["updated_at"] = time.time()
            return

        progress = 5
        if proc.stdout is not None:
            for raw in proc.stdout:
                line = raw.rstrip("\n")
                with jobs_state.push_jobs_lock:
                    job = jobs_state.push_jobs.get(job_id)
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
        with jobs_state.push_jobs_lock:
            job = jobs_state.push_jobs.get(job_id)
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


def get_push_job_status(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    _cleanup_finished_jobs(jobs_state.push_jobs_lock, jobs_state.push_jobs)
    with jobs_state.push_jobs_lock:
        job = jobs_state.push_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Push job not found"}
        return {"ok": True, **job}


def get_hf_token_status(token_file: Path | None = None, config_dir: Path | None = None) -> dict[str, Any]:
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    token, source = resolve_hf_token(token_file)
    return {
        "ok": True,
        "has_token": bool(token),
        "source": source,
        "masked_token": mask_token(token),
    }


def set_hf_token(token_file: Path | None, token: str, config_dir: Path | None = None) -> dict[str, Any]:
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    token_value = token.strip()
    if not token_value:
        return {"ok": False, "error": "token is required"}
    try:
        token_file.parent.mkdir(parents=True, exist_ok=True)
        token_file.write_text(token_value)
        try:
            os.chmod(token_file, 0o600)
        except Exception:
            pass
        os.environ["HF_TOKEN"] = token_value
        os.environ["HUGGINGFACE_HUB_TOKEN"] = token_value
        _WHOAMI_CACHE.clear()
        return {"ok": True, "has_token": True, "source": "env"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def clear_hf_token(token_file: Path | None = None, config_dir: Path | None = None) -> dict[str, Any]:
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    os.environ.pop("HF_TOKEN", None)
    os.environ.pop("HUGGINGFACE_HUB_TOKEN", None)
    try:
        if token_file.exists():
            token_file.unlink()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    _WHOAMI_CACHE.clear()
    return {"ok": True, "has_token": False, "source": "none"}


def hf_whoami(token_file: Path | None = None, config_dir: Path | None = None) -> dict[str, Any]:
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    token, _ = resolve_hf_token(token_file)
    if not token:
        _WHOAMI_CACHE.clear()
        return {"ok": False, "username": None, "error": "no_token"}

    cached = _WHOAMI_CACHE.get("result")
    expires_raw = _WHOAMI_CACHE.get("expires", 0.0)
    expires = float(expires_raw) if isinstance(expires_raw, (int, float)) else 0.0
    token_cached = _WHOAMI_CACHE.get("token")
    if cached and time.monotonic() < expires and isinstance(token_cached, str) and token_cached == token:
        if isinstance(cached, dict):
            return dict(cached)

    try:
        hub_mod = __import__("huggingface_hub")
        whoami = hub_mod.whoami
        info = whoami(token=token)
        username = info.get("name", None) if isinstance(info, dict) else None
        if not username:
            return {"ok": False, "username": None, "error": "no_username"}
        result = {"ok": True, "username": username}
        _WHOAMI_CACHE["result"] = result
        _WHOAMI_CACHE["expires"] = time.monotonic() + 300.0
        _WHOAMI_CACHE["token"] = token
        return result
    except ImportError:
        return {"ok": False, "username": None, "error": "huggingface_hub_not_installed"}
    except Exception as exc:
        status_code: int | None = None
        response = getattr(exc, "response", None)
        msg = str(exc).lower()
        if response is not None:
            status_raw = getattr(response, "status_code", None)
            if isinstance(status_raw, int):
                status_code = status_raw

        if status_code in (401, 403):
            if "expired" in msg or "expiration" in msg or "has expired" in msg:
                return {"ok": False, "username": None, "error": "expired_token"}
            return {"ok": False, "username": None, "error": "invalid_token"}

        if "401" in msg or "403" in msg or "unauthorized" in msg or "forbidden" in msg or "invalid token" in msg:
            if "expired" in msg or "expiration" in msg or "has expired" in msg:
                return {"ok": False, "username": None, "error": "expired_token"}
            return {"ok": False, "username": None, "error": "invalid_token"}

        if (
            "timed out" in msg
            or "timeout" in msg
            or "connection" in msg
            or "network" in msg
            or "temporary failure" in msg
            or "name resolution" in msg
            or "503" in msg
            or "502" in msg
            or "504" in msg
        ):
            return {"ok": False, "username": None, "error": "network_error"}

        return {"ok": False, "username": None, "error": "auth_failed"}


def hf_my_datasets(token_file: Path | None = None, limit: int = 50, config_dir: Path | None = None) -> dict[str, Any]:
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    token, _ = resolve_hf_token(token_file)
    if not token:
        return {"ok": False, "error": "no_token", "datasets": []}

    try:
        hub_mod = __import__("huggingface_hub")
        whoami = hub_mod.whoami
        list_datasets = hub_mod.list_datasets
    except ImportError:
        return {"ok": False, "error": "huggingface_hub is not installed", "datasets": []}

    try:
        info = whoami(token=token)
        username = info.get("name") if isinstance(info, dict) else None
        if not username:
            return {"ok": False, "error": "no_username", "datasets": []}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "datasets": []}

    local_root = path_policy.lerobot_cache_root()
    limit = max(1, min(limit, 200))
    try:
        results = []
        for ds in list_datasets(author=username, limit=limit, full=False):
            repo_id = ds.id
            local_path = local_root / repo_id
            local_sync = local_path.exists()
            size_str = ""
            if local_sync:
                try:
                    total_bytes = sum(f.stat().st_size for f in local_path.rglob("*") if f.is_file())
                    if total_bytes >= 1_073_741_824:
                        size_str = f"{total_bytes / 1_073_741_824:.1f} GB"
                    elif total_bytes >= 1_048_576:
                        size_str = f"{total_bytes / 1_048_576:.0f} MB"
                    else:
                        size_str = f"{total_bytes / 1024:.0f} KB"
                except Exception:
                    size_str = ""
            last_mod = getattr(ds, "last_modified", None)
            modified_str = str(last_mod)[:10] if last_mod else ""
            results.append(
                {
                    "id": repo_id,
                    "downloads": getattr(ds, "downloads", 0) or 0,
                    "likes": getattr(ds, "likes", 0) or 0,
                    "size": size_str,
                    "modified": modified_str,
                    "local_sync": local_sync,
                }
            )
        return {"ok": True, "username": username, "datasets": results}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "datasets": []}


def hub_search_datasets(query: str = "", limit: int = 20, tag: str = "lerobot") -> dict[str, Any]:
    try:
        hub_mod = __import__("huggingface_hub")
        list_datasets = hub_mod.list_datasets
    except ImportError:
        return {"ok": False, "error": "huggingface_hub is not installed", "datasets": []}

    limit = max(1, min(limit, 100))
    try:
        search_tags = [tag] if tag else []
        kwargs: dict[str, Any] = {"tags": search_tags, "limit": limit, "full": False}
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
    except Exception as exc:
        return {"ok": False, "error": str(exc), "datasets": []}


def start_hub_download_job(jobs_state: DatasetJobState, repo_id: str) -> dict[str, Any]:
    if not repo_id or "/" not in repo_id:
        return {"ok": False, "error": "repo_id must be in user/repo format"}

    _cleanup_finished_jobs(jobs_state.download_jobs_lock, jobs_state.download_jobs)
    job_id = uuid.uuid4().hex[:12]
    now = time.time()
    with jobs_state.download_jobs_lock:
        jobs_state.download_jobs[job_id] = {
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
        with jobs_state.download_jobs_lock:
            job = jobs_state.download_jobs.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["progress"] = 5
            job["updated_at"] = time.time()

        rc = -1
        try:
            hub_mod = __import__("huggingface_hub")
            snapshot_download = hub_mod.snapshot_download
            local_dir = path_policy.dataset_local_dir(repo_id)
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
                        with jobs_state.download_jobs_lock:
                            job2 = jobs_state.download_jobs.get(job_id)
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

            with jobs_state.download_jobs_lock:
                job3 = jobs_state.download_jobs.get(job_id)
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

        except Exception as exc:
            with jobs_state.download_jobs_lock:
                job4 = jobs_state.download_jobs.get(job_id)
                if job4:
                    job4["status"] = "error"
                    job4["error"] = str(exc)
                    job4["updated_at"] = time.time()

    threading.Thread(target=run_download_job, daemon=True).start()
    return {"ok": True, "job_id": job_id}


def get_hub_download_status(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    _cleanup_finished_jobs(jobs_state.download_jobs_lock, jobs_state.download_jobs)
    with jobs_state.download_jobs_lock:
        job = jobs_state.download_jobs.get(job_id)
        if not job:
            return {"ok": False, "error": "Download job not found"}
        return {"ok": True, **job}


def hub_search(query: str = "", limit: int = 20, tag: str = "lerobot") -> dict[str, Any]:
    return hub_search_datasets(query=query, limit=limit, tag=tag)


def hub_download_start(jobs_state: DatasetJobState, repo_id: str) -> dict[str, Any]:
    return start_hub_download_job(jobs_state, repo_id)


def hub_push_start(
    jobs_state: DatasetJobState,
    repo_id: str,
    token: str = "",
    target_repo_id: str = "",
    private: bool = False,
    token_file: Path | None = None,
    config_dir: Path | None = None,
) -> dict[str, Any]:
    parts = repo_id.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return {"ok": False, "error": "repo_id must be in user/repo format"}

    user, repo = parts[0], parts[1]
    payload: dict[str, object] = {
        "target_repo_id": target_repo_id or repo_id,
        "private": bool(private),
    }
    token_file = _resolve_hf_token_file(token_file, config_dir=config_dir)
    token_value = token.strip()
    if not token_value:
        return start_dataset_push_job(jobs_state, token_file, user, repo, payload)

    prev_hf = os.environ.get("HF_TOKEN")
    prev_hf_hub = os.environ.get("HUGGINGFACE_HUB_TOKEN")
    try:
        os.environ["HF_TOKEN"] = token_value
        os.environ["HUGGINGFACE_HUB_TOKEN"] = token_value
        return start_dataset_push_job(jobs_state, token_file, user, repo, payload)
    finally:
        if prev_hf is None:
            os.environ.pop("HF_TOKEN", None)
        else:
            os.environ["HF_TOKEN"] = prev_hf
        if prev_hf_hub is None:
            os.environ.pop("HUGGINGFACE_HUB_TOKEN", None)
        else:
            os.environ["HUGGINGFACE_HUB_TOKEN"] = prev_hf_hub


def hub_push_status(jobs_state: DatasetJobState, job_id: str) -> dict[str, Any]:
    return get_push_job_status(jobs_state, job_id)


def hf_token_read(token_file: Path | None = None, config_dir: Path | None = None) -> dict[str, Any]:
    return get_hf_token_status(_resolve_hf_token_file(token_file, config_dir=config_dir))


def hf_token_write(token: str, token_file: Path | None = None, config_dir: Path | None = None) -> dict[str, Any]:
    return set_hf_token(_resolve_hf_token_file(token_file, config_dir=config_dir), token)
