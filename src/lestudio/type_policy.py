from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from typing import Literal

RegistryKind = Literal["robot", "teleop"]
Role = Literal["follower", "leader", "other", "unknown"]
CalibrationRequirement = Literal["required", "optional", "none"]
CalibrationEnforcementMode = Literal["error", "warn", "skip", "block", "required", "optional", "hidden"]
CalibrationContext = Literal["preflight", "eval_real_robot"]


@dataclass(frozen=True)
class PairingPolicy:
    canonical_robot_type: str
    canonical_teleop_type: str


@dataclass(frozen=True)
class CalibrationEnforcement:
    preflight: Literal["error", "warn", "skip"]
    eval_real_robot: Literal["block", "skip"]
    ui: Literal["required", "optional", "hidden"]


@dataclass(frozen=True)
class CalibrationPolicy:
    requirement: CalibrationRequirement
    enforcement: CalibrationEnforcement
    validator_id: str


@dataclass(frozen=True)
class MotorSetupPolicy:
    supported: bool


@dataclass(frozen=True)
class BimanualPolicy:
    supported: bool
    group_type: str = ""


@dataclass(frozen=True)
class ModeDefaults:
    robot_type: str
    teleop_type: str


@dataclass(frozen=True)
class TypePolicy:
    type_name: str
    registry_kind: RegistryKind
    family_id: str
    role: Role
    pairing: PairingPolicy
    calibration: CalibrationPolicy
    motor_setup: MotorSetupPolicy
    bimanual: BimanualPolicy


DEFAULT_SINGLE = ModeDefaults(robot_type="so101_follower", teleop_type="so101_leader")
DEFAULT_BI = ModeDefaults(robot_type="bi_so_follower", teleop_type="bi_so_leader")

MOTOR_SETUP_COMPATIBLE_TYPES = frozenset(
    {
        "koch_follower",
        "koch_leader",
        "omx_follower",
        "omx_leader",
        "so100_follower",
        "so100_leader",
        "so101_follower",
        "so101_leader",
        "lekiwi",
    }
)


def _required_calibration(validator_id: str = "generic_json") -> CalibrationPolicy:
    return CalibrationPolicy(
        requirement="required",
        enforcement=CalibrationEnforcement(preflight="warn", eval_real_robot="block", ui="required"),
        validator_id=validator_id,
    )


def _optional_calibration(validator_id: str = "none") -> CalibrationPolicy:
    return CalibrationPolicy(
        requirement="optional",
        enforcement=CalibrationEnforcement(preflight="skip", eval_real_robot="skip", ui="optional"),
        validator_id=validator_id,
    )


def _policy(
    type_name: str,
    *,
    registry_kind: RegistryKind,
    family_id: str,
    role: Role,
    canonical_robot_type: str,
    canonical_teleop_type: str,
    calibration: CalibrationPolicy,
    motor_setup_supported: bool,
    bimanual_supported: bool = False,
    bimanual_group_type: str = "",
) -> TypePolicy:
    return TypePolicy(
        type_name=type_name,
        registry_kind=registry_kind,
        family_id=family_id,
        role=role,
        pairing=PairingPolicy(
            canonical_robot_type=canonical_robot_type,
            canonical_teleop_type=canonical_teleop_type,
        ),
        calibration=calibration,
        motor_setup=MotorSetupPolicy(supported=motor_setup_supported),
        bimanual=BimanualPolicy(supported=bimanual_supported, group_type=bimanual_group_type),
    )


