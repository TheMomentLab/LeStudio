from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path

import lestudio.routes.training as training_routes
from lestudio.server import create_app


def _make_app(tmp_path: Path):
    lerobot_src = tmp_path / "lerobot_src"
    (lerobot_src / "lerobot").mkdir(parents=True)
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    rules_path = tmp_path / "99-lerobot.rules"
    return create_app(lerobot_src=lerobot_src, config_dir=config_dir, rules_path=rules_path)


def _find_endpoint(app, path: str, method: str):
    method = method.upper()
    for route in app.routes:
        if getattr(route, "path", None) != path:
            continue
        methods = getattr(route, "methods", set()) or set()
        if method in methods:
            return route.endpoint
    raise AssertionError(f"Route not found: {method} {path}")


def test_api_proc_stop_train_stops_train_and_installer(monkeypatch, tmp_path: Path):
    stopped: list[str] = []
    unlocked = {"called": False}

    def fake_stop(self, name: str):
        stopped.append(name)

    def fake_unlock():
        unlocked["called"] = True

    monkeypatch.setattr("lestudio.process_manager.ProcessManager.stop", fake_stop)
    monkeypatch.setattr("lestudio.routes.process.unlock_cameras", fake_unlock)

    app = _make_app(tmp_path)
    endpoint = _find_endpoint(app, "/api/process/{name}/stop", "POST")
    payload = endpoint("train")

    assert payload["ok"] is True
    assert payload["stopped"] == ["train_install", "train"]
    assert stopped == ["train_install", "train"]
    assert unlocked["called"] is True


def test_api_record_start_stops_streamers_and_injects_camera_settings(monkeypatch, tmp_path: Path):
    captured: dict[str, object] = {"stop_calls": 0}

    monkeypatch.setattr("lestudio.process_manager.ProcessManager.is_running", lambda self, name: False)
    monkeypatch.setattr("lestudio.process_manager.ProcessManager.conflicting_processes", lambda self, name: [])

    def fake_start(self, name: str, args: list[str]) -> bool:
        captured["name"] = name
        captured["args"] = args
        return True

    def fake_stop_streamers():
        captured["stop_calls"] = int(captured["stop_calls"]) + 1

    def fake_build_args(python_exe: str, cfg: dict, resume_enabled: bool):
        captured["cfg"] = dict(cfg)
        captured["resume_enabled"] = resume_enabled
        return [python_exe, "-m", "fake_record"]

    monkeypatch.setattr("lestudio.process_manager.ProcessManager.start", fake_start)
    monkeypatch.setattr("lestudio.routes.process.stop_all_streamers_for_process", fake_stop_streamers)
    monkeypatch.setattr("lestudio.routes.process.resolve_record_resume", lambda cfg: (False, False))
    monkeypatch.setattr(
        "lestudio.routes.process._get_cam_settings",
        lambda config_path: {"width": 960, "height": 540, "fps": 25},
    )
    monkeypatch.setattr("lestudio.routes.process.build_record_args", fake_build_args)

    app = _make_app(tmp_path)
    endpoint = _find_endpoint(app, "/api/record/start", "POST")
    payload = asyncio.run(endpoint({"record_repo_id": "user/ds", "record_task": "pick"}))

    assert payload["ok"] is True
    assert payload["resume_requested"] is False
    assert payload["resume_enabled"] is False
    assert captured["stop_calls"] == 1
    assert captured["name"] == "record"

    cfg = captured["cfg"]
    assert isinstance(cfg, dict)
    assert cfg["record_cam_width"] == 960
    assert cfg["record_cam_height"] == 540
    assert cfg["record_cam_fps"] == 25


def test_snapshot_camera_returns_streamer_frame(monkeypatch, tmp_path: Path):
    monkeypatch.setattr("lestudio.process_manager.ProcessManager.is_running", lambda self, name: False)
    monkeypatch.setattr("lestudio._streaming.snapshot_get_frame", lambda video_path, config_path: b"jpeg-bytes")

    app = _make_app(tmp_path)
    endpoint = _find_endpoint(app, "/api/camera/snapshot/{video_name}", "GET")
    response = asyncio.run(endpoint("video0"))

    assert response.status_code == 200
    assert response.media_type == "image/jpeg"
    assert response.body == b"jpeg-bytes"


def test_snapshot_camera_returns_503_when_frame_unavailable(monkeypatch, tmp_path: Path):
    async def _fast_sleep(_seconds: float):
        return None

    monkeypatch.setattr("lestudio.process_manager.ProcessManager.is_running", lambda self, name: False)
    monkeypatch.setattr("lestudio._streaming.snapshot_get_frame", lambda video_path, config_path: None)
    monkeypatch.setattr("lestudio.routes.streaming.asyncio.sleep", _fast_sleep)

    app = _make_app(tmp_path)
    endpoint = _find_endpoint(app, "/api/camera/snapshot/{video_name}", "GET")
    response = asyncio.run(endpoint("video0"))

    assert response.status_code == 503


def test_train_preflight_cache_is_used_and_invalidated(monkeypatch, tmp_path: Path):
    training_routes._preflight_cache.clear()
    calls = {"cuda": 0}

    monkeypatch.setattr("lestudio.process_manager.ProcessManager.is_running", lambda self, name: False)
    monkeypatch.setattr("lestudio.process_manager.ProcessManager.start", lambda self, name, args: True)
    monkeypatch.setattr("lestudio.routes.training._check_train_python_deps", lambda python_exe: {"ok": True})

    def fake_cuda_compat(_python_exe: str):
        calls["cuda"] += 1
        return False, "cuda mismatch"

    monkeypatch.setattr("lestudio.routes.training._check_cuda_runtime_compat", fake_cuda_compat)
    monkeypatch.setattr("lestudio.routes.training._build_torch_install_args", lambda python_exe, cuda_tag, nightly: ["pip", "install", "torch"])
    monkeypatch.setattr("lestudio.routes.training._format_cmd", lambda args: "pip install torch")

    app = _make_app(tmp_path)
    preflight = _find_endpoint(app, "/api/train/preflight", "GET")
    install = _find_endpoint(app, "/api/train/install_pytorch", "POST")

    first = preflight("cuda")
    second = preflight("cuda")
    assert first["ok"] is False
    assert second["ok"] is False
    assert calls["cuda"] == 1
    assert training_routes._preflight_cache

    payload = asyncio.run(install({"nightly": True, "cuda_tag": "cu128"}))
    assert payload["ok"] is True
    assert training_routes._preflight_cache == {}
    training_routes._preflight_cache.clear()


def test_hf_whoami_cache_is_token_scoped(monkeypatch, tmp_path: Path):
    calls = {"count": 0}

    def fake_whoami(*, token: str):
        calls["count"] += 1
        return {"name": f"user-{token}"}

    monkeypatch.setitem(sys.modules, "huggingface_hub", types.SimpleNamespace(whoami=fake_whoami))
    monkeypatch.setenv("HF_TOKEN", "token-a")

    app = _make_app(tmp_path)
    endpoint = _find_endpoint(app, "/api/hf/whoami", "GET")

    first = endpoint()
    second = endpoint()
    assert first == {"ok": True, "username": "user-token-a"}
    assert second == {"ok": True, "username": "user-token-a"}
    assert calls["count"] == 1

    monkeypatch.setenv("HF_TOKEN", "token-b")
    third = endpoint()
    assert third == {"ok": True, "username": "user-token-b"}
    assert calls["count"] == 2
