# pyright: reportMissingImports=false

from __future__ import annotations

import os
import sys
import threading
import time

from pytest import MonkeyPatch

from lestudio import motor_setup_bridge as bridge


def test_maybe_emit_event_parses_prompt_motor_without_trailing_quote(monkeypatch: MonkeyPatch):
    events: list[dict[str, object]] = []
    monkeypatch.setattr(bridge, "emit_event", events.append)

    bridge.maybe_emit_event("Connect the controller board to the 'gripper' motor only and press enter.")

    assert events == [
        {
            "event": "prompt",
            "motor": "gripper",
            "message": "Connect the controller board to the 'gripper' motor only and press enter.",
        }
    ]


def test_build_child_env_enables_serial_trace_by_default(monkeypatch: MonkeyPatch):
    monkeypatch.delenv(bridge.SERIAL_TRACE_ENV, raising=False)

    env = bridge.build_child_env()

    assert env["PYTHONUNBUFFERED"] == "1"
    assert env[bridge.SERIAL_TRACE_ENV] == "1"


def test_build_child_env_preserves_existing_serial_trace_override(monkeypatch: MonkeyPatch):
    monkeypatch.setenv(bridge.SERIAL_TRACE_ENV, "0")

    env = bridge.build_child_env()

    assert env[bridge.SERIAL_TRACE_ENV] == "0"


def test_forward_stdin_stops_cleanly_without_input(monkeypatch: MonkeyPatch):
    read_fd, write_fd = os.pipe()
    read_file = os.fdopen(read_fd, "rb", buffering=0)

    class FakeProc:
        stdin: "FakeProc"

        def __init__(self) -> None:
            self.stdin = self
            self.chunks: list[bytes] = []

        def poll(self) -> None:
            return None

        def write(self, chunk: bytes) -> None:
            self.chunks.append(chunk)

        def flush(self) -> None:
            return None

    proc = FakeProc()
    stop_event = threading.Event()
    monkeypatch.setattr(sys, "stdin", read_file)

    thread = threading.Thread(target=bridge.forward_stdin, args=(proc, stop_event))
    thread.start()
    stop_event.set()
    thread.join(timeout=1.0)

    os.close(write_fd)
    read_file.close()

    assert not thread.is_alive()
    assert proc.chunks == []


def test_forward_stdin_forwards_bytes(monkeypatch: MonkeyPatch):
    read_fd, write_fd = os.pipe()
    read_file = os.fdopen(read_fd, "rb", buffering=0)

    class FakeProc:
        stdin: "FakeProc"

        def __init__(self) -> None:
            self.stdin = self
            self.chunks: list[bytes] = []

        def poll(self) -> None:
            return None

        def write(self, chunk: bytes) -> None:
            self.chunks.append(chunk)

        def flush(self) -> None:
            return None

    proc = FakeProc()
    stop_event = threading.Event()
    monkeypatch.setattr(sys, "stdin", read_file)

    thread = threading.Thread(target=bridge.forward_stdin, args=(proc, stop_event))
    thread.start()
    os.write(write_fd, b"\n")
    os.close(write_fd)

    deadline = time.time() + 1.0
    while not proc.chunks and time.time() < deadline:
        time.sleep(0.01)
    stop_event.set()
    thread.join(timeout=1.0)
    read_file.close()

    assert proc.chunks == [b"\n"]
    assert not thread.is_alive()
