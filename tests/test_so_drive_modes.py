# pyright: reportMissingImports=false

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pytest import MonkeyPatch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "lerobot" / "src"))

pytest.importorskip("lerobot.motors.motors_bus", reason="lerobot submodule not available")
from lerobot.motors.motors_bus import MotorCalibration
from lerobot.robots.so_follower.so_follower import SO_ARM_DRIVE_MODES as FOLLOWER_DRIVE_MODES
from lerobot.robots.so_follower.so_follower import FIRST_SYNC_READ_RETRIES
from lerobot.robots.so_follower.so_follower import FIRST_SYNC_READ_SETTLE_S
from lerobot.robots.so_follower.so_follower import SOFollower
from lerobot.robots.so_follower.so_follower import _apply_default_so_drive_modes as apply_follower_drive_modes
from lerobot.teleoperators.so_leader.so_leader import SO_ARM_DRIVE_MODES as LEADER_DRIVE_MODES
from lerobot.teleoperators.so_leader.so_leader import _apply_default_so_drive_modes as apply_leader_drive_modes

pytestmark = pytest.mark.lerobot


def make_zero_drive_mode_calibration() -> dict[str, MotorCalibration]:
    return {
        name: MotorCalibration(id=index, drive_mode=0, homing_offset=0, range_min=0, range_max=4095)
        for index, name in enumerate(LEADER_DRIVE_MODES, start=1)
    }


def test_leader_drive_mode_upgrade_applies_expected_so_defaults():
    calibration = make_zero_drive_mode_calibration()

    changed = apply_leader_drive_modes(calibration)

    assert changed is False
    assert {name: calibration[name].drive_mode for name in calibration} == LEADER_DRIVE_MODES


def test_follower_drive_mode_upgrade_applies_expected_so_defaults():
    calibration = make_zero_drive_mode_calibration()

    changed = apply_follower_drive_modes(calibration)

    assert changed is False
    assert {name: calibration[name].drive_mode for name in calibration} == FOLLOWER_DRIVE_MODES


def test_drive_mode_upgrade_preserves_non_default_manual_values():
    calibration = make_zero_drive_mode_calibration()
    calibration["elbow_flex"].drive_mode = 1

    changed = apply_leader_drive_modes(calibration)

    assert changed is False
    assert calibration["elbow_flex"].drive_mode == 1


def test_so_follower_first_observation_waits_and_retries(monkeypatch: MonkeyPatch):
    sleep_calls: list[float] = []

    class FakeBus:
        is_connected = True

        def sync_read(self, data_name: str, num_retry: int = 0):
            assert data_name == "Present_Position"
            assert num_retry == FIRST_SYNC_READ_RETRIES
            return {"shoulder_pan": 1.0}

    robot = object.__new__(SOFollower)
    robot.id = "follower_arm_1"
    robot.bus = FakeBus()
    robot.cameras = {}
    robot._needs_initial_sync_read_settle = True
    monkeypatch.setattr("lerobot.robots.so_follower.so_follower.time.sleep", sleep_calls.append)

    observation = robot.get_observation()

    assert sleep_calls == [FIRST_SYNC_READ_SETTLE_S]
    assert observation == {"shoulder_pan.pos": 1.0}
    assert robot._needs_initial_sync_read_settle is False
