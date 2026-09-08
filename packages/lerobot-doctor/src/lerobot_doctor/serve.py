"""Helpers shared by the ``lerobot-doctor serve`` and ``lestudio serve`` commands."""

from __future__ import annotations

import importlib.util
import os
import socket
import sys
import threading
import time
import webbrowser
from collections.abc import Mapping
from pathlib import Path
from typing import Any, cast

from lerobot_doctor import path_policy

DEFAULT_RULES_PATH = Path("/etc/udev/rules.d/99-lerobot.rules")


def find_lerobot_src() -> Path | None:
    """Locate the directory that contains the installed ``lerobot`` package.

    ``lerobot`` is a normal pip dependency, so the installed package wins. A
    source checkout can still be forced with ``--lerobot-path``.
    """
    try:
        spec = importlib.util.find_spec("lerobot")
        if spec is None:
            return None

        if spec.submodule_search_locations:
            pkg_dir = Path(cast(str, next(iter(spec.submodule_search_locations))))
            return pkg_dir.parent

        if spec.origin:
            return Path(spec.origin).parent.parent
    except (AttributeError, ImportError, OSError, ValueError):
        pass

    return None


def resolve_lerobot_src(lerobot_path_arg: Path | None) -> Path:
    lerobot_src = lerobot_path_arg
    if lerobot_src is None:
        lerobot_src = find_lerobot_src()
    if lerobot_src is None:
        print("ERROR: Cannot find lerobot source.", file=sys.stderr)
        print("Install lerobot (`pip install lerobot`) or pass --lerobot-path", file=sys.stderr)
        sys.exit(1)

    lerobot_src = lerobot_src.resolve()
    if not lerobot_src.is_dir():
        print(f"ERROR: --lerobot-path does not exist: {lerobot_src}", file=sys.stderr)
        sys.exit(1)
    # If user passed the repo root (e.g. .../lerobot), resolve to src/ automatically
    src_candidate = lerobot_src / "src"
    if (src_candidate / "lerobot").is_dir():
        lerobot_src = src_candidate
    return lerobot_src


def resolve_config_dir(config_dir_arg: Path | None) -> Path:
    """Config directory shared by lerobot-doctor and LeStudio (device mappings, camera settings)."""
    if config_dir_arg is not None:
        config_dir = config_dir_arg
    else:
        new_default = path_policy.config_dir_default()
        # Migration: auto-rename old config dirs to new name
        old_default, old_moment, moment_default, legacy_default = path_policy.config_dir_legacy_candidates()
        if old_default.exists() and not new_default.exists():
            old_default.rename(new_default)
        if old_moment.exists() and not moment_default.exists():
            old_moment.rename(moment_default)
        if new_default.exists():
            config_dir = new_default
        elif moment_default.exists():
            config_dir = moment_default
        elif legacy_default.exists():
            config_dir = legacy_default
        else:
            config_dir = new_default
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return str(ip)
    except OSError:
        return "127.0.0.1"


def open_browser(port: int) -> None:
    time.sleep(1.5)
    webbrowser.open(f"http://localhost:{port}")


def maybe_open_browser(enabled: bool, port: int) -> None:
    """Open a browser on desktop sessions only (never over SSH or without a display)."""
    if not enabled:
        return
    is_ssh = "SSH_CLIENT" in os.environ or "SSH_TTY" in os.environ
    has_display = "DISPLAY" in os.environ or os.name == "nt"
    if not is_ssh and has_display:
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()


def print_banner(
    name: str, version: str, *, lerobot_src: Path, config_dir: Path, host: str, port: int, token: str
) -> None:
    print(f"{name} v{version}")
    print(f"    lerobot: {lerobot_src}")
    print(f"    config:  {config_dir}")
    print(f"    Open (Local):   http://localhost:{port}")
    if host == "0.0.0.0":
        print(f"    Open (Network): http://{get_local_ip()}:{port}")
        print(f"    Token (Network auth): {token}")
    print("\n")


def run_uvicorn(
    app: Any,
    *,
    host: str,
    port: int,
    reload: bool = False,
    reload_factory: str = "",
    reload_env: Mapping[str, str] | None = None,
    reload_dirs: list[str] | None = None,
) -> None:
    """Serve ``app``; with ``reload`` re-import it through ``reload_factory`` on file changes."""
    import uvicorn

    if reload:
        for key, value in (reload_env or {}).items():
            os.environ.setdefault(key, value)
        uvicorn.run(
            reload_factory,
            factory=True,
            host=host,
            port=port,
            log_level="warning",
            reload=True,
            reload_dirs=reload_dirs,
        )
    else:
        uvicorn.run(app, host=host, port=port, log_level="warning")
