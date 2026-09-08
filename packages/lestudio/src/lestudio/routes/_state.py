"""LeStudio application state: the hardware-layer state plus dataset job tables."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

from lerobot_checkup.routes._state import AppState as HardwareAppState


@dataclass
class DatasetJobState:
    push_jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    push_jobs_lock: threading.Lock = field(default_factory=threading.Lock)
    download_jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    download_jobs_lock: threading.Lock = field(default_factory=threading.Lock)
    derive_jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    derive_jobs_lock: threading.Lock = field(default_factory=threading.Lock)
    derive_procs: dict[str, Any] = field(default_factory=dict)
    derive_procs_lock: threading.Lock = field(default_factory=threading.Lock)
    stats_jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    stats_jobs_lock: threading.Lock = field(default_factory=threading.Lock)
    stats_cancel_events: dict[str, threading.Event] = field(default_factory=dict)
    stats_cancel_lock: threading.Lock = field(default_factory=threading.Lock)


@dataclass
class AppState(HardwareAppState):
    dataset_jobs: DatasetJobState = field(default_factory=DatasetJobState)
