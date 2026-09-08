from __future__ import annotations

import json
from pathlib import Path

import pytest

from lerobot_doctor import cli


def _valid_so_calibration() -> dict[str, dict[str, int]]:
    joints = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"]
    return {
        name: {"id": i, "drive_mode": 0, "homing_offset": 100 * i, "range_min": 800, "range_max": 3500}
        for i, name in enumerate(joints, start=1)
    }


def _write_calibration(path: Path, data: dict | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data if data is not None else _valid_so_calibration()))
    return path


# ─── parsing helpers ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "spec, expected",
    [("1-6", [1, 2, 3, 4, 5, 6]), ("1,2,5", [1, 2, 5]), ("3-4,1", [1, 3, 4]), (" 2 ", [2])],
)
def test_parse_motor_ids(spec, expected):
    assert cli.parse_motor_ids(spec) == expected


@pytest.mark.parametrize("spec", ["", "a", "1-x"])
def test_parse_motor_ids_rejects_garbage(spec):
    with pytest.raises(ValueError):
        cli.parse_motor_ids(spec)


def test_guess_device_type_from_cache_layout(tmp_path: Path):
    path = tmp_path / "calibration" / "robots" / "so101_follower" / "arm.json"
    assert cli._guess_device_type(path) == "so101_follower"
    assert cli._guess_device_type(tmp_path / "somewhere" / "arm.json") == ""


# ─── collectors ───────────────────────────────────────────────────────────────


def test_collect_udev_reports_missing_symlinks(tmp_path: Path):
    rules = tmp_path / "99-lerobot.rules"
    rules.write_text(
        "# generated\n"
        'SUBSYSTEM=="tty", KERNELS=="1-2", SYMLINK+="lestudio_test_missing_arm", MODE="0666"\n'
        'SUBSYSTEM=="video4linux", KERNELS=="1-3", SYMLINK+="lestudio_test_missing_cam"\n'
    )
    udev = cli.collect_udev(rules)
    assert udev["present"] is True
    assert [s["symlink"] for s in udev["symlinks"]] == ["lestudio_test_missing_arm", "lestudio_test_missing_cam"]
    assert udev["missing"] == ["lestudio_test_missing_arm", "lestudio_test_missing_cam"]
    assert "MISSING" in cli.render_udev(udev)


def test_collect_udev_absent_rules(tmp_path: Path):
    udev = cli.collect_udev(tmp_path / "nope.rules")
    assert udev == {"path": str(tmp_path / "nope.rules"), "present": False, "symlinks": [], "missing": []}
    assert "not installed" in cli.render_udev(udev)


def test_collect_calibration_scans_cache(tmp_path: Path, monkeypatch):
    root = tmp_path / "calibration"
    good = _write_calibration(root / "robots" / "so101_follower" / "good.json")
    broken = _write_calibration(root / "teleoperators" / "so101_leader" / "broken.json", {"shoulder_pan": {}})
    monkeypatch.setattr(cli.path_policy, "calibration_root", lambda: root)

    report = cli.collect_calibration()

    assert sorted(Path(f["path"]).name for f in report["files"]) == ["broken.json", "good.json"]
    assert report["n_files"] == 2
    assert report["n_errors"] == 1
    by_name = {Path(f["path"]).name: f for f in report["files"]}
    assert by_name["good.json"]["ok"] is True
    assert by_name["good.json"]["device_type"] == "so101_follower"
    assert by_name["broken.json"]["ok"] is False
    text = cli.render_calibration(report)
    assert f"[OK] {good}" in text
    assert f"[ERROR] {broken}" in text
    assert "2 file(s), 1 with errors" in text


