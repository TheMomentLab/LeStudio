#!/usr/bin/env python3
"""LeRobot Setup Tool — Web GUI server (packaged version)."""

import asyncio
import datetime
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

import cv2
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

CAMERA_ROLES = [
    "(none)", "top_cam_1", "top_cam_2", "top_cam_3",
    "follower_cam_1", "follower_cam_2",
]
ROBOT_TYPES = [
    "so101_follower", "so100_follower",
    "so101_leader",   "so100_leader",
]

DEFAULT_CONFIG = {
    "robot_mode":          "single",
    "follower_port":       "/dev/follower_arm_1",
    "leader_port":         "/dev/leader_arm_1",
    "robot_id":            "my_so101_follower_1",
    "teleop_id":           "my_so101_leader_1",
    "left_follower_port":  "/dev/follower_arm_1",
    "right_follower_port": "/dev/follower_arm_2",
    "left_leader_port":    "/dev/leader_arm_1",
    "right_leader_port":   "/dev/leader_arm_2",
    "left_robot_id":       "my_so101_follower_1",
    "right_robot_id":      "my_so101_follower_2",
    "left_teleop_id":      "my_so101_leader_1",
    "right_teleop_id":     "my_so101_leader_2",
    "cameras": {
        "front_1": "/dev/follower_cam_1",
        "top_1":   "/dev/top_cam_1",
        "top_2":   "/dev/top_cam_2",
    },
    "camera_settings": {
        "codec":        "MJPG",
        "width":        640,
        "height":       480,
        "fps":          30,
        "jpeg_quality": 70,
    },
    "record_task":     "",
    "record_episodes": 50,
    "record_repo_id":  "user/my-dataset",
}

_DEFAULT_CAM_SETTINGS = {
    "codec": "MJPG", "width": 640, "height": 480, "fps": 30, "jpeg_quality": 70,
}


# ─── Process Manager ───────────────────────────────────────────────────────────
class ProcessManager:
    def __init__(self, lerobot_src: Path):
        self.lerobot_src = lerobot_src
        self.procs: dict[str, subprocess.Popen] = {}
        self.out_q: queue.Queue = queue.Queue(maxsize=1000)

    def flush_queue(self, name: str):
        items = []
        while True:
            try:
                item = self.out_q.get_nowait()
                if item["process"] != name:
                    items.append(item)
            except queue.Empty:
                break
        for item in items:
            try:
                self.out_q.put_nowait(item)
            except queue.Full:
                pass

    def start(self, name: str, args: list[str]) -> bool:
        self.stop(name)
        self.flush_queue(name)
        env = {
            **os.environ,
            "PYTHONPATH": str(self.lerobot_src) + ":" + os.environ.get("PYTHONPATH", ""),
            "PYTHONUNBUFFERED": "1",
        }
        try:
            proc = subprocess.Popen(
                args, env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                bufsize=0,
            )
            self.procs[name] = proc
            threading.Thread(target=self._reader, args=(name, proc), daemon=True).start()
            return True
        except Exception as e:
            self._push(name, f"[ERROR] {e}", "error")
            return False

    def stop(self, name: str):
        proc = self.procs.pop(name, None)
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()

    def send_input(self, name: str, text: str):
        proc = self.procs.get(name)
        if proc and proc.poll() is None and proc.stdin:
            try:
                proc.stdin.write((text + "\n").encode())
                proc.stdin.flush()
            except Exception:
                pass

    def is_running(self, name: str) -> bool:
        proc = self.procs.get(name)
        return proc is not None and proc.poll() is None

    def status_all(self) -> dict:
        return {n: self.is_running(n) for n in ["teleop", "record", "calibrate", "motor_setup"]}

    def _reader(self, name: str, proc: subprocess.Popen):
        import select as sel
        if proc.stdout is None:
            return
        buf = b""
        while True:
            try:
                r, _, _ = sel.select([proc.stdout], [], [], 0.1)
            except Exception:
                break
            if r:
                chunk = proc.stdout.read(256)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    text = _ANSI_RE.sub("", line.decode("utf-8", errors="replace").rstrip("\r"))
                    if text:
                        self._push(name, text, "stdout")
            else:
                if buf:
                    text = _ANSI_RE.sub("", buf.decode("utf-8", errors="replace").rstrip("\r"))
                    if text:
                        self._push(name, text, "stdout")
                    buf = b""
                if proc.poll() is not None:
                    break
        if buf:
            text = _ANSI_RE.sub("", buf.decode("utf-8", errors="replace").rstrip("\r"))
            if text:
                self._push(name, text, "stdout")
        self._push(name, f"[{name} process ended]", "info")

    def _push(self, name: str, line: str, kind: str):
        try:
            self.out_q.put_nowait({"process": name, "line": line, "kind": kind})
        except queue.Full:
            pass


