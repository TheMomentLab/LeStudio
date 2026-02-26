"""Training, evaluation, deps, and checkpoint routes."""
from __future__ import annotations

import datetime
import time
import json
import shutil
from pathlib import Path

from fastapi import APIRouter

from lestudio.command_builders import build_eval_args, build_train_args
from lestudio._train_helpers import (
    _build_torch_install_args,
    _check_cuda_runtime_compat,
    _check_torchcodec_compat,
    _check_train_python_deps,
    _format_cmd,
    _parse_install_args,
)
from lestudio.routes._state import AppState

# ─── Preflight 서버 캐시 ─────────────────────────────────────────────────────────
_TTL_PREFLIGHT_OK = 120.0    # ok: True  → 2분 (CUDA 호환성은 설치 전후로만 바넨)
_TTL_PREFLIGHT_FAIL = 20.0   # ok: False + action 있음 → 20초 (유저 조치 후 쳤캐리 재확인 가능)
# ok: False + action 없음(서브프로세스 타임아웃 등 일시적 오류) → 캐싱 안 함
_preflight_cache: dict[str, tuple[dict, float]] = {}


def _preflight_cache_get(key: str) -> dict | None:
    entry = _preflight_cache.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    return None


def _preflight_cache_set(key: str, result: dict) -> None:
    if result.get("ok"):
        ttl = _TTL_PREFLIGHT_OK
    elif result.get("action"):  # 실제 실패: 유저가 조치해야 하는 아이템
        ttl = _TTL_PREFLIGHT_FAIL
    else:
        return  # subprocess 타임아웃/파싱 오류 등 일시적 문제 → 캐싱 안 함
    _preflight_cache[key] = (result, time.monotonic() + ttl)


def _preflight_cache_invalidate() -> None:
    _preflight_cache.clear()


def _ensure_train_installer(state: AppState, command: str) -> tuple[bool, bool]:
    """Start the train_install process if not already running. Returns (ok, already_running)."""
    if state.proc_mgr.is_running("train_install"):
        return True, True
    args = _parse_install_args(command, state.python_exe)
    if not args:
        return False, False
    return state.proc_mgr.start("train_install", args), False

