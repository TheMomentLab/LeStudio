"""FastAPI app assembly for the hardware layer.

``create_app`` is the standalone ``lerobot-doctor serve`` app. ``make_state``
and ``build_app`` are the shared pieces LeStudio composes its own app from:
the same middlewares, the same hardware routers, plus its workflow routers.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Iterable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, TypeVar

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import Scope

from lerobot_doctor._auth import TokenAuthMiddleware, generate_token
from lerobot_doctor._cors import _resolve_cors_settings
from lerobot_doctor._device_watcher import DeviceWatcher
from lerobot_doctor._logging import configure_logging
from lerobot_doctor._streaming import unlock_cameras
from lerobot_doctor.process_manager import ProcessManager
from lerobot_doctor.routes._state import AppState

logger = logging.getLogger(__name__)
configure_logging()

StateT = TypeVar("StateT", bound=AppState)

STATIC_DIR = Path(__file__).parent / "static"
HISTORY_MAX = 200


class SPAStaticFiles(StaticFiles):
    """Serve the built SPA; unknown non-API paths fall back to index.html."""

    async def get_response(self, path: str, scope: Scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            response = None

        if response is not None and response.status_code != 404:
            return response

        normalized = path.lstrip("/")
        top_level = normalized.split("/", 1)[0]
        if top_level in {"api", "ws"}:
            if response is not None:
                return response
            raise StarletteHTTPException(status_code=404)

        if Path(normalized).suffix:
            if response is not None:
                return response
            raise StarletteHTTPException(status_code=404)

        return await super().get_response("index.html", scope)


class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response: Response = await call_next(request)
        path = request.url.path
        if path.startswith("/api") or path.startswith("/ws"):
            return response

        is_asset = path.startswith("/assets/") or path in {"/favicon.ico", "/logo.svg"}
        is_spa_route = path == "/" or (not Path(path).suffix and path != "")
        if is_asset or is_spa_route:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response


def make_state(
    config_dir: Path,
    rules_path: Path,
    *,
    lerobot_src: Path,
    state_cls: type[StateT],
    **extra_fields: Any,
) -> StateT:
    """Create the process manager and the application state, then start the device watcher."""
    holder: list[AppState] = []

    def _on_process_exit(name: str) -> None:
        if name in {"record", "teleop"}:
            unlock_cameras()
        if holder:
            holder[0].append_history(f"{name}_end")

    proc_mgr = ProcessManager(lerobot_src, on_process_exit=_on_process_exit, state_dir=config_dir)
    state = state_cls(
        proc_mgr=proc_mgr,
        config_path=config_dir / "config.json",
        config_dir=config_dir,
        rules_path=rules_path,
        fallback_rules_path=config_dir / "99-lerobot.rules",
        history_path=config_dir / "history.json",
        history_max=HISTORY_MAX,
        python_exe=sys.executable,
        **extra_fields,
    )
    holder.append(state)

    state.proc_mgr.recover_orphans()
    state.device_watcher = DeviceWatcher()
    state.device_watcher.start()
    return state


def hardware_routers(state: AppState) -> list[APIRouter]:
    from lerobot_doctor.routes import config, devices, motor, process, streaming, udev

    return [
        devices.create_router(state),
        config.create_router(state),
        udev.create_router(state),
        process.create_router(state),
        streaming.create_router(state),
        motor.create_router(state),
    ]


def build_app(
    state: AppState,
    *,
    title: str,
    static_dir: Path,
    session_token: str | None = None,
    extra_routers: Iterable[APIRouter] = (),
) -> FastAPI:
    """Assemble the FastAPI app: middlewares, hardware routers, extra routers, SPA static files."""
    configure_logging(log_dir=state.config_dir / "logs")

    cors_origins, cors_origin_regex = _resolve_cors_settings()
    token = session_token if session_token is not None else generate_token()

    @asynccontextmanager
    async def _lifespan(_: FastAPI):
        try:
            yield
        finally:
            watcher = state.device_watcher
            if isinstance(watcher, DeviceWatcher):
                watcher.stop()

    app = FastAPI(title=title, lifespan=_lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=cors_origin_regex,
        allow_methods=["*"],
        allow_headers=["*", "X-LeStudio-Token"],
    )
    app.add_middleware(TokenAuthMiddleware, token=token)
    app.state.session_token = token
    app.add_middleware(NoCacheStaticMiddleware)

    for router in hardware_routers(state):
        app.include_router(router)
    for router in extra_routers:
        app.include_router(router)

    # Vite builds assets with root-relative paths (/assets/...)
    app.mount("/", SPAStaticFiles(directory=str(static_dir), html=True), name="static")
    return app


def create_app(
    lerobot_src: Path,
    config_dir: Path,
    rules_path: Path,
    session_token: str | None = None,
) -> FastAPI:
    """The standalone lerobot-doctor web app."""
    state = make_state(config_dir, rules_path, lerobot_src=lerobot_src, state_cls=AppState)
    return build_app(state, title="lerobot-doctor", static_dir=STATIC_DIR, session_token=session_token)


def create_app_from_env() -> FastAPI:
    """App factory for ``uvicorn --reload`` mode (environment set by the CLI)."""
    return create_app(
        lerobot_src=Path(os.environ["_LEROBOT_DOCTOR_LEROBOT_SRC"]),
        config_dir=Path(os.environ["_LEROBOT_DOCTOR_CONFIG_DIR"]),
        rules_path=Path(os.environ["_LEROBOT_DOCTOR_RULES_PATH"]),
        session_token=os.environ.get("_LEROBOT_DOCTOR_TOKEN") or generate_token(),
    )