# ─── Device Detection ──────────────────────────────────────────────────────────
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
        arms.append({
            "device":  p.name,
            "path":    str(p),
            "symlink": find_symlink(p.name),
        })
    return arms


# ─── MJPEG Streaming ──────────────────────────────────────────────────────────
_cam_open_lock = threading.Lock()


class CameraStreamer:
    def __init__(self, path: str, settings: dict):
        self.real_path = os.path.realpath(path)
        self.settings = settings
        self.latest_frame: bytes | None = None
        self.running = True
        self.clients = 0
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _capture_loop(self):
        s = self.settings
        cap = None
        for attempt in range(5):
            with _cam_open_lock:
                cap = cv2.VideoCapture(self.real_path)
                fourcc = cv2.VideoWriter_fourcc(*s["codec"])
                cap.set(cv2.CAP_PROP_FOURCC, fourcc)
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, s["width"])
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, s["height"])
                cap.set(cv2.CAP_PROP_FPS, s["fps"])
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                # Let USB subsystem settle before next camera opens
                if cap.isOpened():
                    time.sleep(1.0)
            if cap.isOpened():
                break
            cap.release()
            cap = None
            time.sleep(1.0)

        if not cap or not cap.isOpened():
            return

        quality = s["jpeg_quality"]
        while self.running:
            ret, frame = cap.read()
            if ret:
                _, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                self.latest_frame = jpg.tobytes()
            else:
                time.sleep(0.1)
            time.sleep(0.01)
        cap.release()

    def stop(self):
        self.running = False


_streamers: dict[str, CameraStreamer] = {}
_streamers_lock = threading.Lock()


def _get_cam_settings(config_path: Path) -> dict:
    cfg = _load_config(config_path)
    return {**_DEFAULT_CAM_SETTINGS, **cfg.get("camera_settings", {})}


def get_streamer(video_path: str, config_path: Path) -> CameraStreamer:
    real_path = os.path.realpath(video_path)
    with _streamers_lock:
        if real_path not in _streamers:
            _streamers[real_path] = CameraStreamer(real_path, _get_cam_settings(config_path))
        _streamers[real_path].clients += 1
        return _streamers[real_path]


def release_streamer(video_path: str):
    real_path = os.path.realpath(video_path)
    with _streamers_lock:
        if real_path in _streamers:
            _streamers[real_path].clients -= 1
            if _streamers[real_path].clients <= 0:
                _streamers[real_path].stop()
                del _streamers[real_path]


def restart_all_streamers(config_path: Path):
    with _streamers_lock:
        for streamer in _streamers.values():
            streamer.stop()
        paths = list(_streamers.keys())
        _streamers.clear()
    time.sleep(1.5)
    settings = _get_cam_settings(config_path)
    for p in paths:
        with _streamers_lock:
            _streamers[p] = CameraStreamer(p, settings)
            _streamers[p].clients = 1


# ─── Config ────────────────────────────────────────────────────────────────────
def _load_config(config_path: Path) -> dict:
    if config_path.exists():
        return {**DEFAULT_CONFIG, **json.loads(config_path.read_text())}
    return DEFAULT_CONFIG.copy()


def _save_config(config_path: Path, cfg: dict):
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(cfg, indent=2))


# ─── udev Rules ────────────────────────────────────────────────────────────────
def _arm_rule_lines(rules_path: Path) -> list[str]:
    if not rules_path.exists():
        return []
    return [
        ln for ln in rules_path.read_text().splitlines()
        if "idVendor" in ln and "SYMLINK" in ln
    ]