def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.get("/api/train/preflight")
    def api_train_preflight(device: str = "cuda"):
        dev = (device or "cuda").lower()
        cache_key = f"preflight:{dev}"

        cached = _preflight_cache_get(cache_key)
        if cached is not None:
            return cached

        deps = _check_train_python_deps(state.python_exe)
        if not deps.get("ok"):
            result = {
                "ok": False,
                "reason": deps.get("reason", "Training dependency check failed."),
                "action": deps.get("action", "install_python_dep"),
                "command": deps.get("command", ""),
            }
            _preflight_cache_set(cache_key, result)
            return result

        if dev != "cuda":
            # non-CUDA: CUDA 체크 스킵, torchcodec만 확인
            tc = _check_torchcodec_compat(state.python_exe)
            if tc.get("ok"):
                result = {"ok": True, "reason": f"{dev.upper()} selected. {tc['reason']}"}
                _preflight_cache_set(cache_key, result)
                return result
            cause = tc.get("cause", "unknown")
            action_map = {"missing_cuda_toolkit": "install_cuda_toolkit", "missing_ffmpeg": "install_ffmpeg", "version_mismatch": "install_torchcodec"}
            result = {
                "ok": False,
                "reason": tc.get("reason", "torchcodec check failed."),
                "action": action_map.get(cause, "install_torchcodec"),
                "command": tc.get("command", ""),
            }
            _preflight_cache_set(cache_key, result)
            return result

        ok, reason = _check_cuda_runtime_compat(state.python_exe)
        if not ok:
            install_args = _build_torch_install_args(state.python_exe, cuda_tag="cu128", nightly=True)
            result = {
                "ok": False,
                "reason": f"{reason} Switch Compute Device to CPU/MPS or install a CUDA-compatible PyTorch build.",
                "action": "install_torch_cuda",
                "command": _format_cmd(install_args),
            }
            _preflight_cache_set(cache_key, result)
            return result

        # CUDA OK → torchcodec 체크
        tc = _check_torchcodec_compat(state.python_exe)
        if tc.get("ok"):
            result = {"ok": True, "reason": f"{reason} | {tc['reason']}"}
            _preflight_cache_set(cache_key, result)
            return result
        cause = tc.get("cause", "unknown")
        action_map = {"missing_cuda_toolkit": "install_cuda_toolkit", "missing_ffmpeg": "install_ffmpeg", "version_mismatch": "install_torchcodec"}
        result = {
            "ok": False,
            "reason": tc.get("reason", "torchcodec check failed."),
            "action": action_map.get(cause, "install_torchcodec"),
            "command": tc.get("command", ""),
        }
        _preflight_cache_set(cache_key, result)
        return result
    @router.get("/api/deps/status")
    def api_deps_status():
        return {
            "ok": True,
            "huggingface_cli": bool(shutil.which("huggingface-cli")),
        }

    @router.post("/api/train/install_pytorch")
    async def api_train_install_pytorch(data: dict | None = None):
        if state.proc_mgr.is_running("train"):
            return {"ok": False, "error": "Stop training before installing PyTorch."}
        if state.proc_mgr.is_running("train_install"):
            return {"ok": False, "error": "PyTorch installer is already running."}

        payload = data or {}
        cuda_tag = str(payload.get("cuda_tag", "cu128")).strip() or "cu128"
        nightly = bool(payload.get("nightly", True))
        args = _build_torch_install_args(state.python_exe, cuda_tag=cuda_tag, nightly=nightly)

        ok = state.proc_mgr.start("train_install", args)
        if ok:
            _preflight_cache_invalidate()  # 설치 시작 시 preflight 캐시 무효화
        return {
            "ok": ok,
            "command": _format_cmd(args),
            "error": None if ok else "Failed to launch installer process.",
        }

    @router.post("/api/train/install_torchcodec_fix")
    async def api_train_install_torchcodec_fix(data: dict | None = None):
        if state.proc_mgr.is_running("train"):
            return {"ok": False, "error": "Stop training before installing."}
        if state.proc_mgr.is_running("train_install"):
            return {"ok": False, "error": "Another installer is already running."}
        payload = data or {}
        command = str(payload.get("command", "")).strip()
        if not command:
            return {"ok": False, "error": "No install command provided."}
        args = _parse_install_args(command, state.python_exe)
        if not args:
            return {"ok": False, "error": "Invalid install command."}
        ok = state.proc_mgr.start("train_install", args)
        if ok:
            _preflight_cache_invalidate()  # 설치 시작 시 preflight 캐시 무효화
        return {
            "ok": ok,
            "command": " ".join(args),
            "error": None if ok else "Failed to launch installer process.",
        }

    @router.post("/api/train/start")
    async def api_train_start(data: dict):
        if state.proc_mgr.is_running("train"):
            return {"ok": False, "error": "Already running"}
        conflicts = state.proc_mgr.conflicting_processes("train")
        if conflicts:
            return {"ok": False, "error": f"Cannot start: {', '.join(conflicts)} is using shared hardware"}

        deps = _check_train_python_deps(state.python_exe)
        if not deps.get("ok"):
            command = str(deps.get("command", "")).strip()
            reason = str(deps.get("reason", "Missing required Python package for training.")).strip()
            ok_install, already_running = _ensure_train_installer(state, command)
            if ok_install:
                status = "already running" if already_running else "started"
                return {
                    "ok": False,
                    "error": f"{reason} Auto-install {status} in background. Retry training after installer finishes.",
                    "auto_install_started": True,
                }
            return {
                "ok": False,
                "error": f"{reason} Auto-install could not be started. Open Train tab and retry install once.",
            }

        tc = _check_torchcodec_compat(state.python_exe)
        if not tc.get("ok"):
            command = str(tc.get("command", "")).strip()
            reason = str(tc.get("reason", "torchcodec check failed.")).strip()
            ok_install, already_running = _ensure_train_installer(state, command)
            if ok_install:
                status = "already running" if already_running else "started"
                return {
                    "ok": False,
                    "error": f"{reason} Auto-install {status} in background. Retry training after installer finishes.",
                    "auto_install_started": True,
                }
            return {
                "ok": False,
                "error": f"{reason} Auto-install could not be started. Open Train tab and retry install once.",
            }

        train_device = str(data.get("train_device", "cuda")).lower()
        if train_device == "cuda":
            ok, reason = _check_cuda_runtime_compat(state.python_exe)
            if not ok:
                return {
                    "ok": False,
                    "error": f"{reason} Switch Compute Device to CPU/MPS or install a CUDA-compatible PyTorch build.",
                }

        args = build_train_args(state.python_exe, data)
        ok = state.proc_mgr.start("train", args)
        if ok:
            state.append_history("train_start", {
                "policy": data.get("train_policy", ""),
                "repo_id": data.get("train_repo_id", ""),
                "steps": data.get("train_steps", ""),
                "device": data.get("train_device", ""),
            })
        return {"ok": ok}

    @router.get("/api/checkpoints")
    def api_checkpoints():
        """Scan outputs/train/ for available checkpoints (flat & timestamped runs)."""
        results = []
        seen_paths = set()

        def _scan_checkpoints_dir(ckpts_dir: Path, run_name: str = ""):
            if not ckpts_dir.is_dir():
                return
            for entry in ckpts_dir.iterdir():
                if not entry.is_dir():
                    continue
                # Resolve symlinks (e.g. 'last' -> '005000')
                resolved = entry.resolve() if entry.is_symlink() else entry
                pretrained = resolved / "pretrained_model"
                if not pretrained.is_dir():
                    continue
                real_path = str(pretrained)
                if real_path in seen_paths:
                    continue
                seen_paths.add(real_path)
                name = entry.name
                display = f"{run_name}/{name}" if run_name else name
                ckpt = {
                    "name": name,
                    "display": display,
                    "path": str(entry / "pretrained_model"),
                    "step": None,
                    "policy": None,
                    "size_mb": 0,
                    "has_config": (pretrained / "config.json").exists(),
                    "has_model": any(pretrained.glob("*.safetensors")) or any(pretrained.glob("*.bin")),
                    "is_symlink": entry.is_symlink(),
                    "modified": None,
                }

                # Parse step from directory name (e.g. '010000')
                try:
                    ckpt["step"] = int(name)
                except ValueError:
                    pass

                # Read exact step from training_state/training_step.json
                step_file = resolved / "training_state" / "training_step.json"
                if step_file.exists():
                    try:
                        step_data = json.loads(step_file.read_text())
                        if isinstance(step_data.get("step"), (int, float)):
                            ckpt["step"] = int(step_data["step"])
                    except Exception:
                        pass

                # Read policy type from pretrained_model/train_config.json
                train_cfg = pretrained / "train_config.json"
                if train_cfg.exists():
                    try:
                        tc = json.loads(train_cfg.read_text())
                        ckpt["policy"] = tc.get("policy", {}).get("type") or tc.get("policy_type")
                    except Exception:
                        pass

                # Calculate size and modification time
                total_bytes = 0
                latest_mtime = 0
                for f in pretrained.rglob("*"):
                    if f.is_file():
                        st = f.stat()
                        total_bytes += st.st_size
                        if st.st_mtime > latest_mtime:
                            latest_mtime = st.st_mtime
                ckpt["size_mb"] = round(total_bytes / (1024 * 1024), 1)
                if latest_mtime > 0:
                    ckpt["modified"] = datetime.datetime.fromtimestamp(
                        latest_mtime, tz=datetime.timezone.utc
                    ).isoformat()

                results.append(ckpt)

        # Pattern 1: outputs/train/checkpoints/ (flat)
        _scan_checkpoints_dir(Path("outputs/train/checkpoints"))

        # Pattern 2: outputs/train/<run_name>/checkpoints/ (timestamped)
        train_root = Path("outputs/train")
        if train_root.is_dir():
            for run_dir in train_root.iterdir():
                if run_dir.name == "checkpoints":
                    continue  # already scanned above
                if run_dir.is_dir():
                    _scan_checkpoints_dir(run_dir / "checkpoints", run_dir.name)

        # Sort: 'last' first, then by step descending, then by modified
        def sort_key(c):
            if c["name"] == "last":
                return (0, 0, "")
            if c["name"] == "best":
                return (1, 0, "")
            return (2, -(c["step"] or 0), c["modified"] or "")
        results.sort(key=sort_key)

        return {"ok": True, "checkpoints": results}

    @router.post("/api/eval/start")
    async def api_eval_start(data: dict):
        if state.proc_mgr.is_running("eval"):
            return {"ok": False, "error": "Already running"}
        conflicts = state.proc_mgr.conflicting_processes("eval")
        if conflicts:
            return {"ok": False, "error": f"Cannot start: {', '.join(conflicts)} is using shared hardware"}

        deps = _check_train_python_deps(state.python_exe)
        if not deps.get("ok"):
            command = str(deps.get("command", "")).strip()
            reason = str(deps.get("reason", "Missing required Python package for evaluation.")).strip()
            ok_install, already_running = _ensure_train_installer(state, command)
            if ok_install:
                status = "already running" if already_running else "started"
                return {
                    "ok": False,
                    "error": f"{reason} Auto-install {status} in background. Retry evaluation after installer finishes.",
                    "auto_install_started": True,
                }
            return {
                "ok": False,
                "error": f"{reason} Auto-install could not be started. Open Eval tab and retry install once.",
            }

        tc = _check_torchcodec_compat(state.python_exe)
        if not tc.get("ok"):
            command = str(tc.get("command", "")).strip()
            reason = str(tc.get("reason", "torchcodec check failed.")).strip()
            ok_install, already_running = _ensure_train_installer(state, command)
            if ok_install:
                status = "already running" if already_running else "started"
                return {
                    "ok": False,
                    "error": f"{reason} Auto-install {status} in background. Retry evaluation after installer finishes.",
                    "auto_install_started": True,
                }
            return {
                "ok": False,
                "error": f"{reason} Auto-install could not be started. Open Eval tab and retry install once.",
            }

        eval_device = str(data.get("eval_device", "cuda")).lower()
        if eval_device == "cuda":
            ok, reason = _check_cuda_runtime_compat(state.python_exe)
            if not ok:
                return {
                    "ok": False,
                    "error": f"{reason} Switch Compute Device to CPU/MPS or install a CUDA-compatible PyTorch build.",
                }

        args = build_eval_args(state.python_exe, data)
        ok = state.proc_mgr.start("eval", args)
        if ok:
            state.append_history("eval_start", {
                "policy_path": data.get("eval_policy_path", ""),
                "device": data.get("eval_device", ""),
            })
        return {"ok": ok}

    return router
