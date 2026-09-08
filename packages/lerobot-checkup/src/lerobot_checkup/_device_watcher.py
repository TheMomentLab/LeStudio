from __future__ import annotations

import logging
import re
import threading
from pathlib import Path

logger = logging.getLogger(__name__)


class DeviceWatcher:
    def __init__(self, interval_sec: float = 2.0) -> None:
        self._interval_sec = interval_sec
        self._generation = 0
        self._generation_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._snapshot: frozenset[str] = frozenset()

    @property
    def generation(self) -> int:
        with self._generation_lock:
            return self._generation

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._snapshot = self._scan_snapshot()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="device-watcher")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=self._interval_sec + 0.5)
        self._thread = None

    def _run_loop(self) -> None:
        while not self._stop_event.wait(self._interval_sec):
            current = self._scan_snapshot()
            if current == self._snapshot:
                continue

            added = sorted(current - self._snapshot)
            removed = sorted(self._snapshot - current)
            logger.info("Device change detected: added=%s, removed=%s", added, removed)

            self._snapshot = current
            with self._generation_lock:
                self._generation += 1

    def _scan_snapshot(self) -> frozenset[str]:
        names: set[str] = set()

        for video in Path("/dev").glob("video*"):
            if not re.match(r"^video\d+$", video.name):
                continue
            try:
                idx_text = Path(f"/sys/class/video4linux/{video.name}/index").read_text().strip()
                if int(idx_text) != 0:
                    continue
            except (OSError, ValueError):
                continue
            names.add(video.name)

        for port in Path("/dev").glob("ttyUSB*"):
            names.add(port.name)
        for port in Path("/dev").glob("ttyACM*"):
            names.add(port.name)

        return frozenset(names)
