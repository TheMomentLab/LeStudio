from __future__ import annotations

import datetime
import logging
from pathlib import Path
from typing import cast

from lerobot_doctor import command_builders, device_registry, path_policy
from lerobot_doctor.calibration_validator import (
    CalibrationIssue,
    CalibrationValidationResult,
    validate_and_cross_validate,
    validate_calibration_file,
)
from lerobot_doctor.device_helpers import get_calibration_file_path
from lerobot_doctor.motor_monitor_bridge import get_bridge as _get_motor_bridge
from lerobot_doctor.routes._state import AppState

logger = logging.getLogger(__name__)


def _is_bimanual_mode(value: object) -> bool:
    return str(value or "single").strip().lower() != "single"


def _is_bimanual_calibration_type(robot_type: str) -> bool:
    return str(robot_type or "").startswith("bi_")


def _bimanual_member_ids(robot_id: str) -> list[str]:
    value = str(robot_id or "").strip()
    if value.endswith("_left") or value.endswith("_right"):
        return [value]
    return [f"{value}_left", f"{value}_right"] if value else []


def _bimanual_member_paths(robot_type: str, robot_id: str) -> list[Path]:
    return [get_calibration_file_path(robot_type, member_id) for member_id in _bimanual_member_ids(robot_id)]


def _bimanual_display_path(robot_type: str, robot_id: str) -> str:
    member_paths = _bimanual_member_paths(robot_type, robot_id)
    if not member_paths:
        return ""
    if len(member_paths) == 1:
        return str(member_paths[0])
    shared_base = str(robot_id or "").strip()
    return str(member_paths[0].parent / f"{shared_base}_{{left,right}}.json")


def _merge_bimanual_validation(robot_type: str, robot_id: str, paths: list[Path]) -> CalibrationValidationResult:
    merged = CalibrationValidationResult(path=_bimanual_display_path(robot_type, robot_id))
    if len(paths) != 2:
        return merged
    for side, path in zip(("left", "right"), paths, strict=True):
        result = validate_calibration_file(path, device_type=robot_type)
        merged.errors.extend(
            CalibrationIssue(
                severity=issue.severity,
                joint=f"{side}.{issue.joint}" if issue.joint else side,
                code=issue.code,
                message=f"{side}: {issue.message}",
            )
            for issue in result.errors
        )
        merged.warnings.extend(
            CalibrationIssue(
                severity=issue.severity,
                joint=f"{side}.{issue.joint}" if issue.joint else side,
                code=issue.code,
                message=f"{side}: {issue.message}",
            )
            for issue in result.warnings
        )
    return merged


def _guard_process_start(state: AppState, name: str) -> dict | None:
    if state.proc_mgr.is_running(name):
        return {"ok": False, "error": "Already running"}
    conflicts = state.proc_mgr.conflicting_processes(name)
    if conflicts:
        return {"ok": False, "error": f"Cannot start: {', '.join(conflicts)} is using shared hardware"}
    return None


