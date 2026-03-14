# pyright: reportMissingImports=false

from __future__ import annotations

from pathlib import Path

from lestudio import path_policy


def test_lerobot_cache_root_uses_hf_lerobot_under_home(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert path_policy.lerobot_cache_root() == tmp_path / ".cache" / "huggingface" / "lerobot"


def test_dataset_paths_are_nested_under_cache_root(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert path_policy.dataset_local_dir("user/repo") == (
        tmp_path / ".cache" / "huggingface" / "lerobot" / "user/repo"
    )
    assert path_policy.dataset_video_path("user", "repo", "cam_top", "chunk-000", "episode_0001.mp4") == (
        tmp_path
        / ".cache"
        / "huggingface"
        / "lerobot"
        / "user"
        / "repo"
        / "videos"
        / "cam_top"
        / "chunk-000"
        / "episode_0001.mp4"
    )


def test_calibration_paths_nest_under_lerobot_cache_root(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    expected_root = tmp_path / ".cache" / "huggingface" / "lerobot" / "calibration"
    expected_dir = expected_root / "robots" / "so_follower"
    expected_file = expected_dir / "follower_arm_1.json"

    assert path_policy.calibration_root() == expected_root
    assert path_policy.calibration_dir("robots", "so_follower") == expected_dir
    assert path_policy.calibration_file("robots", "so_follower", "follower_arm_1") == expected_file


def test_config_paths_include_default_and_legacy_candidates(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)

    assert path_policy.config_dir_default() == tmp_path / ".config" / "lestudio"
    assert path_policy.config_dir_legacy_candidates() == [
        tmp_path / ".config" / "lerobot-studio",
        tmp_path / ".config" / "moment-lerobot-studio",
        tmp_path / ".config" / "moment-lestudio",
        tmp_path / ".config" / "lerobot-setup",
    ]


def test_temp_rules_path_uses_expected_tmp_prefix_and_suffix():
    path = path_policy.temp_rules_path()
    text = str(path)

    assert text.startswith("/tmp/99-lerobot.rules.")
    assert text.endswith(".new")
