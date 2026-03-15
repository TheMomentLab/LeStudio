from __future__ import annotations

import json
from pathlib import Path
from typing import Any

VALID_TAGS = {"good", "bad", "review", "untagged"}


def tags_file_path(config_dir: Path, user: str, repo: str) -> Path:
    tags_dir = config_dir / "episode-tags"
    return tags_dir / f"{user}_{repo}.json"


def load_tags(tags_file: Path) -> dict[str, str]:
    if tags_file.exists():
        try:
            loaded = json.loads(tags_file.read_text())
            if isinstance(loaded, dict):
                return {str(k): str(v) for k, v in loaded.items()}
        except Exception:
            pass
    return {}


def save_tags(tags_file: Path, tags: dict[str, str]) -> None:
    tags_file.parent.mkdir(parents=True, exist_ok=True)
    tags_file.write_text(json.dumps(tags, indent=2))


def get_episode_tags(config_dir: Path, user: str, repo: str) -> dict[str, Any]:
    tags_file = tags_file_path(config_dir, user, repo)
    tags = load_tags(tags_file)
    return {"ok": True, "tags": tags}


def set_episode_tag(config_dir: Path, user: str, repo: str, episode_raw: Any, tag_raw: Any) -> dict[str, Any]:
    tag = str(tag_raw if tag_raw is not None else "untagged")
    if tag not in VALID_TAGS:
        return {"ok": False, "error": f"Invalid tag. Must be one of: {', '.join(sorted(VALID_TAGS))}"}
    try:
        episode_index_int = int(str(episode_raw))
    except Exception:
        return {"ok": False, "error": "episode_index is required"}
    if episode_index_int < 0:
        return {"ok": False, "error": "episode_index must be >= 0"}

    episode_index = str(episode_index_int)
    tags_file = tags_file_path(config_dir, user, repo)
    tags = load_tags(tags_file)
    if tag == "untagged":
        tags.pop(episode_index, None)
    else:
        tags[episode_index] = tag
    save_tags(tags_file, tags)
    return {"ok": True, "episode_index": episode_index, "tag": tag}


def bulk_set_episode_tags(config_dir: Path, user: str, repo: str, updates_raw: Any) -> dict[str, Any]:
    if not isinstance(updates_raw, list) or len(updates_raw) == 0:
        return {"ok": False, "error": "updates must be a non-empty list"}
    if len(updates_raw) > 20000:
        return {"ok": False, "error": "updates is too large (max: 20000)"}

    normalized: list[tuple[str, str]] = []
    for idx, item in enumerate(updates_raw):
        if not isinstance(item, dict):
            return {"ok": False, "error": f"updates[{idx}] must be an object"}

        tag = str(item.get("tag", "untagged"))
        if tag not in VALID_TAGS:
            return {
                "ok": False,
                "error": f"updates[{idx}] has invalid tag '{tag}'. Allowed: {', '.join(sorted(VALID_TAGS))}",
            }

        ep_raw = item.get("episode_index", None)
        if ep_raw is None:
            return {"ok": False, "error": f"updates[{idx}].episode_index is required"}
        try:
            ep_idx = int(str(ep_raw))
        except Exception:
            return {"ok": False, "error": f"updates[{idx}].episode_index must be an integer"}
        if ep_idx < 0:
            return {"ok": False, "error": f"updates[{idx}].episode_index must be >= 0"}
        normalized.append((str(ep_idx), tag))

    tags_file = tags_file_path(config_dir, user, repo)
    tags = load_tags(tags_file)
    for ep_key, tag in normalized:
        if tag == "untagged":
            tags.pop(ep_key, None)
        else:
            tags[ep_key] = tag

    save_tags(tags_file, tags)
    return {"ok": True, "applied": len(normalized)}


def delete_episode_tag(config_dir: Path, user: str, repo: str, episode_raw: Any) -> dict[str, Any]:
    return set_episode_tag(config_dir, user, repo, episode_raw, "untagged")


def bulk_delete_episode_tags(config_dir: Path, user: str, repo: str, episode_indices_raw: Any) -> dict[str, Any]:
    if not isinstance(episode_indices_raw, list) or len(episode_indices_raw) == 0:
        return {"ok": False, "error": "episode_indices must be a non-empty list"}

    updates: list[dict[str, Any]] = []
    for idx, raw in enumerate(episode_indices_raw):
        try:
            ep_idx = int(str(raw))
        except Exception:
            return {"ok": False, "error": f"episode_indices[{idx}] must be an integer"}
        if ep_idx < 0:
            return {"ok": False, "error": f"episode_indices[{idx}] must be >= 0"}
        updates.append({"episode_index": ep_idx, "tag": "untagged"})

    return bulk_set_episode_tags(config_dir, user, repo, updates)