def calibrate_file_status(robot_type: str, robot_id: str) -> dict:
    if _is_bimanual_calibration_type(robot_type):
        paths = _bimanual_member_paths(robot_type, robot_id)
        if len(paths) == 2 and all(path.exists() for path in paths):
            latest_mtime = max(path.stat().st_mtime for path in paths)
            validation = _merge_bimanual_validation(robot_type, robot_id, paths)
            return {
                "exists": True,
                "path": _bimanual_display_path(robot_type, robot_id),
                "modified": datetime.datetime.fromtimestamp(latest_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "size": sum(path.stat().st_size for path in paths),
                "validation": validation.to_dict(),
            }
        return {"exists": False, "path": _bimanual_display_path(robot_type, robot_id)}

    category, dir_name = device_registry.get_calibration_path_prefix(robot_type)
    path = path_policy.calibration_file(category, dir_name, robot_id)
    if path.exists():
        mtime = path.stat().st_mtime
        mdate = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
        validation = validate_calibration_file(path, device_type=robot_type)
        return {
            "exists": True,
            "path": str(path),
            "modified": mdate,
            "size": path.stat().st_size,
            "validation": validation.to_dict(),
        }
    return {"exists": False, "path": str(path)}


_DIR_TO_TYPE: dict[tuple[str, str], str] = {
    ("robots", "so_follower"): "so101_follower",
    ("robots", "bi_so_follower"): "bi_so_follower",
    ("robots", "koch_follower"): "koch_follower",
    ("robots", "omx_follower"): "omx_follower",
    ("robots", "openarm_follower"): "openarm_follower",
    ("robots", "bi_openarm_follower"): "bi_openarm_follower",
    ("robots", "lekiwi"): "lekiwi",
    ("teleoperators", "so_leader"): "so101_leader",
    ("teleoperators", "bi_so_leader"): "bi_so_leader",
    ("teleoperators", "koch_leader"): "koch_leader",
    ("teleoperators", "omx_leader"): "omx_leader",
    ("teleoperators", "openarm_leader"): "openarm_leader",
    ("teleoperators", "bi_openarm_leader"): "bi_openarm_leader",
}


def calibrate_list() -> dict:
    base = path_policy.calibration_root()
    files = []
    if base.exists():
        for p in base.rglob("*.json"):
            if not p.is_file():
                continue
            mtime = p.stat().st_mtime
            mdate = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            rel = p.relative_to(base)
            parts = rel.parts
            guessed_type = "so101_follower"
            if len(parts) >= 3:
                guessed_type = _DIR_TO_TYPE.get((parts[0], parts[1]), guessed_type)
            files.append(
                {
                    "id": p.stem,
                    "rel_path": str(rel),
                    "modified": mdate,
                    "timestamp": mtime,
                    "size": p.stat().st_size,
                    "guessed_type": guessed_type,
                }
            )
    files.sort(key=lambda x: cast(float, x["timestamp"]), reverse=True)
    return {"files": files}


def calibrate_validate(robot_type: str, robot_id: str) -> dict:
    try:
        category, dir_name = device_registry.get_calibration_path_prefix(robot_type)
    except (TypeError, ValueError) as e:
        return {"ok": False, "error": f"Unknown robot_type '{robot_type}': {e}"}
    path = path_policy.calibration_file(category, dir_name, robot_id)
    result = validate_calibration_file(path, device_type=robot_type)
    return result.to_dict()


def calibrate_validate_pair(data: dict) -> dict:
    robot_type = data.get("robot_type", "")
    robot_id = data.get("robot_id", "")
    teleop_type = data.get("teleop_type", "")
    teleop_id = data.get("teleop_id", "")

    if not robot_type or not robot_id or not teleop_type or not teleop_id:
        return {"ok": False, "error": "All of robot_type, robot_id, teleop_type, teleop_id are required."}

    try:
        f_cat, f_dir = device_registry.get_calibration_path_prefix(robot_type)
        l_cat, l_dir = device_registry.get_calibration_path_prefix(teleop_type)
    except (TypeError, ValueError) as e:
        return {"ok": False, "error": f"Unknown device type: {e}"}

    follower_path = path_policy.calibration_file(f_cat, f_dir, robot_id)
    leader_path = path_policy.calibration_file(l_cat, l_dir, teleop_id)

    result = validate_and_cross_validate(
        leader_path,
        follower_path,
        leader_type=teleop_type,
        follower_type=robot_type,
    )
    return result


def calibrate_delete(robot_type: str, robot_id: str) -> dict:
    try:
        category, dir_name = device_registry.get_calibration_path_prefix(robot_type)
    except (TypeError, ValueError) as e:
        return {"ok": False, "error": f"Unknown robot_type '{robot_type}': {e}"}

    if _is_bimanual_calibration_type(robot_type):
        deleted_any = False
        for path in _bimanual_member_paths(robot_type, robot_id):
            if not path.exists():
                continue
            try:
                path.unlink()
                deleted_any = True
            except OSError as e:
                return {"ok": False, "error": str(e)}
        if deleted_any:
            return {"ok": True}
        return {"ok": False, "error": "File not found"}

    path = path_policy.calibration_file(category, dir_name, robot_id)
    if path.exists():
        try:
            path.unlink()
            return {"ok": True}
        except OSError as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "File not found"}


def start_calibrate(data: dict, state: AppState) -> dict:
    logger.info(
        "Calibrate start requested: robot_type=%s robot_id=%s port=%s",
        data.get("calibrate_robot_type"),
        data.get("calibrate_robot_id"),
        data.get("calibrate_port"),
    )
    _get_motor_bridge().disconnect()
    guard = _guard_process_start(state, "calibrate")
    if guard:
        logger.warning("Calibrate start blocked: %s", guard.get("error"))
        return guard
    args = command_builders.build_calibrate_args(state.python_exe, data)
    logger.debug("Calibrate command: %s", args)
    ok = state.proc_mgr.start("calibrate", args)
    if ok:
        logger.info("Calibrate process started successfully")
        state.append_history(
            "calibrate_start",
            {
                "robot_type": data.get("calibrate_robot_type", ""),
                "robot_id": data.get("calibrate_robot_id", ""),
            },
        )
    else:
        logger.error("Calibrate process failed to start")
    return {"ok": ok}


def start_motor_setup(data: dict, state: AppState) -> dict:
    logger.info(
        "Motor setup start requested: motor_type=%s port=%s brand=%s",
        data.get("motor_type"),
        data.get("motor_port"),
        data.get("motor_brand"),
    )
    _get_motor_bridge().disconnect()
    guard = _guard_process_start(state, "motor_setup")
    if guard:
        logger.warning("Motor setup start blocked: %s", guard.get("error"))
        return guard
    try:
        args = command_builders.build_motor_setup_args(state.python_exe, data)
    except ValueError as e:
        logger.error("Motor setup build_args failed: %s", e)
        return {"ok": False, "error": str(e)}
    logger.debug("Motor setup command: %s", args)
    ok = state.proc_mgr.start("motor_setup", args)
    if ok:
        logger.info("Motor setup process started successfully")
    else:
        logger.error("Motor setup process failed to start")
    return {"ok": ok}
