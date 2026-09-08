from __future__ import annotations

from pathlib import Path

from _routing import iter_routes
from fastapi import FastAPI

from lerobot_doctor.server import create_app as create_doctor_app
from lestudio.server import create_app as create_studio_app


def _paths(app: FastAPI) -> set[str]:
    return {getattr(route, "path", "") for route in iter_routes(app)}


def _make(tmp_path: Path, factory):
    lerobot_src = tmp_path / "lerobot_src"
    (lerobot_src / "lerobot").mkdir(parents=True)
    return factory(lerobot_src=lerobot_src, config_dir=tmp_path / "cfg", rules_path=tmp_path / "rules")


HARDWARE = {"/api/devices", "/api/config", "/api/rules/preview", "/api/motor/connect", "/api/calibrate/start", "/api/motor_setup/start", "/api/process/{name}/status", "/api/camera/stats", "/ws"}
WORKFLOW = {"/api/preflight", "/api/teleop/start", "/api/record/start", "/api/process/{name}/command", "/api/train/start", "/api/eval/start", "/api/hf/whoami"}


def test_doctor_app_serves_hardware_routes_only(tmp_path: Path):
    app = _make(tmp_path, create_doctor_app)
    paths = _paths(app)
    assert HARDWARE <= paths
    assert not (WORKFLOW & paths)
    assert app.title == "lerobot-doctor"
    assert app.state.session_token


def test_studio_app_adds_workflow_routes_on_top(tmp_path: Path):
    app = _make(tmp_path, create_studio_app)
    paths = _paths(app)
    assert HARDWARE <= paths
    assert WORKFLOW <= paths
    assert app.title == "LeStudio"
