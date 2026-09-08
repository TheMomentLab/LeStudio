"""``lerobot-doctor`` command line.

Every subcommand answers one hardware-setup question and can print JSON
(``--json``) so the answer can be pasted into a LeRobot issue verbatim:

    lerobot-doctor ports                 serial ports that look like arms
    lerobot-doctor cameras               V4L2 cameras and their USB bus
    lerobot-doctor motors --port PORT    ping Feetech motors, read pos/load/current
    lerobot-doctor calibration [FILE..]  validate calibration files
    lerobot-doctor udev status|install   stable /dev symlinks
    lerobot-doctor report                everything above, as Markdown
    lerobot-doctor serve                 the web UI (also the default with no arguments)

Exit status: 0 when nothing is wrong, 1 when a check found a problem,
2 for usage errors.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import subprocess
import sys
import warnings
from collections.abc import Callable, Iterable
from importlib import metadata
from pathlib import Path
from typing import Any

# device_registry warns at import time when lerobot is absent. The report
# states lerobot availability explicitly, so keep the CLI output clean.
warnings.filterwarnings("ignore", message="LeRobot not available")

from lerobot_doctor import __version__, calibration_validator, device_helpers, path_policy  # noqa: E402

DEFAULT_RULES_PATH = Path("/etc/udev/rules.d/99-lerobot.rules")
REQUIRED_GROUPS = ("dialout", "video")
DEFAULT_MOTOR_IDS = "1-6"
DEFAULT_MOTOR_MODEL = "sts3215"
DEFAULT_SERVE_PORT = 7861

# ─── Collectors (pure data, used by both the text and JSON renderers) ─────────


def lerobot_version() -> str | None:
    try:
        return metadata.version("lerobot")
    except metadata.PackageNotFoundError:
        return None


def _user_groups() -> list[str]:
    try:
        import grp

        return sorted({grp.getgrgid(gid).gr_name for gid in os.getgroups()})
    except (ImportError, KeyError, OSError):
        return []


def collect_system() -> dict[str, Any]:
    groups = _user_groups()
    membership = {name: name in groups for name in REQUIRED_GROUPS}
    return {
        "os": platform.platform(),
        "kernel": platform.release(),
        "python": platform.python_version(),
        "lerobot_doctor": __version__,
        "lerobot": lerobot_version(),
        "user": os.environ.get("USER") or os.environ.get("USERNAME") or "",
        "groups": membership,
        "missing_groups": [name for name, ok in membership.items() if not ok],
    }


def collect_ports() -> list[dict[str, Any]]:
    return device_helpers.get_arms()


def collect_cameras() -> list[dict[str, Any]]:
    cameras = device_helpers.get_cameras()
    for cam in cameras:
        cam["usb"] = device_helpers.get_usb_bus_for_camera(str(cam.get("device", "")))
    return cameras


def _extract_symlink_names(rules_content: str) -> list[str]:
    matches = re.findall(r'SYMLINK\+="([^"]+)"', rules_content)
    return sorted(set(matches))


def _symlink_status(symlink: str) -> dict[str, Any]:
    path = Path("/dev") / symlink
    if not path.exists() and not path.is_symlink():
        return {"symlink": symlink, "status": "missing", "target": ""}
    try:
        return {"symlink": symlink, "status": "ok", "target": str(path.resolve())}
    except (OSError, RuntimeError) as exc:
        return {"symlink": symlink, "status": "broken", "target": str(exc)}


def collect_udev(rules_path: Path = DEFAULT_RULES_PATH) -> dict[str, Any]:
    if not rules_path.exists():
        return {"path": str(rules_path), "present": False, "symlinks": [], "missing": []}
    try:
        content = rules_path.read_text(encoding="utf-8")
    except OSError as exc:
        return {"path": str(rules_path), "present": True, "error": str(exc), "symlinks": [], "missing": []}
    statuses = [_symlink_status(name) for name in _extract_symlink_names(content)]
    return {
        "path": str(rules_path),
        "present": True,
        "symlinks": statuses,
        "missing": [s["symlink"] for s in statuses if s["status"] != "ok"],
    }


def _guess_device_type(path: Path) -> str:
    """``.../calibration/{robots|teleoperators}/<type>/<id>.json`` → ``<type>``."""
    parent = path.parent
    if parent.parent.name in {"robots", "teleoperators"}:
        return parent.name
    return ""


def find_calibration_files(root: Path | None = None) -> list[Path]:
    base = root if root is not None else path_policy.calibration_root()
    if not base.is_dir():
        return []
    return sorted(p for p in base.rglob("*.json") if p.is_file())


def collect_calibration(paths: Iterable[Path] | None = None, *, device_type: str = "") -> dict[str, Any]:
    files = list(paths) if paths is not None else find_calibration_files()
    results: list[dict[str, Any]] = []
    for path in files:
        dtype = device_type or _guess_device_type(path)
        result = calibration_validator.validate_calibration_file(path, device_type=dtype).to_dict()
        result["device_type"] = dtype
        results.append(result)
    return {
        "root": str(path_policy.calibration_root()),
        "files": results,
        "n_files": len(results),
        "n_errors": sum(1 for r in results if not r["ok"]),
        "n_warnings": sum(len(r["warnings"]) for r in results),
    }


def collect_calibration_pair(leader: Path, follower: Path, *, leader_type: str = "", follower_type: str = "") -> dict:
    return calibration_validator.validate_and_cross_validate(
        leader,
        follower,
        leader_type=leader_type or _guess_device_type(leader),
        follower_type=follower_type or _guess_device_type(follower),
    )


def parse_motor_ids(spec: str) -> list[int]:
    """``"1-6"`` → ``[1..6]``; ``"1,2,5"`` → ``[1, 2, 5]``; mixes allowed."""
    ids: list[int] = []
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            ids.extend(range(int(lo), int(hi) + 1))
        else:
            ids.append(int(part))
    if not ids:
        raise ValueError("no motor ids given")
    return sorted(set(ids))


def read_motors(port: str, motor_ids: list[int], model: str = DEFAULT_MOTOR_MODEL, *, samples: int = 5) -> dict:
    """Connect to a Feetech bus, read each motor a few times, disconnect.

    Load and current are sampled every fifth read by the bridge, so
    ``samples`` defaults to five to get one full row per motor.
    """
    from lerobot_doctor.motor_monitor_bridge import MotorMonitorBridge

    bridge = MotorMonitorBridge()
    connected = bridge.connect(port, motor_ids, model=model)
    if not connected.get("ok"):
        return {
            "ok": False,
            "port": port,
            "requested_ids": motor_ids,
            "error": connected.get("error", "connect failed"),
        }
    try:
        reading: dict = {}
        for _ in range(max(1, samples)):
            reading = bridge.read_positions()
        motors = {int(mid): entry for mid, entry in (reading.get("motors") or {}).items()}
        return {
            "ok": True,
            "port": port,
            "model": model,
            "requested_ids": motor_ids,
            "connected_ids": list(connected.get("connected_ids", [])),
            "missing_ids": [mid for mid in motor_ids if mid not in motors],
            "motors": motors,
        }
    finally:
        bridge.disconnect()


def collect_report(rules_path: Path = DEFAULT_RULES_PATH) -> dict[str, Any]:
    return {
        "system": collect_system(),
        "ports": collect_ports(),
        "cameras": collect_cameras(),
        "udev": collect_udev(rules_path),
        "calibration": collect_calibration(),
    }


# ─── Rendering ────────────────────────────────────────────────────────────────


def _table(rows: list[dict[str, Any]], columns: list[tuple[str, str]], *, markdown: bool = False) -> str:
    """Render ``rows`` as an aligned text table (or a Markdown table)."""
    headers = [title for _, title in columns]
    cells = [[str(row.get(key, "") if row.get(key, "") is not None else "") for key, _ in columns] for row in rows]
    widths = [max(len(h), *(len(r[i]) for r in cells)) if cells else len(h) for i, h in enumerate(headers)]
    if markdown:
        out = ["| " + " | ".join(h.ljust(w) for h, w in zip(headers, widths, strict=True)) + " |"]
        out.append("| " + " | ".join("-" * w for w in widths) + " |")
        out += ["| " + " | ".join(c.ljust(w) for c, w in zip(r, widths, strict=True)) + " |" for r in cells]
        return "\n".join(out)
    out = ["  ".join(h.ljust(w) for h, w in zip(headers, widths, strict=True)).rstrip()]
    out += ["  ".join(c.ljust(w) for c, w in zip(r, widths, strict=True)).rstrip() for r in cells]
    return "\n".join(out)


PORT_COLUMNS = [
    ("device", "device"),
    ("path", "path"),
    ("symlink", "symlink"),
    ("serial", "serial"),
    ("kernels", "usb"),
]
CAMERA_COLUMNS = [
    ("device", "device"),
    ("symlink", "symlink"),
    ("model", "model"),
    ("usb_port", "usb"),
    ("max_mbps", "mbps"),
]


def render_ports(ports: list[dict[str, Any]], *, markdown: bool = False) -> str:
    if not ports:
        return "No serial ports found (looked for /dev/ttyUSB* and /dev/ttyACM*)."
    return _table(ports, PORT_COLUMNS, markdown=markdown)


def render_cameras(cameras: list[dict[str, Any]], *, markdown: bool = False) -> str:
    if not cameras:
        return "No cameras found (looked for /dev/video* with index 0)."
    rows = []
    for cam in cameras:
        usb = cam.get("usb") or {}
        rows.append({**cam, "usb_port": usb.get("port", "?"), "max_mbps": usb.get("max_mbps", "")})
    return _table(rows, CAMERA_COLUMNS, markdown=markdown)


def render_udev(udev: dict[str, Any]) -> str:
    if not udev.get("present"):
        return f"udev rules: not installed ({udev['path']})"
    lines = [f"udev rules: {udev['path']}"]
    if udev.get("error"):
        lines.append(f"  [WARN] could not read rules: {udev['error']}")
    for entry in udev["symlinks"]:
        tag = {"ok": "OK", "missing": "MISSING", "broken": "WARN"}[entry["status"]]
        suffix = f" -> {entry['target']}" if entry["target"] else ""
        lines.append(f"  [{tag}] /dev/{entry['symlink']}{suffix}")
    if not udev["symlinks"]:
        lines.append("  (no SYMLINK entries)")
    return "\n".join(lines)


def _issue_lines(result: dict[str, Any]) -> list[str]:
    lines = []
    for issue in result.get("errors", []) + result.get("warnings", []):
        joint = f"{issue['joint']}: " if issue.get("joint") else ""
        lines.append(f"    [{issue['severity'].upper()}] {joint}{issue['message']} ({issue['code']})")
    return lines


def render_calibration(report: dict[str, Any], *, markdown: bool = False) -> str:
    if not report["files"]:
        return f"No calibration files found under {report['root']}."
    if markdown:
        rows = [
            {
                "file": Path(r["path"]).name,
                "type": r.get("device_type") or "-",
                "status": "OK" if r["ok"] else "ERROR",
                "errors": len(r["errors"]),
                "warnings": len(r["warnings"]),
            }
            for r in report["files"]
        ]
        return _table(
            rows,
            [("file", "file"), ("type", "type"), ("status", "status"), ("errors", "errors"), ("warnings", "warnings")],
            markdown=True,
        )
    lines = []
    for r in report["files"]:
        tag = "OK" if r["ok"] else "ERROR"
        if r["ok"] and r["warnings"]:
            tag = "WARN"
        dtype = f" ({r['device_type']})" if r.get("device_type") else ""
        lines.append(f"[{tag}] {r['path']}{dtype}")
        lines.extend(_issue_lines(r))
    lines.append(f"{report['n_files']} file(s), {report['n_errors']} with errors, {report['n_warnings']} warning(s)")
    return "\n".join(lines)


def render_pair(pair: dict[str, Any]) -> str:
    lines = []
    for label in ("leader", "follower"):
        r = pair[label]
        tag = "OK" if r["ok"] else "ERROR"
        lines.append(f"[{tag}] {label}: {r['path']}")
        lines.extend(_issue_lines(r))
    cross = pair["cross"]
    if cross["warnings"]:
        lines.append("[WARN] leader/follower cross-check:")
        lines.extend(_issue_lines(cross))
    else:
        lines.append("[OK] leader/follower cross-check")
    return "\n".join(lines)


def render_motors(result: dict[str, Any]) -> str:
    if not result.get("ok"):
        return f"[ERROR] {result['port']}: {result.get('error', 'unknown error')}"
    rows = [
        {"id": mid, **{k: entry.get(k) for k in ("position", "load", "current")}, "collision": entry.get("collision")}
        for mid, entry in sorted(result["motors"].items())
    ]
    lines = [
        f"{result['port']} ({result['model']}): {len(result['connected_ids'])}/{len(result['requested_ids'])} motors responded"
    ]
    if rows:
        lines.append(
            _table(
                rows,
                [
                    ("id", "id"),
                    ("position", "position"),
                    ("load", "load"),
                    ("current", "current"),
                    ("collision", "collision"),
                ],
            )
        )
    if result["missing_ids"]:
        lines.append(f"[MISSING] ids {result['missing_ids']}: no response. Check power, daisy chain, and motor IDs.")
    return "\n".join(lines)


def render_report(report: dict[str, Any]) -> str:
    system = report["system"]
    lines = ["# lerobot-doctor report", ""]
    lines.append(f"- OS: {system['os']} (kernel {system['kernel']})")
    lines.append(f"- Python: {system['python']}")
    lines.append(f"- lerobot: {system['lerobot'] or 'not installed'}")
    lines.append(f"- lerobot-doctor: {system['lerobot_doctor']}")
    groups = ", ".join(f"{name} {'OK' if ok else 'MISSING'}" for name, ok in system["groups"].items())
    lines.append(f"- User groups: {groups}")
    if system["missing_groups"]:
        joined = ",".join(system["missing_groups"])
        lines.append(f"  - fix: `sudo usermod -aG {joined} $USER` then log out and back in")
    lines += ["", "## Serial ports (arms)", "", render_ports(report["ports"], markdown=True)]
    lines += ["", "## Cameras", "", render_cameras(report["cameras"], markdown=True)]
    lines += ["", "## udev rules", "", "```", render_udev(report["udev"]), "```"]
    lines += ["", "## Calibration files", "", render_calibration(report["calibration"], markdown=True)]
    return "\n".join(lines) + "\n"


def report_has_problems(report: dict[str, Any]) -> bool:
    return bool(
        report["system"]["missing_groups"] or report["udev"].get("missing") or report["calibration"]["n_errors"]
    )


# ─── udev install (shared with the LeStudio CLI) ──────────────────────────────


def _manual_commands(source_rules: Path, target_rules: Path) -> list[str]:
    return [
        f"sudo cp {source_rules} {target_rules}",
        "sudo udevadm control --reload-rules",
        "sudo udevadm trigger --subsystem-match=video4linux",
        "sudo udevadm trigger --subsystem-match=tty",
    ]


def _print_verify_symlinks(symlinks: list[str], out: Callable[[str], None] = print) -> None:
    if not symlinks:
        out("- Verify: no SYMLINK entries found in rules file")
        return
    out("- Verify symlinks:")
    for entry in (_symlink_status(name) for name in symlinks):
        if entry["status"] == "missing":
            out(f"  [MISSING] /dev/{entry['symlink']}")
        elif entry["status"] == "ok":
            out(f"  [OK] /dev/{entry['symlink']} -> {entry['target']}")
        else:
            out(f"  [WARN] /dev/{entry['symlink']} exists but resolve failed: {entry['target']}")


def install_udev_rules(source_rules: Path, target_rules: Path, *, dry_run: bool = False) -> int:
    """Copy ``source_rules`` to ``target_rules`` with sudo and reload udev.

    Returns a process-style exit code and prints progress, so both CLIs can
    call it directly.
    """
    print(f"Source rules: {source_rules}")
    print(f"Target rules: {target_rules}")

    if not source_rules.exists():
        print("ERROR: source rules file does not exist.", file=sys.stderr)
        print("Generate/save mapping rules from the web UI first, or pass --source-rules.", file=sys.stderr)
        print(f"Expected file: {source_rules}", file=sys.stderr)
        return 1

    print("\nCommands to run:")
    for cmd in _manual_commands(source_rules, target_rules):
        print(f"  {cmd}")

    if dry_run:
        print("\nDry-run complete. No system changes were made.")
        return 0

    steps: list[tuple[list[str], bool, str]] = [
        (["sudo", "cp", str(source_rules), str(target_rules)], True, "Failed to copy rules file"),
        (["sudo", "udevadm", "control", "--reload-rules"], True, "udevadm reload failed"),
        (["sudo", "udevadm", "trigger", "--subsystem-match=video4linux"], False, "udevadm trigger video4linux failed"),
        (["sudo", "udevadm", "trigger", "--subsystem-match=tty"], False, "udevadm trigger tty failed"),
    ]
    for argv, fatal, fallback_msg in steps:
        res = subprocess.run(argv, capture_output=True, text=True)
        if res.returncode == 0:
            continue
        err = (res.stderr or "").strip() or fallback_msg
        if fatal:
            print(f"ERROR: {err}", file=sys.stderr)
            return res.returncode or 1
        print(f"WARN: {err}")

    print("\nInstall complete.")
    _print_verify_symlinks(_extract_symlink_names(source_rules.read_text()))
    return 0


# ─── Commands ─────────────────────────────────────────────────────────────────


def _emit(data: Any, text: str, as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2, default=str))
    else:
        print(text)


def cmd_ports(args: argparse.Namespace) -> int:
    ports = collect_ports()
    _emit(ports, render_ports(ports), args.json)
    return 0


def cmd_cameras(args: argparse.Namespace) -> int:
    cameras = collect_cameras()
    _emit(cameras, render_cameras(cameras), args.json)
    return 0


def cmd_motors(args: argparse.Namespace) -> int:
    try:
        ids = parse_motor_ids(args.ids)
    except ValueError as exc:
        print(f"ERROR: invalid --ids {args.ids!r}: {exc}", file=sys.stderr)
        return 2
    if lerobot_version() is None:
        msg = "lerobot is not installed; the motor check needs it: pip install 'lerobot[feetech]'"
        _emit({"ok": False, "port": args.port, "error": msg}, f"[ERROR] {msg}", args.json)
        return 1
    result = read_motors(args.port, ids, model=args.model)
    _emit(result, render_motors(result), args.json)
    return 0 if result.get("ok") and not result.get("missing_ids") else 1


def cmd_calibration(args: argparse.Namespace) -> int:
    if args.pair:
        leader, follower = (Path(p) for p in args.pair)
        pair = collect_calibration_pair(leader, follower, leader_type=args.type, follower_type=args.type)
        _emit(pair, render_pair(pair), args.json)
        return 0 if pair["leader"]["ok"] and pair["follower"]["ok"] else 1
    paths = [Path(p) for p in args.paths] if args.paths else None
    report = collect_calibration(paths, device_type=args.type)
    _emit(report, render_calibration(report), args.json)
    return 0 if report["n_errors"] == 0 else 1


def cmd_udev_status(args: argparse.Namespace) -> int:
    udev = collect_udev(args.rules_path)
    _emit(udev, render_udev(udev), args.json)
    return 0 if udev.get("present") and not udev.get("missing") else 1


def cmd_udev_install(args: argparse.Namespace) -> int:
    config_dir = args.config_dir if args.config_dir is not None else path_policy.config_dir_default()
    source = args.source_rules if args.source_rules is not None else (config_dir / "99-lerobot.rules")
    return install_udev_rules(source, args.rules_path, dry_run=args.dry_run)


def cmd_serve(args: argparse.Namespace) -> int:
    from lerobot_doctor import serve as srv
    from lerobot_doctor._auth import generate_token
    from lerobot_doctor.server import create_app

    lerobot_src = srv.resolve_lerobot_src(args.lerobot_path)
    config_dir = srv.resolve_config_dir(args.config_dir)
    token = generate_token()
    app = create_app(lerobot_src=lerobot_src, config_dir=config_dir, rules_path=args.rules_path, session_token=token)
    srv.print_banner(
        "lerobot-doctor",
        __version__,
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        host=args.host,
        port=args.port,
        token=token,
    )
    srv.maybe_open_browser(args.browser, args.port)
    srv.run_uvicorn(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_factory="lerobot_doctor.server:create_app_from_env",
        reload_env={
            "_LEROBOT_DOCTOR_LEROBOT_SRC": str(lerobot_src),
            "_LEROBOT_DOCTOR_CONFIG_DIR": str(config_dir),
            "_LEROBOT_DOCTOR_RULES_PATH": str(args.rules_path),
            "_LEROBOT_DOCTOR_TOKEN": token,
        },
        reload_dirs=[str(Path(__file__).parent)],
    )
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    report = collect_report(args.rules_path)
    _emit(report, render_report(report), args.json)
    return 1 if report_has_problems(report) else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lerobot-doctor",
        description="Hardware setup and diagnostics for LeRobot arms and cameras.",
        epilog="Add --json to any command to get machine-readable output for bug reports.",
    )
    parser.add_argument("--version", action="version", version=f"lerobot-doctor {__version__}")
    sub = parser.add_subparsers(dest="command")

    def add_json(p: argparse.ArgumentParser) -> None:
        p.add_argument("--json", action="store_true", help="Print JSON instead of text")

    p = sub.add_parser("ports", help="List serial ports that look like robot arms")
    add_json(p)
    p.set_defaults(handler=cmd_ports)

    p = sub.add_parser("cameras", help="List V4L2 cameras and the USB bus each one sits on")
    add_json(p)
    p.set_defaults(handler=cmd_cameras)

    p = sub.add_parser("motors", help="Ping Feetech motors on a port and read position / load / current")
    p.add_argument("--port", required=True, help="Serial port, e.g. /dev/ttyACM0 or /dev/follower_arm_1")
    p.add_argument("--ids", default=DEFAULT_MOTOR_IDS, help=f"Motor ids: range or list (default: {DEFAULT_MOTOR_IDS})")
    p.add_argument("--model", default=DEFAULT_MOTOR_MODEL, help=f"Feetech model (default: {DEFAULT_MOTOR_MODEL})")
    add_json(p)
    p.set_defaults(handler=cmd_motors)

    p = sub.add_parser("calibration", help="Validate calibration files (default: every file in the LeRobot cache)")
    p.add_argument("paths", nargs="*", help="Calibration JSON files to validate")
    p.add_argument("--pair", nargs=2, metavar=("LEADER", "FOLLOWER"), help="Cross-check a leader/follower pair")
    p.add_argument(
        "--type", default="", help="Device type for validation rules, e.g. so101_follower (default: from path)"
    )
    add_json(p)
    p.set_defaults(handler=cmd_calibration)

    p = sub.add_parser("udev", help="Stable /dev symlinks via udev rules")
    udev_sub = p.add_subparsers(dest="udev_command")
    s = udev_sub.add_parser("status", help="Show installed rules and whether each symlink exists")
    s.add_argument(
        "--rules-path", type=Path, default=DEFAULT_RULES_PATH, help=f"Rules file (default: {DEFAULT_RULES_PATH})"
    )
    add_json(s)
    s.set_defaults(handler=cmd_udev_status)
    i = udev_sub.add_parser("install", help="Copy a generated rules file into /etc/udev/rules.d with sudo")
    i.add_argument("--config-dir", type=Path, default=None, help="Config directory holding 99-lerobot.rules")
    i.add_argument(
        "--source-rules", type=Path, default=None, help="Source rules file (default: <config-dir>/99-lerobot.rules)"
    )
    i.add_argument(
        "--rules-path",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help=f"Target rules file (default: {DEFAULT_RULES_PATH})",
    )
    i.add_argument("--dry-run", action="store_true", help="Print the commands without applying them")
    i.set_defaults(handler=cmd_udev_install)
    p.set_defaults(handler=None, help_parser=p)

    p = sub.add_parser("serve", help="Run the web UI (default when no subcommand is given)")
    p.add_argument("--port", type=int, default=DEFAULT_SERVE_PORT, help=f"Server port (default: {DEFAULT_SERVE_PORT})")
    p.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    p.add_argument(
        "--config-dir",
        type=Path,
        default=None,
        help="Config directory (default: ~/.config/lestudio, shared with LeStudio)",
    )
    p.add_argument(
        "--rules-path", type=Path, default=DEFAULT_RULES_PATH, help=f"udev rules file (default: {DEFAULT_RULES_PATH})"
    )
    p.add_argument(
        "--lerobot-path",
        type=Path,
        default=None,
        help="Path to a lerobot source checkout (default: the installed package)",
    )
    p.add_argument("--browser", action="store_true", help="Open a browser automatically on startup")
    p.add_argument("--reload", action="store_true", help="Auto-reload on Python file changes (dev mode)")
    p.set_defaults(handler=cmd_serve)

    p = sub.add_parser("report", help="Everything above as one Markdown report to paste into an issue")
    p.add_argument(
        "--rules-path", type=Path, default=DEFAULT_RULES_PATH, help=f"Rules file (default: {DEFAULT_RULES_PATH})"
    )
    add_json(p)
    p.set_defaults(handler=cmd_report)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        argv = ["serve"]
    args = parser.parse_args(argv)
    handler = getattr(args, "handler", None)
    if handler is None:
        help_parser = getattr(args, "help_parser", parser)
        help_parser.print_help()
        return 2
    return int(handler(args))


if __name__ == "__main__":
    sys.exit(main())