def test_collect_calibration_empty(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(cli.path_policy, "calibration_root", lambda: tmp_path / "missing")
    report = cli.collect_calibration()
    assert report["n_files"] == 0
    assert "No calibration files found" in cli.render_calibration(report)


def test_collect_system_flags_missing_groups(monkeypatch):
    monkeypatch.setattr(cli, "_user_groups", lambda: ["dialout"])
    system = cli.collect_system()
    assert system["groups"] == {"dialout": True, "video": False}
    assert system["missing_groups"] == ["video"]


# ─── commands ─────────────────────────────────────────────────────────────────

FAKE_PORTS = [
    {"device": "ttyACM0", "path": "/dev/ttyACM0", "symlink": "follower_arm_1", "serial": "ABC123", "kernels": "1-2"},
]
FAKE_CAMERAS = [{"device": "video0", "path": "/dev/video0", "kernels": "1-3", "symlink": "", "model": "Webcam"}]


def test_ports_json_and_text(monkeypatch, capsys):
    monkeypatch.setattr(cli.device_helpers, "get_arms", lambda: FAKE_PORTS)
    assert cli.main(["ports", "--json"]) == 0
    assert json.loads(capsys.readouterr().out) == FAKE_PORTS
    assert cli.main(["ports"]) == 0
    out = capsys.readouterr().out
    assert "ttyACM0" in out and "follower_arm_1" in out and "ABC123" in out


def test_ports_empty(monkeypatch, capsys):
    monkeypatch.setattr(cli.device_helpers, "get_arms", lambda: [])
    assert cli.main(["ports"]) == 0
    assert "No serial ports found" in capsys.readouterr().out


def test_cameras_include_usb_bus(monkeypatch, capsys):
    monkeypatch.setattr(cli.device_helpers, "get_cameras", lambda: [dict(c) for c in FAKE_CAMERAS])
    monkeypatch.setattr(
        cli.device_helpers, "get_usb_bus_for_camera", lambda name: {"bus": "1", "port": "1-3", "max_mbps": 480}
    )
    assert cli.main(["cameras", "--json"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert data[0]["usb"] == {"bus": "1", "port": "1-3", "max_mbps": 480}
    assert cli.main(["cameras"]) == 0
    assert "Webcam" in capsys.readouterr().out


def test_motors_requires_lerobot(monkeypatch, capsys):
    monkeypatch.setattr(cli, "lerobot_version", lambda: None)
    assert cli.main(["motors", "--port", "/dev/ttyACM0"]) == 1
    assert "lerobot is not installed" in capsys.readouterr().out


def test_motors_reports_missing_ids(monkeypatch, capsys):
    monkeypatch.setattr(cli, "lerobot_version", lambda: "0.6.1")
    calls = {}

    def fake_read(port, ids, model="sts3215", *, samples=5):
        calls["args"] = (port, ids, model)
        return {
            "ok": True,
            "port": port,
            "model": model,
            "requested_ids": ids,
            "connected_ids": [1, 2],
            "missing_ids": [3],
            "motors": {
                1: {"position": 2048, "load": 3, "current": 12, "collision": False},
                2: {"position": 10, "load": None, "current": None, "collision": False},
            },
        }

    monkeypatch.setattr(cli, "read_motors", fake_read)
    assert cli.main(["motors", "--port", "/dev/ttyACM0", "--ids", "1-3"]) == 1
    out = capsys.readouterr().out
    assert calls["args"] == ("/dev/ttyACM0", [1, 2, 3], "sts3215")
    assert "2/3 motors responded" in out
    assert "[MISSING] ids [3]" in out


def test_motors_invalid_ids(capsys):
    assert cli.main(["motors", "--port", "/dev/ttyACM0", "--ids", "x"]) == 2
    assert "invalid --ids" in capsys.readouterr().err


def test_calibration_paths_and_pair(tmp_path: Path, capsys):
    leader = _write_calibration(tmp_path / "teleoperators" / "so101_leader" / "l.json")
    follower = _write_calibration(tmp_path / "robots" / "so101_follower" / "f.json")
    assert cli.main(["calibration", str(leader), str(follower)]) == 0
    assert "2 file(s), 0 with errors" in capsys.readouterr().out

    assert cli.main(["calibration", "--pair", str(leader), str(follower), "--json"]) == 0
    pair = json.loads(capsys.readouterr().out)
    assert set(pair) == {"leader", "follower", "cross"}
    assert pair["leader"]["ok"] and pair["follower"]["ok"]

    broken = _write_calibration(tmp_path / "broken.json", {"gripper": {"id": 6}})
    assert cli.main(["calibration", str(broken)]) == 1


def test_udev_status_and_help(tmp_path: Path, capsys):
    assert cli.main(["udev", "status", "--rules-path", str(tmp_path / "none.rules")]) == 1
    assert "not installed" in capsys.readouterr().out
    assert cli.main(["udev"]) == 2
    assert "status" in capsys.readouterr().out
    assert cli.main([]) == 2
    assert "report" in capsys.readouterr().out


def test_udev_install_dry_run(tmp_path: Path, capsys):
    rules = tmp_path / "99-lerobot.rules"
    rules.write_text('SUBSYSTEM=="tty", SYMLINK+="lestudio_test_link"\n')
    target = tmp_path / "target.rules"
    assert cli.main(["udev", "install", "--source-rules", str(rules), "--rules-path", str(target), "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert f"sudo cp {rules} {target}" in out
    assert "Dry-run complete" in out
    assert not target.exists()


def test_udev_install_missing_source(tmp_path: Path, capsys):
    code = cli.install_udev_rules(tmp_path / "absent.rules", tmp_path / "t.rules", dry_run=True)
    assert code == 1
    assert "does not exist" in capsys.readouterr().err


def test_report_markdown_and_json(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.setattr(cli.device_helpers, "get_arms", lambda: FAKE_PORTS)
    monkeypatch.setattr(cli.device_helpers, "get_cameras", lambda: [dict(c) for c in FAKE_CAMERAS])
    monkeypatch.setattr(
        cli.device_helpers, "get_usb_bus_for_camera", lambda name: {"bus": "1", "port": "1-3", "max_mbps": 480}
    )
    monkeypatch.setattr(cli.path_policy, "calibration_root", lambda: tmp_path / "calibration")
    monkeypatch.setattr(cli, "_user_groups", lambda: ["dialout", "video"])
    rules = tmp_path / "none.rules"

    assert cli.main(["report", "--rules-path", str(rules)]) == 0
    out = capsys.readouterr().out
    assert out.startswith("# lerobot-doctor report")
    assert "| ttyACM0" in out and "| video0" in out
    assert "udev rules: not installed" in out
    assert "No calibration files found" in out

    assert cli.main(["report", "--rules-path", str(rules), "--json"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert set(data) == {"system", "ports", "cameras", "udev", "calibration"}
    assert data["system"]["lerobot_doctor"] == cli.__version__


def test_report_exit_code_flags_problems(tmp_path: Path, monkeypatch, capsys):
    monkeypatch.setattr(cli.device_helpers, "get_arms", lambda: [])
    monkeypatch.setattr(cli.device_helpers, "get_cameras", lambda: [])
    monkeypatch.setattr(cli.path_policy, "calibration_root", lambda: tmp_path / "calibration")
    monkeypatch.setattr(cli, "_user_groups", lambda: [])
    assert cli.main(["report", "--rules-path", str(tmp_path / "none.rules")]) == 1
    assert "sudo usermod -aG dialout,video" in capsys.readouterr().out
