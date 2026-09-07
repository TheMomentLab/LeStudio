# pyright: reportMissingImports=false

from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest

from lestudio.calibration_validator import (
    EXPECTED_JOINTS_SO,
    MIN_USEFUL_SPAN,
    POSITION_MAX,
    validate_and_cross_validate,
    validate_calibration_file,
)


def _valid_so_calibration() -> dict[str, dict[str, int]]:
    return {
        "shoulder_pan": {"id": 1, "drive_mode": 0, "homing_offset": 1654, "range_min": 815, "range_max": 3536},
        "shoulder_lift": {
            "id": 2,
            "drive_mode": 0,
            "homing_offset": 1145,
            "range_min": 1021,
            "range_max": 3352,
        },
        "elbow_flex": {"id": 3, "drive_mode": 0, "homing_offset": 2043, "range_min": 735, "range_max": 3235},
        "wrist_flex": {"id": 4, "drive_mode": 0, "homing_offset": 2084, "range_min": 802, "range_max": 3138},
        "wrist_roll": {"id": 5, "drive_mode": 0, "homing_offset": 2033, "range_min": 820, "range_max": 3302},
        "gripper": {"id": 6, "drive_mode": 0, "homing_offset": 2050, "range_min": 1580, "range_max": 2780},
    }


def _write_calibration(path: Path, data: Mapping[str, Any]) -> Path:
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _error_codes(result) -> set[str]:
    return {issue.code.lower() for issue in result.errors}


def _warning_codes(result) -> set[str]:
    return {issue.code.lower() for issue in result.warnings}


def test_validate_calibration_file_valid_six_joint_file(tmp_path: Path):
    file_path = _write_calibration(tmp_path / "valid.json", _valid_so_calibration())

    result = validate_calibration_file(file_path)

    assert result.ok is True
    assert result.errors == []
    assert result.warnings == []


def test_validate_calibration_file_missing_joint_reports_error(tmp_path: Path):
    payload = _valid_so_calibration()
    _ = payload.pop("gripper")
    file_path = _write_calibration(tmp_path / "missing_joint.json", payload)

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert any(code.startswith("missing_joint") for code in _error_codes(result))


@pytest.mark.xfail(reason="homing_offset bounds are not currently validated", strict=False)
def test_validate_calibration_file_homing_offset_out_of_range_reports_error(tmp_path: Path):
    payload = _valid_so_calibration()
    payload["shoulder_pan"]["homing_offset"] = POSITION_MAX + 1
    file_path = _write_calibration(tmp_path / "homing_offset_out_of_range.json", payload)

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert any("homing_offset" in code for code in _error_codes(result))


def test_validate_calibration_file_invalid_drive_mode_reports_error(tmp_path: Path):
    payload = _valid_so_calibration()
    payload["wrist_roll"]["drive_mode"] = 9
    file_path = _write_calibration(tmp_path / "invalid_drive_mode.json", payload)

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert "invalid_drive_mode" in _error_codes(result)


def test_validate_calibration_file_inverted_range_reports_error(tmp_path: Path):
    payload = _valid_so_calibration()
    payload["elbow_flex"]["range_min"] = 2000
    payload["elbow_flex"]["range_max"] = 2000
    file_path = _write_calibration(tmp_path / "inverted_range.json", payload)

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert "inverted_range" in _error_codes(result)


def test_validate_calibration_file_narrow_span_reports_warning(tmp_path: Path):
    payload = _valid_so_calibration()
    payload["wrist_flex"]["range_min"] = 1000
    payload["wrist_flex"]["range_max"] = 1000 + (MIN_USEFUL_SPAN - 1)
    file_path = _write_calibration(tmp_path / "narrow_span.json", payload)

    result = validate_calibration_file(file_path)

    assert result.ok is True
    assert "narrow_span" in _warning_codes(result)


def test_validate_calibration_file_non_existent_path_reports_error(tmp_path: Path):
    result = validate_calibration_file(tmp_path / "does_not_exist.json")

    assert result.ok is False
    assert "file_not_found" in _error_codes(result)


def test_validate_calibration_file_invalid_json_reports_error(tmp_path: Path):
    file_path = tmp_path / "invalid.json"
    file_path.write_text("{", encoding="utf-8")

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert "parse_error" in _error_codes(result)


def test_validate_calibration_file_empty_file_reports_error(tmp_path: Path):
    file_path = tmp_path / "empty.json"
    file_path.write_text("", encoding="utf-8")

    result = validate_calibration_file(file_path)

    assert result.ok is False
    assert len(result.errors) > 0


def test_validate_calibration_file_omx_bypasses_so_joint_schema(tmp_path: Path):
    file_path = _write_calibration(tmp_path / "omx.json", {"custom_joint": {"anything": 1}})

    result = validate_calibration_file(file_path, device_type="omx_follower")

    assert result.ok is True
    assert result.errors == []


def test_validate_calibration_file_generic_json_still_requires_parseable_dict(tmp_path: Path):
    file_path = _write_calibration(tmp_path / "generic.json", {"custom_joint": {"value": 1}})

    result = validate_calibration_file(file_path, device_type="custom_unknown")

    assert result.ok is True
    assert result.errors == []


def test_validate_and_cross_validate_omx_pair_skips_so_cross_checks(tmp_path: Path):
    leader_path = _write_calibration(tmp_path / "omx_leader.json", {"leader_joint": {"anything": 1}})
    follower_path = _write_calibration(tmp_path / "omx_follower.json", {"follower_joint": {"anything": 2}})

    result = validate_and_cross_validate(
        leader_path,
        follower_path,
        leader_type="omx_leader",
        follower_type="omx_follower",
    )

    assert result["leader"]["ok"] is True
    assert result["follower"]["ok"] is True
    assert result["cross"]["warnings"] == []


def test_validate_and_cross_validate_matching_pair_has_no_cross_warnings(tmp_path: Path):
    valid = _valid_so_calibration()
    leader_path = _write_calibration(tmp_path / "leader.json", valid)
    follower_path = _write_calibration(tmp_path / "follower.json", copy.deepcopy(valid))

    result = validate_and_cross_validate(leader_path, follower_path)

    assert result["leader"]["ok"] is True
    assert result["follower"]["ok"] is True
    assert result["cross"]["warnings"] == []


def test_validate_and_cross_validate_asymmetric_spans_report_warning(tmp_path: Path):
    leader = _valid_so_calibration()
    follower = _valid_so_calibration()
    follower["shoulder_pan"]["range_min"] = 1000
    follower["shoulder_pan"]["range_max"] = 1200

    leader_path = _write_calibration(tmp_path / "leader_asym.json", leader)
    follower_path = _write_calibration(tmp_path / "follower_asym.json", follower)

    result = validate_and_cross_validate(leader_path, follower_path)

    warning_codes = {issue["code"].lower() for issue in result["cross"]["warnings"]}
    assert "span_asymmetry" in warning_codes


def test_expected_joint_constant_still_models_six_joint_so_arm():
    assert set(EXPECTED_JOINTS_SO) == {
        "shoulder_pan",
        "shoulder_lift",
        "elbow_flex",
        "wrist_flex",
        "wrist_roll",
        "gripper",
    }
