# pyright: reportMissingImports=false

from __future__ import annotations

import inspect

import lestudio.routes.process as process_routes
import lestudio.routes.training as training_routes
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