_POLICIES: dict[str, TypePolicy] = {
    "so101_follower": _policy(
        "so101_follower",
        registry_kind="robot",
        family_id="so",
        role="follower",
        canonical_robot_type="so101_follower",
        canonical_teleop_type="so101_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=True,
    ),
    "so101_leader": _policy(
        "so101_leader",
        registry_kind="teleop",
        family_id="so",
        role="leader",
        canonical_robot_type="so101_follower",
        canonical_teleop_type="so101_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=True,
    ),
    "so100_follower": _policy(
        "so100_follower",
        registry_kind="robot",
        family_id="so",
        role="follower",
        canonical_robot_type="so100_follower",
        canonical_teleop_type="so100_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=True,
    ),
    "so100_leader": _policy(
        "so100_leader",
        registry_kind="teleop",
        family_id="so",
        role="leader",
        canonical_robot_type="so100_follower",
        canonical_teleop_type="so100_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=True,
    ),
    "bi_so_follower": _policy(
        "bi_so_follower",
        registry_kind="robot",
        family_id="so",
        role="follower",
        canonical_robot_type="bi_so_follower",
        canonical_teleop_type="bi_so_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=False,
        bimanual_supported=True,
        bimanual_group_type="bi_so_follower",
    ),
    "bi_so_leader": _policy(
        "bi_so_leader",
        registry_kind="teleop",
        family_id="so",
        role="leader",
        canonical_robot_type="bi_so_follower",
        canonical_teleop_type="bi_so_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=False,
        bimanual_supported=True,
        bimanual_group_type="bi_so_leader",
    ),
    "omx_follower": _policy(
        "omx_follower",
        registry_kind="robot",
        family_id="omx",
        role="follower",
        canonical_robot_type="omx_follower",
        canonical_teleop_type="omx_leader",
        calibration=_optional_calibration("none"),
        motor_setup_supported=True,
    ),
    "omx_leader": _policy(
        "omx_leader",
        registry_kind="teleop",
        family_id="omx",
        role="leader",
        canonical_robot_type="omx_follower",
        canonical_teleop_type="omx_leader",
        calibration=_optional_calibration("none"),
        motor_setup_supported=True,
    ),
    "koch_follower": _policy(
        "koch_follower",
        registry_kind="robot",
        family_id="koch",
        role="follower",
        canonical_robot_type="koch_follower",
        canonical_teleop_type="koch_leader",
        calibration=_required_calibration("generic_json"),
        motor_setup_supported=True,
    ),
    "koch_leader": _policy(
        "koch_leader",
        registry_kind="teleop",
        family_id="koch",
        role="leader",
        canonical_robot_type="koch_follower",
        canonical_teleop_type="koch_leader",
        calibration=_required_calibration("generic_json"),
        motor_setup_supported=True,
    ),
    "lekiwi": _policy(
        "lekiwi",
        registry_kind="robot",
        family_id="lekiwi",
        role="other",
        canonical_robot_type="lekiwi",
        canonical_teleop_type="so101_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=True,
    ),
    "lekiwi_client": _policy(
        "lekiwi_client",
        registry_kind="robot",
        family_id="lekiwi",
        role="other",
        canonical_robot_type="lekiwi_client",
        canonical_teleop_type="so101_leader",
        calibration=_required_calibration("feetech_sts3215"),
        motor_setup_supported=False,
    ),
    "openarm_follower": _policy(
        "openarm_follower",
        registry_kind="robot",
        family_id="openarm",
        role="follower",
        canonical_robot_type="openarm_follower",
        canonical_teleop_type="openarm_leader",
        calibration=_required_calibration("generic_json"),
        motor_setup_supported=False,
    ),
    "openarm_leader": _policy(
        "openarm_leader",
        registry_kind="teleop",
        family_id="openarm",
        role="leader",
        canonical_robot_type="openarm_follower",
        canonical_teleop_type="openarm_leader",
        calibration=_required_calibration("generic_json"),
        motor_setup_supported=False,
    ),
}


def get_defaults_for_mode(mode: Literal["single", "bi"]) -> ModeDefaults:
    return DEFAULT_BI if mode == "bi" else DEFAULT_SINGLE


def _infer_unknown_registry_kind(type_name: str) -> RegistryKind:
    normalized = type_name.strip().lower()
    if normalized.endswith("_leader") or normalized in {
        "keyboard",
        "keyboard_ee",
        "keyboard_rover",
        "gamepad",
        "homunculus_glove",
        "homunculus_arm",
        "reachy2_teleoperator",
    }:
        return "teleop"
    return "robot"


def get_type_policy(type_name: str) -> TypePolicy:
    normalized = str(type_name or "").strip()
    if normalized in _POLICIES:
        return _POLICIES[normalized]

    registry_kind = _infer_unknown_registry_kind(normalized)
    return _policy(
        normalized,
        registry_kind=registry_kind,
        family_id="unknown",
        role="unknown",
        canonical_robot_type=normalized
        if registry_kind == "robot"
        else normalized.removesuffix("_leader") + "_follower"
        if normalized.endswith("_leader")
        else "",
        canonical_teleop_type="" if registry_kind == "robot" else normalized,
        calibration=_required_calibration("generic_json"),
        motor_setup_supported=False,
    )


def supports_motor_setup(type_name: str) -> bool:
    return get_type_policy(type_name).motor_setup.supported


def get_calibration_validator(type_name: str) -> str:
    return get_type_policy(type_name).calibration.validator_id


def get_calibration_source_types(type_name: str) -> list[str]:
    normalized = str(type_name or "").strip()
    if normalized == "bi_so_follower":
        return ["so101_follower", "so100_follower"]
    if normalized == "bi_so_leader":
        return ["so101_leader", "so100_leader"]
    if normalized.startswith("bi_"):
        return [normalized[3:]]
    return [normalized]


def is_calibration_required(type_name: str, *, context: CalibrationContext) -> bool:
    policy = get_type_policy(type_name).calibration.enforcement
    if context == "preflight":
        return policy.preflight != "skip"
    return policy.eval_real_robot == "block"


def get_type_catalog_payload() -> dict:
    return {
        "version": 1,
        "defaults": {
            "single": asdict(DEFAULT_SINGLE),
            "bi": asdict(DEFAULT_BI),
        },
        "types": {name: asdict(policy) for name, policy in sorted(_POLICIES.items())},
    }


__all__ = [
    "BimanualPolicy",
    "CalibrationContext",
    "CalibrationEnforcement",
    "CalibrationPolicy",
    "DEFAULT_BI",
    "DEFAULT_SINGLE",
    "MOTOR_SETUP_COMPATIBLE_TYPES",
    "ModeDefaults",
    "MotorSetupPolicy",
    "PairingPolicy",
    "TypePolicy",
    "get_defaults_for_mode",
    "get_calibration_validator",
    "get_calibration_source_types",
    "get_type_catalog_payload",
    "get_type_policy",
    "is_calibration_required",
    "supports_motor_setup",
]
