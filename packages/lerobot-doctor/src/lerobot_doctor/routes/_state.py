"""Hardware-layer application state passed to every route factory.

LeStudio subclasses this (lestudio.routes._state.AppState) to add its own job tables.
"""

from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass
from pathlib import Path

from lerobot_doctor._config_helpers import _load_config, _save_config
from lerobot_doctor.process_manager import ProcessManager

logger = logging.getLogger(__name__)


@dataclass
class AppState:
    proc_mgr: ProcessManager
    config_path: Path
    config_dir: Path
    rules_path: Path
    fallback_rules_path: Path
    history_path: Path
    history_max: int
    python_exe: str
    device_watcher: object | None = None

    def load_config(self) -> dict:
        return _load_config(self.config_path)

    def save_config(self, cfg: dict) -> None:
        _save_config(self.config_path, cfg)

    def append_history(self, event_type: str, meta: dict | None = None) -> None:
        """Append a session event to history.json (best-effort, never raises)."""
        entry = {
            "ts": datetime.datetime.now().isoformat(timespec="seconds"),
            "type": event_type,
            "meta": meta or {},
        }
        try:
            if self.history_path.exists():
                entries = json.loads(self.history_path.read_text())
                if not isinstance(entries, list):
                    entries = []
            else:
                entries = []
            entries.append(entry)
            if len(entries) > self.history_max:
                entries = entries[-self.history_max :]
            self.history_path.write_text(json.dumps(entries, indent=2))
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass
