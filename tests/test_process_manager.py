from __future__ import annotations

from pathlib import Path

from lestudio.process_manager import ProcessManager, _extract_train_metric, _parse_compact_int, _translate_error_line


def test_translate_error_line_known_patterns():
    msg = _translate_error_line("Permission denied: /dev/video0")
    assert msg is not None and "/dev/video0" in msg

    msg = _translate_error_line("could not find calibration file for robot")
    assert msg is not None and "Calibration file is missing" in msg

    msg = _translate_error_line("ModuleNotFoundError: No module named 'httpx'")
    assert msg is not None and "pip install httpx" in msg


def test_translate_error_line_unknown_returns_none():
    assert _translate_error_line("all good") is None


def test_parse_compact_int_supports_suffixes():
    assert _parse_compact_int("1.5K") == 1500
    assert _parse_compact_int("2M") == 2_000_000
    assert _parse_compact_int("42") == 42
    assert _parse_compact_int("bad") is None


def test_extract_train_metric_parses_multiple_values():
    metric = _extract_train_metric("cfg.steps=100_000 step=1.5K loss=0.12 lr=1e-4")
    assert metric is not None
    assert metric["total_steps"] == 100_000
    assert metric["step"] == 1500
    assert metric["loss"] == 0.12
    assert metric["lr"] == 1e-4


def test_extract_train_metric_none_when_no_match():
    assert _extract_train_metric("hello world") is None


def test_conflicting_processes_dedupes_and_respects_running(monkeypatch):
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    monkeypatch.setattr(pm, "is_running", lambda name: name in {"record", "calibrate"})
    assert pm.conflicting_processes("teleop") == ["calibrate", "record"]
    assert pm.conflicting_processes("train") == []


def test_flush_queue_removes_entries_for_target_process():
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    pm.event_buffer.push({"process": "train", "line": "1"})
    pm.event_buffer.push({"process": "teleop", "line": "2"})
    pm.event_buffer.flush_process("train")

    sub_id = pm.event_buffer.subscribe()
    # Reset cursor to beginning
    pm.event_buffer._subscribers[sub_id] = 0
    got = pm.event_buffer.poll(sub_id)
    pm.event_buffer.unsubscribe(sub_id)
    assert len(got) == 1
    assert got[0]["process"] == "teleop"


def test_push_translation_deduplicates():
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    sub_id = pm.event_buffer.subscribe()
    pm._push_translation("train", "same")
    pm._push_translation("train", "same")
    pm._push_translation("train", "other")

    items = pm.event_buffer.poll(sub_id)
    pm.event_buffer.unsubscribe(sub_id)
    assert len(items) == 2
    assert items[0]["kind"] == "translation"
    assert items[1]["line"].endswith("other")


def test_process_line_replaces_latest_teleop_debug_snapshot():
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    sub_id = pm.event_buffer.subscribe()
    pm._process_line("teleop", '[LESTUDIO_TELEOP_DEBUG] {"loop_index":1}')

    items = pm.event_buffer.poll(sub_id)
    pm.event_buffer.unsubscribe(sub_id)
    assert len(items) == 1
    assert items[0]["replace"] == "teleop:teleop_debug"


def test_process_line_replaces_latest_teleop_debug_meta():
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    sub_id = pm.event_buffer.subscribe()
    pm._process_line("teleop", '[LESTUDIO_TELEOP_DEBUG_META] {"debug_enabled":true}')

    items = pm.event_buffer.poll(sub_id)
    pm.event_buffer.unsubscribe(sub_id)
    assert len(items) == 1
    assert items[0]["replace"] == "teleop:teleop_debug_meta"


def test_open_session_log_writes_latest_pointer(tmp_path: Path):
    pm = ProcessManager(Path("/tmp/lerobot-src"), state_dir=tmp_path)

    path = pm._open_session_log("teleop")

    assert path is not None
    assert path.parent == tmp_path / "logs" / "teleop"
    latest = tmp_path / "logs" / "teleop" / "latest.txt"
    assert latest.read_text(encoding="utf-8").strip() == str(path)
    pm._close_session_log("teleop")


def test_process_line_writes_to_session_log(tmp_path: Path):
    pm = ProcessManager(Path("/tmp/lerobot-src"), state_dir=tmp_path)
    path = pm._open_session_log("teleop")
    assert path is not None

    pm._process_line("teleop", '[LESTUDIO_TELEOP_DEBUG] {"loop_index":1}')
    pm._close_session_log("teleop")

    content = path.read_text(encoding="utf-8")
    assert '[LESTUDIO_TELEOP_DEBUG] {"loop_index":1}' in content


def test_flush_partial_buffer_writes_progress_to_session_log(tmp_path: Path):
    pm = ProcessManager(Path("/tmp/lerobot-src"), state_dir=tmp_path)
    path = pm._open_session_log("teleop")
    assert path is not None

    remainder = pm._flush_partial_buffer("teleop", b"Teleop loop time: 32.00ms (31 Hz)\r")

    assert remainder == b""
    pm._close_session_log("teleop")
    content = path.read_text(encoding="utf-8")
    assert "Teleop loop time: 32.00ms (31 Hz)" in content


def test_start_handles_popen_failure(monkeypatch):
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    sub_id = pm.event_buffer.subscribe()

    def boom(*args, **kwargs):
        raise RuntimeError("fail")

    monkeypatch.setattr("subprocess.Popen", boom)
    ok = pm.start("train", ["python", "-V"])
    assert ok is False
    items = pm.event_buffer.poll(sub_id)
    pm.event_buffer.unsubscribe(sub_id)
    assert any(item["kind"] == "error" for item in items)


def test_send_input_returns_false_for_not_running_process():
    pm = ProcessManager(Path("/tmp/lerobot-src"))
    assert pm.send_input("train", "hello") is False
