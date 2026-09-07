from __future__ import annotations

import argparse
import json
import os
import re
import select
import signal
import subprocess
import sys
import threading
import time
from typing import Any

EVENT_PREFIX = "[MOTOR_SETUP_EVENT] "
PROMPT_RE = re.compile(r"^Connect the controller board to the '([^']+)' motor only and press enter\.$")
SERIAL_TRACE_ENV = "LESTUDIO_FEETECH_SERIAL_TRACE"


def emit_event(event: dict[str, Any]) -> None:
    sys.stdout.write(f"{EVENT_PREFIX}{json.dumps(event, ensure_ascii=True)}\n")
    sys.stdout.flush()


def emit_line(text: str) -> None:
    cleaned = text.rstrip("\r\n")
    if not cleaned:
        return
    sys.stdout.write(f"{cleaned}\n")
    sys.stdout.flush()


def maybe_emit_event(text: str) -> None:
    stripped = text.strip()
    if not stripped:
        return

    prompt_match = PROMPT_RE.match(stripped)
    if prompt_match:
        motor = prompt_match.group(1)
        emit_event({"event": "prompt", "motor": motor, "message": stripped})
        return

    if stripped.startswith("'") and "' motor id set to " in stripped:
        motor_part, _, id_part = stripped[1:].partition("' motor id set to ")
        target_id: int | str
        try:
            target_id = int(id_part)
        except ValueError:
            target_id = id_part
        emit_event({"event": "configured", "motor": motor_part, "target_id": target_id, "message": stripped})
        return

    if stripped.startswith("Found one motor on baudrate=") and " with id=" in stripped:
        tail = stripped.removeprefix("Found one motor on baudrate=")
        baud_text, _, id_text = tail.partition(" with id=")
        try:
            baudrate: int | str = int(baud_text)
        except ValueError:
            baudrate = baud_text
        try:
            detected_id: int | str = int(id_text.split()[0])
        except ValueError:
            detected_id = id_text.split()[0]
        emit_event({"event": "detected", "baud_rate": baudrate, "detected_id": detected_id, "message": stripped})
        return

    if stripped.startswith("Setting bus baud rate to "):
        tail = stripped.removeprefix("Setting bus baud rate to ")
        baud_text = tail.split(".", 1)[0].split()[0]
        try:
            baudrate = int(baud_text)
        except ValueError:
            baudrate = baud_text
        emit_event({"event": "baud_rate", "baud_rate": baudrate, "message": stripped})
        return

    if any(
        token in stripped
        for token in (
            "Traceback",
            "ConnectionError:",
            "RuntimeError:",
            "NotImplementedError",
            "Failed to write",
            "Error:",
        )
    ):
        emit_event({"event": "error", "message": stripped})


def forward_stdin(proc: subprocess.Popen[bytes], stop_event: threading.Event) -> None:
    if proc.stdin is None:
        return

    try:
        stdin_fd = sys.stdin.fileno()
    except (AttributeError, OSError, ValueError):
        return

    try:
        while proc.poll() is None and not stop_event.is_set():
            try:
                ready, _, _ = select.select([stdin_fd], [], [], 0.1)
            except (OSError, ValueError):
                break
            if not ready:
                continue

            chunk = os.read(stdin_fd, 4096)
            if not chunk:
                break
            proc.stdin.write(chunk)
            proc.stdin.flush()
    except BrokenPipeError:
        return
    except OSError:
        return


def stream_output(proc: subprocess.Popen[bytes]) -> int:
    if proc.stdout is None:
        return proc.wait()

    fd = proc.stdout.fileno()
    buf = b""
    last_data = time.monotonic()
    partial_idle_s = 0.15

    while True:
        if proc.poll() is not None and not buf:
            break
        try:
            ready, _, _ = select.select([fd], [], [], 0.1)
        except (OSError, ValueError):
            break

        if ready:
            try:
                chunk = os.read(fd, 4096)
            except OSError:
                chunk = b""
            if not chunk:
                break
            buf += chunk
            last_data = time.monotonic()
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                text = line.decode("utf-8", errors="replace")
                emit_line(text)
                maybe_emit_event(text)
        elif buf and time.monotonic() - last_data >= partial_idle_s:
            text = buf.decode("utf-8", errors="replace")
            buf = b""
            emit_line(text)
            maybe_emit_event(text)

    if buf:
        text = buf.decode("utf-8", errors="replace")
        emit_line(text)
        maybe_emit_event(text)

    return proc.wait()


def build_child_args(python_exe: str, robot_type: str, port: str) -> list[str]:
    base = [python_exe, "-m", "lerobot.scripts.lerobot_setup_motors"]
    if "leader" in robot_type:
        return [*base, f"--teleop.type={robot_type}", f"--teleop.port={port}"]
    return [*base, f"--robot.type={robot_type}", f"--robot.port={port}"]


def build_child_env() -> dict[str, str]:
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    env.setdefault(SERIAL_TRACE_ENV, "1")
    return env


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--python-exe", required=True)
    parser.add_argument("--robot-type", required=True)
    parser.add_argument("--port", required=True)
    args = parser.parse_args()

    child = subprocess.Popen(
        build_child_args(args.python_exe, args.robot_type, args.port),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
        env=build_child_env(),
    )

    def handle_signal(signum: int, _frame: Any) -> None:
        if child.poll() is None:
            try:
                child.send_signal(signum)
            except OSError:
                pass

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    stop_stdin = threading.Event()
    stdin_thread = threading.Thread(target=forward_stdin, args=(child, stop_stdin))
    stdin_thread.start()

    emit_event({"event": "bridge_started", "robot_type": args.robot_type, "port": args.port})
    try:
        code = stream_output(child)
    finally:
        stop_stdin.set()
        stdin_thread.join(timeout=1.0)
    emit_event({"event": "bridge_exited", "returncode": code})
    return code


if __name__ == "__main__":
    raise SystemExit(main())