def _build_rules(assignments: dict[str, str], rules_path: Path) -> str:
    lines = _arm_rule_lines(rules_path) + [
        "",
        "# LeRobot Camera Rules",
        '# Note: Cameras share Serial "SN0001", so we use physical port paths (KERNELS).',
        "# If you plug cameras into different ports, you MUST update these paths!",
        "",
    ]
    for kernels, role in sorted(assignments.items()):
        if role and role != "(none)":
            lines.append(
                f'SUBSYSTEM=="video4linux", KERNELS=="{kernels}", '
                f'ATTR{{index}}=="0", SYMLINK+="{role}", MODE="0666"'
            )
    return "\n".join(lines) + "\n"


def _apply_rules(assignments: dict[str, str], rules_path: Path) -> tuple[bool, str]:
    content = _build_rules(assignments, rules_path)
    tmp = Path("/tmp/99-lerobot.rules.new")
    tmp.write_text(content)
    r = subprocess.run(
        ["sudo", "-n", "cp", str(tmp), str(rules_path)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        return False, r.stderr or "sudo failed — add NOPASSWD to sudoers for cp/udevadm"
    subprocess.run(["sudo", "-n", "udevadm", "control", "--reload-rules"], capture_output=True)
    subprocess.run(
        ["sudo", "-n", "udevadm", "trigger", "--subsystem-match=video4linux"],
        capture_output=True,
    )
    return True, ""


# ─── App Factory ───────────────────────────────────────────────────────────────
def create_app(
    lerobot_src: Path,
    config_dir: Path,
    rules_path: Path,
) -> FastAPI:
    STATIC_DIR = Path(__file__).parent / "static"
    CONFIG_PATH = config_dir / "config.json"
    PYTHON = sys.executable

    app = FastAPI(title="LeRobot Setup Tool")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
    )

    class NoCacheStaticMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response: Response = await call_next(request)
            if request.url.path.startswith("/static/"):
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response

    app.add_middleware(NoCacheStaticMiddleware)

    proc_mgr = ProcessManager(lerobot_src)

    def load_config() -> dict:
        return _load_config(CONFIG_PATH)

    def save_config(cfg: dict):
        _save_config(CONFIG_PATH, cfg)

    # ─── API: Devices & Config ─────────────────────────────────────────────
    @app.get("/api/devices")
    def api_devices():
        return {"cameras": get_cameras(), "arms": get_arms()}

    @app.get("/api/config")
    def api_config_get():
        return load_config()

    @app.post("/api/config")
    async def api_config_save(data: dict):
        save_config(data)
        return {"ok": True}

    @app.get("/api/camera_roles")
    def api_camera_roles():
        return CAMERA_ROLES

    @app.get("/api/camera_settings")
    def api_camera_settings_get():
        return _get_cam_settings(CONFIG_PATH)

    @app.post("/api/camera_settings")
    async def api_camera_settings_save(data: dict):
        cfg = load_config()
        cfg["camera_settings"] = {**_DEFAULT_CAM_SETTINGS, **data}
        save_config(cfg)
        restart_all_streamers(CONFIG_PATH)
        return {"ok": True}

    @app.get("/api/robot_types")
    def api_robot_types():
        return ROBOT_TYPES

    # ─── API: udev Rules ───────────────────────────────────────────────────
    @app.get("/api/rules/current")
    def api_rules_current():
        return {"content": rules_path.read_text() if rules_path.exists() else "# File not found"}

    @app.post("/api/rules/preview")
    async def api_rules_preview(data: dict):
        return {"content": _build_rules(data.get("assignments", {}), rules_path)}

    @app.post("/api/rules/apply")
    async def api_rules_apply(data: dict):
        ok, err = _apply_rules(data.get("assignments", {}), rules_path)
        return {"ok": ok, "error": err}

    # ─── API: MJPEG Streaming ──────────────────────────────────────────────
    async def mjpeg_gen(video_path: str, request: Request):
        streamer = get_streamer(video_path, CONFIG_PATH)
        try:
            while True:
                if await request.is_disconnected():
                    break
                frame = streamer.latest_frame
                if frame:
                    yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                await asyncio.sleep(1 / 30)
        finally:
            release_streamer(video_path)

    @app.get("/stream/{video_name}")
    async def stream_camera(request: Request, video_name: str):
        return StreamingResponse(
            mjpeg_gen(f"/dev/{video_name}", request),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )

    # ─── API: Process Control ──────────────────────────────────────────────
    @app.get("/api/process/{name}/status")
    def api_proc_status(name: str):
        return {"running": proc_mgr.is_running(name)}

    @app.post("/api/process/{name}/stop")
    def api_proc_stop(name: str):
        proc_mgr.stop(name)
        return {"ok": True}

    @app.post("/api/process/{name}/input")
    async def api_proc_input(name: str, data: dict):
        proc_mgr.send_input(name, data.get("text", ""))
        return {"ok": True}

    # ─── API: Teleop ───────────────────────────────────────────────────────
    @app.post("/api/teleop/start")
    async def api_teleop_start(data: dict):
        if proc_mgr.is_running("teleop"):
            return {"ok": False, "error": "Already running"}
        cfg = data
        if cfg.get("robot_mode") == "bi":
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_teleoperate",
                "--robot.type=bi_so_follower",
                f'--robot.left_arm_config.port={cfg["left_follower_port"]}',
                f'--robot.right_arm_config.port={cfg["right_follower_port"]}',
                "--teleop.type=bi_so_leader",
                f'--teleop.left_arm_config.port={cfg["left_leader_port"]}',
                f'--teleop.right_arm_config.port={cfg["right_leader_port"]}',
            ]
        else:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_teleoperate",
                "--robot.type=so101_follower",
                f'--robot.port={cfg["follower_port"]}',
                f'--robot.id={cfg.get("robot_id", "my_so101_follower_1")}',
                "--teleop.type=so101_leader",
                f'--teleop.port={cfg["leader_port"]}',
                f'--teleop.id={cfg.get("teleop_id", "my_so101_leader_1")}',
            ]
        return {"ok": proc_mgr.start("teleop", args)}

    # ─── API: Record ───────────────────────────────────────────────────────
    @app.post("/api/record/start")
    async def api_record_start(data: dict):
        if proc_mgr.is_running("record"):
            return {"ok": False, "error": "Already running"}
        cfg = data
        base = [
            f'--dataset.repo_id={cfg.get("record_repo_id", "user/dataset")}',
            f'--dataset.num_episodes={cfg.get("record_episodes", 50)}',
            f'--dataset.single_task={cfg.get("record_task", "task")}',
            "--display_data=false",
        ]
        if cfg.get("robot_mode") == "bi":
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_record",
                "--robot.type=bi_so_follower",
                f'--robot.left_arm_config.port={cfg["left_follower_port"]}',
                f'--robot.right_arm_config.port={cfg["right_follower_port"]}',
                "--teleop.type=bi_so_leader",
                f'--teleop.left_arm_config.port={cfg["left_leader_port"]}',
                f'--teleop.right_arm_config.port={cfg["right_leader_port"]}',
            ] + base
        else:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_record",
                "--robot.type=so101_follower",
                f'--robot.port={cfg["follower_port"]}',
                f'--robot.id={cfg.get("robot_id", "my_so101_follower_1")}',
                "--teleop.type=so101_leader",
                f'--teleop.port={cfg["leader_port"]}',
                f'--teleop.id={cfg.get("teleop_id", "my_so101_leader_1")}',
            ] + base
        return {"ok": proc_mgr.start("record", args)}

    # ─── API: Calibrate ────────────────────────────────────────────────────
    @app.get("/api/calibrate/file")
    def api_calibrate_file(robot_type: str, robot_id: str):
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / "calibration"
        if "follower" in robot_type:
            path = base / "robots" / "so_follower" / f"{robot_id}.json"
        elif "leader" in robot_type:
            path = base / "teleoperators" / "so_leader" / f"{robot_id}.json"
        else:
            return {"exists": False, "error": "Unknown robot_type"}
        if path.exists():
            mtime = path.stat().st_mtime
            mdate = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            return {
                "exists": True,
                "path": str(path),
                "modified": mdate,
                "size": path.stat().st_size,
            }
        return {"exists": False, "path": str(path)}

    @app.get("/api/calibrate/list")
    def api_calibrate_list():
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / "calibration"
        files = []
        if base.exists():
            for p in base.rglob("*.json"):
                if not p.is_file():
                    continue
                mtime = p.stat().st_mtime
                mdate = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                rel = p.relative_to(base)
                path_str = str(rel)
                guessed_type = "so101_follower"
                if "leader" in path_str:
                    guessed_type = "so100_leader" if "100" in p.stem else "so101_leader"
                else:
                    guessed_type = "so100_follower" if "100" in p.stem else "so101_follower"
                files.append({
                    "id": p.stem,
                    "rel_path": path_str,
                    "modified": mdate,
                    "timestamp": mtime,
                    "size": p.stat().st_size,
                    "guessed_type": guessed_type,
                })
        files.sort(key=lambda x: x["timestamp"], reverse=True)
        return {"files": files}

    @app.delete("/api/calibrate/file")
    def api_calibrate_delete(robot_type: str, robot_id: str):
        base = Path.home() / ".cache" / "huggingface" / "lerobot" / "calibration"
        if "follower" in robot_type:
            path = base / "robots" / "so_follower" / f"{robot_id}.json"
        elif "leader" in robot_type:
            path = base / "teleoperators" / "so_leader" / f"{robot_id}.json"
        else:
            return {"ok": False, "error": "Unknown robot_type"}
        if path.exists():
            try:
                path.unlink()
                return {"ok": True}
            except Exception as e:
                return {"ok": False, "error": str(e)}
        return {"ok": False, "error": "File not found"}

    @app.post("/api/calibrate/start")
    async def api_calibrate_start(data: dict):
        if proc_mgr.is_running("calibrate"):
            return {"ok": False, "error": "Already running"}
        robot_type = data.get("robot_type", "so101_follower")
        robot_id = data.get("robot_id", "my_so101_follower_1")
        port = data.get("port", "/dev/follower_arm_1")
        if "leader" in robot_type:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_calibrate",
                f"--teleop.type={robot_type}",
                f"--teleop.port={port}",
                f"--teleop.id={robot_id}",
            ]
        else:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_calibrate",
                f"--robot.type={robot_type}",
                f"--robot.port={port}",
                f"--robot.id={robot_id}",
            ]
        return {"ok": proc_mgr.start("calibrate", args)}

    # ─── API: Motor Setup ──────────────────────────────────────────────────
    @app.post("/api/motor_setup/start")
    async def api_motor_setup_start(data: dict):
        if proc_mgr.is_running("motor_setup"):
            return {"ok": False, "error": "Already running"}
        robot_type = data.get("robot_type", "so101_follower")
        port = data.get("port", "/dev/follower_arm_1")
        if "leader" in robot_type:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_setup_motors",
                f"--teleop.type={robot_type}",
                f"--teleop.port={port}",
            ]
        else:
            args = [
                PYTHON, "-m", "lerobot.scripts.lerobot_setup_motors",
                f"--robot.type={robot_type}",
                f"--robot.port={port}",
            ]
        return {"ok": proc_mgr.start("motor_setup", args)}

    # ─── WebSocket ─────────────────────────────────────────────────────────
    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket):
        await websocket.accept()
        try:
            while True:
                items = []
                while True:
                    try:
                        items.append(proc_mgr.out_q.get_nowait())
                    except queue.Empty:
                        break
                for item in items:
                    await websocket.send_json({"type": "output", **item})
                await websocket.send_json({"type": "status", "processes": proc_mgr.status_all()})
                await asyncio.sleep(0.2)
        except (WebSocketDisconnect, Exception):
            pass

    # ─── Static + Root ─────────────────────────────────────────────────────
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def root():
        return HTMLResponse((STATIC_DIR / "index.html").read_text())

    return app
