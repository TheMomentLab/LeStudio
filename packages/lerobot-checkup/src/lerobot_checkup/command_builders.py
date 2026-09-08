"""Command builders for the hardware-layer subprocesses (calibration, motor setup)."""

from __future__ import annotations

from pathlib import Path

import lerobot_checkup.motor_setup_bridge
from lerobot_checkup import type_policy
from lerobot_checkup.device_helpers import get_calibration_dir

MOTOR_SETUP_COMPATIBLE_TYPES = set(type_policy.MOTOR_SETUP_COMPATIBLE_TYPES)


def _is_bimanual_mode(value: object) -> bool:
    return str(value or "single").strip().lower() != "single"


def _calibration_dir_arg(prefix: str, device_type: str) -> str:
    return f"--{prefix}.calibration_dir={get_calibration_dir(device_type)}"


def build_calibrate_args(python_exe: str, data: dict) -> list[str]:
    robot_mode = data.get("robot_mode", "single")

    if _is_bimanual_mode(robot_mode):
        bi_type = data.get("bi_type", "bi_so_follower")
        robot_id = data.get("robot_id", "bimanual_follower")
        left_port = data.get("left_port", "/dev/follower_arm_1")
        right_port = data.get("right_port", "/dev/follower_arm_2")
        if "leader" in bi_type:
            return [
                python_exe,
                "-m",
                "lerobot_checkup.calibrate_bridge",
                f"--teleop.type={bi_type}",
                _calibration_dir_arg("teleop", bi_type),
                f"--teleop.left_arm_config.port={left_port}",
                f"--teleop.right_arm_config.port={right_port}",
                f"--teleop.id={robot_id}",
            ]
        return [
            python_exe,
            "-m",
            "lerobot_checkup.calibrate_bridge",
            f"--robot.type={bi_type}",
            _calibration_dir_arg("robot", bi_type),
            f"--robot.left_arm_config.port={left_port}",
            f"--robot.right_arm_config.port={right_port}",
            f"--robot.id={robot_id}",
        ]

    robot_type = data.get("robot_type", "so101_follower")
    robot_id = data.get("robot_id", "follower_arm_1")
    port = data.get("port", "/dev/follower_arm_1")
    if "leader" in robot_type:
        return [
            python_exe,
            "-m",
            "lerobot_checkup.calibrate_bridge",
            f"--teleop.type={robot_type}",
            f"--teleop.port={port}",
            f"--teleop.id={robot_id}",
        ]
    return [
        python_exe,
        "-m",
        "lerobot_checkup.calibrate_bridge",
        f"--robot.type={robot_type}",
        f"--robot.port={port}",
        f"--robot.id={robot_id}",
    ]


def build_motor_setup_args(python_exe: str, data: dict) -> list[str]:
    robot_type = data.get("robot_type", "so101_follower")
    port = data.get("port", "/dev/follower_arm_1")
    if not type_policy.supports_motor_setup(str(robot_type)):
        supported = ", ".join(sorted(MOTOR_SETUP_COMPATIBLE_TYPES))
        raise ValueError(f"Motor Setup does not support '{robot_type}'. Supported types: {supported}")
    return [
        python_exe,
        str(Path(lerobot_checkup.motor_setup_bridge.__file__)),
        f"--python-exe={python_exe}",
        f"--robot-type={robot_type}",
        f"--port={port}",
    ]
