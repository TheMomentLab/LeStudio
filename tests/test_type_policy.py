from __future__ import annotations

from lestudio import type_policy as tp


def test_get_type_policy_for_omx_follower():
    policy = tp.get_type_policy("omx_follower")

    assert policy.type_name == "omx_follower"
    assert policy.registry_kind == "robot"
    assert policy.family_id == "omx"
    assert policy.role == "follower"
    assert policy.pairing.canonical_robot_type == "omx_follower"
    assert policy.pairing.canonical_teleop_type == "omx_leader"
    assert policy.calibration.requirement == "optional"
    assert policy.calibration.enforcement.preflight == "skip"
    assert policy.calibration.enforcement.eval_real_robot == "skip"
    assert policy.calibration.enforcement.ui == "optional"
    assert policy.calibration.validator_id == "none"
    assert policy.motor_setup.supported is True
    assert policy.bimanual.supported is False


def test_get_type_policy_for_so101_follower():
    policy = tp.get_type_policy("so101_follower")

    assert policy.type_name == "so101_follower"
    assert policy.registry_kind == "robot"
    assert policy.family_id == "so"
    assert policy.role == "follower"
    assert policy.pairing.canonical_robot_type == "so101_follower"
    assert policy.pairing.canonical_teleop_type == "so101_leader"
    assert policy.calibration.requirement == "required"
    assert policy.calibration.enforcement.preflight == "warn"
    assert policy.calibration.enforcement.eval_real_robot == "block"
    assert policy.calibration.enforcement.ui == "required"
    assert policy.calibration.validator_id == "feetech_sts3215"
    assert policy.motor_setup.supported is True


def test_get_type_policy_for_omx_leader():
    policy = tp.get_type_policy("omx_leader")

    assert policy.registry_kind == "teleop"
    assert policy.family_id == "omx"
    assert policy.role == "leader"
    assert policy.pairing.canonical_robot_type == "omx_follower"
    assert policy.pairing.canonical_teleop_type == "omx_leader"


def test_get_type_policy_unknown_type_uses_safe_fallback():
    policy = tp.get_type_policy("custom_unknown")

    assert policy.type_name == "custom_unknown"
    assert policy.family_id == "unknown"
    assert policy.registry_kind == "robot"
    assert policy.calibration.requirement == "required"
    assert policy.calibration.validator_id == "generic_json"
    assert policy.motor_setup.supported is False
    assert policy.pairing.canonical_robot_type == "custom_unknown"
    assert policy.pairing.canonical_teleop_type == ""


def test_get_defaults_for_mode_returns_expected_pairs():
    single = tp.get_defaults_for_mode("single")
    bi = tp.get_defaults_for_mode("bi")

    assert single.robot_type == "so101_follower"
    assert single.teleop_type == "so101_leader"
    assert bi.robot_type == "bi_so_follower"
    assert bi.teleop_type == "bi_so_leader"


def test_get_calibration_source_types_handles_bimanual_and_single_types():
    assert tp.get_calibration_source_types("bi_so_follower") == ["so101_follower", "so100_follower"]
    assert tp.get_calibration_source_types("bi_so_leader") == ["so101_leader", "so100_leader"]
    assert tp.get_calibration_source_types("bi_openarm_follower") == ["openarm_follower"]
    assert tp.get_calibration_source_types("omx_follower") == ["omx_follower"]


def test_supports_motor_setup_and_calibration_requirement_helpers():
    assert tp.supports_motor_setup("omx_leader") is True
    assert tp.supports_motor_setup("bi_so_follower") is False
    assert tp.get_calibration_validator("so101_follower") == "feetech_sts3215"
    assert tp.get_calibration_validator("omx_follower") == "none"
    assert tp.get_calibration_validator("custom_unknown") == "generic_json"
    assert tp.is_calibration_required("so101_follower", context="preflight") is True
    assert tp.is_calibration_required("omx_follower", context="preflight") is False
    assert tp.is_calibration_required("omx_follower", context="eval_real_robot") is False
