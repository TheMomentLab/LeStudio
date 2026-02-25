"""MJPEG camera streaming helpers."""
from __future__ import annotations

import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional, cast

import cv2

from lestudio._config_helpers import _load_config

_DEFAULT_CAM_SETTINGS = {
    "codec": "MJPG", "width": 640, "height": 480, "fps": 30, "jpeg_quality": 70,
}
_PREVIEW_SETTINGS = {
    "codec": "MJPG", "width": 192, "height": 144, "fps": 5, "jpeg_quality": 50,
}

_cam_open_lock = threading.Lock()


class CameraStreamer:
    def __init__(self, path: str, settings: dict):
        self.real_path = os.path.realpath(path)
        self.settings = settings
        self.latest_frame: bytes | None = None
        self.running = True
        self.failed = False
        self.clients = 0
        self._fps: float = 0.0
        self._mbps: float = 0.0
        self._stat_frames: int = 0
        self._stat_bytes: int = 0
        self._stat_ts: float = time.monotonic()
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _capture_loop(self):
        s = self.settings
        cap = None
        for attempt in range(5):
            opened = False
            with _cam_open_lock:
                cap = cv2.VideoCapture(self.real_path)
                fourcc_fn = getattr(cv2, "VideoWriter_fourcc", None)
                if callable(fourcc_fn):
                    fourcc = cast(int, fourcc_fn(*s["codec"]))
                else:
                    fourcc = cast(int, cv2.VideoWriter.fourcc(*s["codec"]))
                cap.set(cv2.CAP_PROP_FOURCC, float(fourcc))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, s["width"])
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, s["height"])
                cap.set(cv2.CAP_PROP_FPS, min(s["fps"], 8))
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        cap.set(cv2.CAP_PROP_FPS, s["fps"])
                        opened = True
                    else:
                        cap.release()
                        cap = None
                else:
                    cap.release()
                    cap = None
            if opened:
                time.sleep(0.5)
                break
            if cap is not None:
                cap.release()
                cap = None
            time.sleep(2.0)

        if not cap or not cap.isOpened():
            self.failed = True
            return

        quality = s["jpeg_quality"]
        target_fps = max(s["fps"], 1)
        frame_interval = 1.0 / target_fps
        last_encode_ts = 0.0

        while self.running:
            ret, frame = cap.read()
            if ret:
                now = time.monotonic()
                if now - last_encode_ts < frame_interval:
                    continue
                last_encode_ts = now
                _, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                self.latest_frame = jpg.tobytes()
                self._stat_frames += 1
                self._stat_bytes += len(self.latest_frame) if self.latest_frame else 0
                elapsed = now - self._stat_ts
                if elapsed >= 1.0:
                    self._fps  = self._stat_frames / elapsed
                    self._mbps = self._stat_bytes / elapsed / (1024 * 1024)
                    self._stat_frames = 0
                    self._stat_bytes  = 0
                    self._stat_ts     = now
            else:
                time.sleep(0.1)
        cap.release()

    def get_stats(self) -> dict:
        return {"fps": round(self._fps, 1), "mbps": round(self._mbps, 2)}

    def stop(self):
        self.running = False


# ─── Module-level streamer registry ───────────────────────────────────────────
_streamers: dict[str, CameraStreamer] = {}
_streamers_lock = threading.Lock()

_preview_streamers: dict[str, CameraStreamer] = {}
_cameras_locked = False  # When True, no new streamers will be created (cameras reserved for subprocess)
_preview_lock = threading.Lock()
_rerun_server_proc: Optional[subprocess.Popen] = None
_rerun_server_lock = threading.Lock()


def _get_cam_settings(config_path: Path) -> dict:
    cfg = _load_config(config_path)
    return {**_DEFAULT_CAM_SETTINGS, **cfg.get("camera_settings", {})}


def get_streamer(video_path: str, config_path: Path) -> CameraStreamer | None:
    if _cameras_locked:
        return None
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


def get_preview_streamer(video_path: str) -> CameraStreamer | None:
    if _cameras_locked:
        return None
    real_path = os.path.realpath(video_path)
    with _preview_lock:
        if real_path not in _preview_streamers:
            _preview_streamers[real_path] = CameraStreamer(real_path, _PREVIEW_SETTINGS)
        _preview_streamers[real_path].clients += 1
        return _preview_streamers[real_path]


def release_preview_streamer(video_path: str):
    real_path = os.path.realpath(video_path)
    with _preview_lock:
        if real_path in _preview_streamers:
            _preview_streamers[real_path].clients -= 1
            if _preview_streamers[real_path].clients <= 0:
                _preview_streamers[real_path].stop()
                del _preview_streamers[real_path]


def stop_all_streamers_for_process():
    global _cameras_locked
    _cameras_locked = True  # Block any new streamer creation from browser requests
    threads = []
    with _streamers_lock:
        for streamer in _streamers.values():
            streamer.stop()
            threads.append(streamer.thread)
        _streamers.clear()
    with _preview_lock:
        for streamer in _preview_streamers.values():
            streamer.stop()
            threads.append(streamer.thread)
        _preview_streamers.clear()
    # Wait for ALL capture threads to fully exit and release their cameras
    for t in threads:
        t.join(timeout=5.0)
    time.sleep(1.5)  # Extra buffer for V4L2 device node release


def unlock_cameras():
    global _cameras_locked
    _cameras_locked = False


def ensure_rerun_web_server(python_exe: str, web_port: int = 9090, grpc_port: int = 9876):
    global _rerun_server_proc
    with _rerun_server_lock:
        if _rerun_server_proc is not None and _rerun_server_proc.poll() is None:
            return
        cmd = [
            python_exe,
            "-c",
            (
                "import time;"
                "import rerun as rr;"
                "rr.init('lestudio_view', spawn=False);"
                f"rr.serve_grpc(grpc_port={grpc_port});"
                f"rr.serve_web_viewer(web_port={web_port}, open_browser=False, connect_to='rerun+http://127.0.0.1:{grpc_port}/proxy');"
                "\nwhile True:\n    time.sleep(3600)"
            ),
        ]
        _rerun_server_proc = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )


def restart_all_streamers(config_path: Path):
    with _streamers_lock:
        for streamer in _streamers.values():
            streamer.stop()
        paths = list(_streamers.keys())
        _streamers.clear()
    with _preview_lock:
        for streamer in _preview_streamers.values():
            streamer.stop()
        _preview_streamers.clear()
    time.sleep(1.5)
    settings = _get_cam_settings(config_path)
    for p in paths:
        with _streamers_lock:
            _streamers[p] = CameraStreamer(p, settings)
            _streamers[p].clients = 1
