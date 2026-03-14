"""Single source of truth for LeStudio filesystem paths."""

from __future__ import annotations

import uuid
from pathlib import Path


def lerobot_cache_root() -> Path:
    return Path.home() / ".cache" / "huggingface" / "lerobot"


def dataset_local_dir(repo_id: str) -> Path:
    return lerobot_cache_root() / repo_id


def dataset_video_path(user: str, repo: str, camera: str, chunk: str, file: str) -> Path:
    return lerobot_cache_root() / user / repo / "videos" / camera / chunk / file


def calibration_root() -> Path:
    return lerobot_cache_root() / "calibration"


def calibration_dir(category: str, dir_name: str) -> Path:
    return calibration_root() / category / dir_name


def calibration_file(category: str, dir_name: str, device_id: str) -> Path:
    return calibration_dir(category, dir_name) / f"{device_id}.json"


def config_dir_default() -> Path:
    return Path.home() / ".config" / "lestudio"


def config_dir_legacy_candidates() -> list[Path]:
    home = Path.home()
    return [
        home / ".config" / "lerobot-studio",
        home / ".config" / "moment-lerobot-studio",
        home / ".config" / "moment-lestudio",
        home / ".config" / "lerobot-setup",
    ]


def temp_rules_path() -> Path:
    return Path(f"/tmp/99-lerobot.rules.{uuid.uuid4().hex}.new")
