#!/usr/bin/env python3
"""LeStudio — Web GUI server.

The hardware layer (middlewares, device / udev / motor / process / streaming
routes) comes from lerobot_doctor.server; this module adds the workflow routes.
"""

import importlib.util
import logging
import os
import shutil
from pathlib import Path

from fastapi import FastAPI

from lerobot_doctor._auth import generate_token
from lerobot_doctor._logging import configure_logging
from lerobot_doctor.server import build_app, make_state

logger = logging.getLogger(__name__)
configure_logging()


# ─── nvidia pip 패키지의 .so를 LD_LIBRARY_PATH에 자동 추가 ─────────────────
def _patch_nvidia_lib_path():
    existing = os.environ.get("LD_LIBRARY_PATH", "")
    existing_parts = [p for p in existing.split(":") if p]
    seen = set(existing_parts)
    added: list[str] = []

    def add_lib_dir(path: str):
        if not path:
            return
        if not os.path.isdir(path):
            return
        if path in seen:
            return
        seen.add(path)
        added.append(path)

    for pkg in [
        "nvidia.npp",
        "nvidia.cudnn",
        "nvidia.cublas",
        "nvidia.cusparse",
        "nvidia.cufft",
        "nvidia.cusolver",
        "nvidia.nvjitlink",
    ]:
        try:
            spec = importlib.util.find_spec(pkg)
        except ModuleNotFoundError:
            continue
        if spec and spec.submodule_search_locations:
            for loc in spec.submodule_search_locations:
                add_lib_dir(os.path.join(loc, "lib"))

    conda_prefix_candidates: list[Path] = []
    env_prefix = os.environ.get("CONDA_PREFIX", "").strip()
    if env_prefix:
        conda_prefix_candidates.append(Path(env_prefix))

    conda_exe = (os.environ.get("CONDA_EXE", "").strip() or shutil.which("conda") or "").strip()
    if conda_exe:
        conda_path = Path(conda_exe).resolve()
        if conda_path.parent.name in {"condabin", "bin"}:
            conda_prefix_candidates.append(conda_path.parent.parent)

    dedup_prefixes: list[Path] = []
    seen_prefixes: set[str] = set()
    for prefix in conda_prefix_candidates:
        key = str(prefix)
        if not key or key in seen_prefixes:
            continue
        seen_prefixes.add(key)
        dedup_prefixes.append(prefix)

    for prefix in dedup_prefixes:
        add_lib_dir(str(prefix / "lib"))

    if added:
        os.environ["LD_LIBRARY_PATH"] = ":".join(added + existing_parts)


_patch_nvidia_lib_path()


# ─── App Factory ───────────────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    lerobot_src: Path,
    config_dir: Path,
    rules_path: Path,
    session_token: str | None = None,
) -> FastAPI:
    from lestudio.routes import dataset, operate, training
    from lestudio.routes import eval as eval_routes
    from lestudio.routes._state import AppState

    state = make_state(config_dir, rules_path, lerobot_src=lerobot_src, state_cls=AppState)
    return build_app(
        state,
        title="LeStudio",
        static_dir=STATIC_DIR,
        session_token=session_token,
        extra_routers=[
            operate.create_router(state),
            training.create_router(state),
            eval_routes.create_router(state),
            dataset.create_router(state),
        ],
    )


def create_app_from_env() -> FastAPI:
    """App factory for ``uvicorn --reload`` mode.

    Reads configuration from environment variables set by ``cli.py``
    when ``--reload`` is passed.
    """
    return create_app(
        lerobot_src=Path(os.environ["_LESTUDIO_LEROBOT_SRC"]),
        config_dir=Path(os.environ["_LESTUDIO_CONFIG_DIR"]),
        rules_path=Path(os.environ["_LESTUDIO_RULES_PATH"]),
        session_token=os.environ.get("_LESTUDIO_TOKEN") or generate_token(),
    )
