# pyright: reportMissingImports=false

from __future__ import annotations

import inspect
from pathlib import Path

from lestudio.capabilities import get_capability
import lestudio.routes.process as process_routes
import lestudio.routes.training as training_routes
from lestudio.server import create_app
import lestudio.services.dataset_service as dataset_service
import lestudio.services.process_service as process_service
import lestudio.services.training_service as training_service


def test_process_service_exports_expected_entrypoints():
    expected = {
        "run_preflight",
        "calibrate_file_status",
        "calibrate_list",
        "calibrate_validate",
        "calibrate_delete",
        "start_teleop",
        "start_record",
        "start_calibrate",
        "start_motor_setup",
        "_guard_process_start",
    }

    for name in expected:
        assert hasattr(process_service, name), f"process_service missing export: {name}"


def test_training_service_exports_expected_entrypoints():
    expected = {
        "train_preflight",
        "deps_status",
        "train_start",
        "_ensure_train_installer",
    }

    for name in expected:
        assert hasattr(training_service, name), f"training_service missing export: {name}"


def test_dataset_service_exports_expected_entrypoints():
    expected = {
        "list_datasets",
        "get_dataset_info",
        "delete_dataset",
        "run_quality_check",
    }

    for name in expected:
        assert hasattr(dataset_service, name), f"dataset_service missing export: {name}"


def test_process_route_module_does_not_define_service_domain_functions():
    src = inspect.getsource(process_routes)

    assert "def _guard_process_start(" not in src
    assert "def run_preflight(" not in src
    assert "def calibrate_file_status(" not in src
    assert "def calibrate_list(" not in src
    assert "def calibrate_validate(" not in src
    assert "def calibrate_delete(" not in src
    assert "def start_teleop(" not in src
    assert "def start_record(" not in src
    assert "def start_calibrate(" not in src
    assert "def start_motor_setup(" not in src


def test_training_route_module_does_not_define_service_domain_functions():
    src = inspect.getsource(training_routes)

    assert "def train_preflight(" not in src
    assert "def deps_status(" not in src
    assert "def train_start(" not in src
    assert "def _ensure_train_installer(" not in src


def _make_app(tmp_path: Path):
    lerobot_src = tmp_path / "lerobot_src"
    (lerobot_src / "lerobot").mkdir(parents=True)
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    rules_path = tmp_path / "99-lerobot.rules"
    return create_app(lerobot_src=lerobot_src, config_dir=config_dir, rules_path=rules_path)


def test_all_mutating_routes_are_capability_protected(tmp_path: Path):
    app = _make_app(tmp_path)
    mutating_methods = {"POST", "PUT", "DELETE"}
    missing: list[str] = []

    for route in app.routes:
        path = getattr(route, "path", "")
        methods = set(getattr(route, "methods", set()) or set())
        if not path.startswith("/api/"):
            continue
        if not (methods & mutating_methods):
            continue
        if get_capability(path) is None:
            missing.append(f"{path} [{','.join(sorted(methods & mutating_methods))}]")

    assert not missing, f"Mutating routes missing capabilities: {missing}"
