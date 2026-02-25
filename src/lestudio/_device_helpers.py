"""Device detection helpers (cameras, arms, USB)."""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

# Stable symlink role names for cameras
CAMERA_ROLES = [
    "(none)", "top_cam_1", "top_cam_2", "top_cam_3",
    "wrist_cam_1", "wrist_cam_2",
]


def udev_props(dev_path: str) -> dict:
    try:
        r = subprocess.run(
            ["udevadm", "info", "--query=property", dev_path],
            capture_output=True, text=True, timeout=2,
        )
        return dict(ln.split("=", 1) for ln in r.stdout.splitlines() if "=" in ln)
    except Exception:
        return {}


def kernels_from_devpath(devpath: str) -> str:
    for part in reversed(devpath.split("/")):
        if re.match(r"^\d+-\d+(\.\d+)*$", part):
            return part
    return ""


def find_symlink(target_name: str) -> str:
    for f in Path("/dev").iterdir():
        try:
            if f.is_symlink() and f.resolve().name == target_name:
                return f.name
        except Exception:
            pass
    return ""


def get_cameras() -> list[dict]:
    cameras = []
    for video in sorted(Path("/dev").glob("video*")):
        if not re.match(r"^video\d+$", video.name):
            continue
        try:
            idx = int(Path(f"/sys/class/video4linux/{video.name}/index").read_text().strip())
            if idx != 0:
                continue
        except Exception:
            continue
        props = udev_props(str(video))
        kernels = kernels_from_devpath(props.get("DEVPATH", ""))
        cameras.append({
            "device":  video.name,
            "path":    str(video),
            "kernels": kernels,
            "symlink": find_symlink(video.name),
            "model":   props.get("ID_MODEL", "Unknown"),
        })
    return cameras


def get_arms() -> list[dict]:
    arms = []
    for p in sorted(Path("/dev").glob("tty*")):
        if not any(x in p.name for x in ("USB", "ACM")):
            continue
        props = udev_props(str(p))
        arms.append({
            "device":  p.name,
            "path":    str(p),
            "symlink": find_symlink(p.name),
            "serial": props.get("ID_SERIAL_SHORT", ""),
            "kernels": kernels_from_devpath(props.get("DEVPATH", "")),
        })
    return arms


def get_usb_bus_for_camera(video_name: str) -> dict:
    try:
        dev = Path(f"/sys/class/video4linux/{video_name}/device").resolve()
        parts = str(dev).split("/")
        usb_port = next(p for p in reversed(parts) if re.match(r"^\d+-[\d.]+$", p))
        bus = usb_port.split("-")[0]
        speed_path = Path(f"/sys/bus/usb/devices/usb{bus}/speed")
        max_mbps = int(speed_path.read_text().strip()) if speed_path.exists() else 480
        return {"bus": bus, "port": usb_port, "max_mbps": max_mbps}
    except Exception:
        return {"bus": "?", "port": "?", "max_mbps": 480}
