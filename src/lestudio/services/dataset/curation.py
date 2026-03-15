from __future__ import annotations

import json
from typing import Any

from ... import path_policy
from .stats import get_episode_stats


def auto_flag_episode_stats(
    episodes_raw: Any,
    min_frames: int = 30,
    min_movement: float = 0.01,
    max_jerk_score: float = 5.0,
) -> dict[str, Any]:
    if not isinstance(episodes_raw, list):
        return {"ok": False, "error": "episodes must be a list"}

    flagged: list[dict[str, Any]] = []
    for item in episodes_raw:
        if not isinstance(item, dict):
            continue

        try:
            ep_idx = int(item.get("episode_index", 0))
        except Exception:
            continue

        try:
            frames = int(item.get("frames", 0) or 0)
        except Exception:
            frames = 0
        try:
            movement = float(item.get("movement", 0.0) or 0.0)
        except Exception:
            movement = 0.0
        try:
            jerk_score = float(item.get("jerk_score", 0.0) or 0.0)
        except Exception:
            jerk_score = 0.0

        reasons: list[str] = []
        if frames < int(min_frames):
            reasons.append("frames")
        if movement < float(min_movement):
            reasons.append("movement")
        if jerk_score > float(max_jerk_score):
            reasons.append("jerk_score")

        if reasons:
            flagged.append(
                {
                    "episode_index": ep_idx,
                    "frames": frames,
                    "movement": round(movement, 4),
                    "jerk_score": round(jerk_score, 4),
                    "reasons": reasons,
                }
            )

    flagged.sort(key=lambda x: int(x.get("episode_index", 0)))
    return {
        "ok": True,
        "thresholds": {
            "min_frames": int(min_frames),
            "min_movement": float(min_movement),
            "max_jerk_score": float(max_jerk_score),
        },
        "flagged": flagged,
        "flagged_count": len(flagged),
        "total_episodes": len(episodes_raw),
    }


def get_auto_flag_suggestions(
    user: str,
    repo: str,
    min_frames: int = 30,
    min_movement: float = 0.01,
    max_jerk_score: float = 5.0,
) -> dict[str, Any]:
    stats_result = get_episode_stats(user, repo)
    if not bool(stats_result.get("ok", False)):
        return stats_result

    flagged_result = auto_flag_episode_stats(
        stats_result.get("episodes", []),
        min_frames=min_frames,
        min_movement=min_movement,
        max_jerk_score=max_jerk_score,
    )
    if not bool(flagged_result.get("ok", False)):
        return flagged_result

    return {
        "ok": True,
        "cached": bool(stats_result.get("cached", False)),
        **flagged_result,
    }


def _normalize_episode_indices(total_episodes: int, episode_indices_raw: Any) -> dict[str, Any]:
    if not isinstance(episode_indices_raw, list) or len(episode_indices_raw) == 0:
        return {"ok": False, "status_code": 400, "error": "episode_indices must be a non-empty array"}

    values: list[int] = []
    for idx, raw in enumerate(episode_indices_raw):
        try:
            values.append(int(str(raw)))
        except Exception:
            return {"ok": False, "status_code": 400, "error": f"episode_indices[{idx}] must be an integer"}

    normalized = sorted(set(values))
    invalid = [i for i in normalized if i < 0 or i >= total_episodes]
    if invalid:
        preview = ", ".join(str(i) for i in invalid[:20])
        return {
            "ok": False,
            "status_code": 400,
            "error": f"episode_indices out of range [0, {max(0, total_episodes - 1)}]: {preview}",
        }

    return {"ok": True, "episode_indices": normalized}


def build_episode_delete_plan(user: str, repo: str, episode_indices_raw: Any) -> dict[str, Any]:
    source_repo_id = f"{user}/{repo}"
    source_path = path_policy.dataset_local_dir(source_repo_id)
    info_path = source_path / "meta" / "info.json"
    if not info_path.exists():
        return {"ok": False, "status_code": 404, "error": f"Dataset {source_repo_id} not found locally"}

    try:
        info = json.loads(info_path.read_text())
        total_episodes = int(info.get("total_episodes", 0))
    except Exception as exc:
        return {"ok": False, "status_code": 500, "error": f"Failed to parse info.json: {exc}"}

    normalized = _normalize_episode_indices(total_episodes, episode_indices_raw)
    if not bool(normalized.get("ok", False)):
        return normalized

    delete_indices = list(normalized["episode_indices"])
    if len(delete_indices) >= total_episodes:
        return {"ok": False, "status_code": 400, "error": "cannot delete all episodes"}

    keep_lookup = set(delete_indices)
    keep_indices = [i for i in range(total_episodes) if i not in keep_lookup]
    return {
        "ok": True,
        "source_repo_id": source_repo_id,
        "delete_indices": delete_indices,
        "keep_indices": keep_indices,
        "total_episodes": total_episodes,
    }
