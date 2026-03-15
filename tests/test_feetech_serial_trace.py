# pyright: reportMissingImports=false

from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest
from pytest import MonkeyPatch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "lerobot" / "src"))

pytest.importorskip("lerobot.motors.feetech.feetech", reason="lerobot submodule not available")
from lerobot.motors.feetech import feetech

pytestmark = pytest.mark.lerobot


def test_nearest_representable_homing_offset_wraps_extra_turns():
    assert feetech._nearest_representable_homing_offset(4276, 4096, 2047) == -1867


def test_nearest_representable_homing_offset_limits_unrepresentable_midpoint():
    assert feetech._nearest_representable_homing_offset(4095, 4096, 2047) == -2047


def test_phase_wrap_position_wraps_extra_turns_into_single_revolution():
    assert feetech._phase_wrap_position(6322, 4096) == 2226


def test_emit_serial_trace_writes_hex_dump(monkeypatch: MonkeyPatch):
    monkeypatch.setenv(feetech.SERIAL_TRACE_ENV, "1")
    fake_stderr = io.StringIO()
    monkeypatch.setattr(sys, "stderr", fake_stderr)

    feetech._emit_serial_trace("/dev/ttyACM0", "TX", [255, 1, 2], note="requested=3")

    assert fake_stderr.getvalue() == "[motor-serial] /dev/ttyACM0 TX FF 01 02 | requested=3\n"


def test_install_port_trace_wraps_tx_rx_and_baud(monkeypatch: MonkeyPatch):
    monkeypatch.setenv(feetech.SERIAL_TRACE_ENV, "1")
    fake_stderr = io.StringIO()
    monkeypatch.setattr(sys, "stderr", fake_stderr)

    class FakePortHandler:
        def __init__(self) -> None:
            self.writes: list[object] = []
            self.read_lengths: list[int] = []
            self.baudrates: list[int] = []

        def writePort(self, packet: object) -> int:
            self.writes.append(packet)
            return 7

        def readPort(self, length: int) -> list[int]:
            self.read_lengths.append(length)
            return [170, 85]

        def setBaudRate(self, baudrate: int) -> bool:
            self.baudrates.append(baudrate)
            return True

    handler = FakePortHandler()
    feetech._install_port_trace(handler, "/dev/ttyACM0")

    assert handler.writePort([1, 2, 3]) == 7
    assert handler.readPort(6) == [170, 85]
    assert handler.setBaudRate(1_000_000) is True

    output = fake_stderr.getvalue().splitlines()
    assert output == [
        "[motor-serial] /dev/ttyACM0 TX 01 02 03",
        "[motor-serial] /dev/ttyACM0 RX AA 55 | requested=6",
        "[motor-serial] /dev/ttyACM0 BAUD 1000000",
    ]


def test_enable_torque_locks_before_enabling_torque():
    writes: list[tuple[str, str, int, int]] = []

    class FakeBus:
        def _get_motors_list(self, motors):
            return ["elbow_flex"]

        def write(self, data_name: str, motor: str, value: int, *, num_retry: int = 0):
            writes.append((data_name, motor, value, num_retry))

    feetech.FeetechMotorsBus.enable_torque(FakeBus(), num_retry=2)

    assert writes == [
        ("Lock", "elbow_flex", 1, 2),
        ("Torque_Enable", "elbow_flex", 1, 2),
    ]


def test_enable_torque_continues_when_lock_write_has_no_status_packet(monkeypatch: MonkeyPatch):
    writes: list[tuple[str, str, int, int]] = []
    warnings: list[tuple[str, str]] = []

    class FakeBus:
        def _get_motors_list(self, motors):
            return ["elbow_flex"]

        def write(self, data_name: str, motor: str, value: int, *, num_retry: int = 0):
            writes.append((data_name, motor, value, num_retry))
            if data_name == "Lock":
                raise ConnectionError("no status packet")

    monkeypatch.setattr(feetech.logger, "warning", lambda message, motor, exc: warnings.append((message, motor)))

    feetech.FeetechMotorsBus.enable_torque(FakeBus(), num_retry=0)

    assert writes == [
        ("Lock", "elbow_flex", 1, feetech.LOCK_WRITE_RETRIES),
        ("Torque_Enable", "elbow_flex", 1, 0),
    ]
    assert warnings == [("Proceeding without confirmed Feetech lock on %s: %s", "elbow_flex")]


def test_disconnect_disable_torque_continues_when_motor_reports_overload(monkeypatch: MonkeyPatch):
    writes: list[tuple[str, str, int, int]] = []
    warnings: list[tuple[str, str]] = []

    class FakeBus:
        def _get_motors_list(self, motors):
            return ["shoulder_lift", "elbow_flex"]

        def write(self, data_name: str, motor: str, value: int, *, num_retry: int = 0):
            writes.append((data_name, motor, value, num_retry))
            if motor == "shoulder_lift":
                raise RuntimeError("[RxPacketError] Overload error!")

    monkeypatch.setattr(feetech.logger, "warning", lambda message, motor, exc: warnings.append((message, motor)))

    feetech.FeetechMotorsBus._disconnect_disable_torque(FakeBus())

    assert writes == [
        ("Torque_Enable", "shoulder_lift", 0, 5),
        ("Torque_Enable", "elbow_flex", 0, 5),
    ]
    assert warnings == [
        ("Proceeding with Feetech disconnect despite torque disable failure on %s: %s", "shoulder_lift")
    ]
