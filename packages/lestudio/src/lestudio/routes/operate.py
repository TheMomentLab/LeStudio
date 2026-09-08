"""LeStudio-only process routes: preflight, teleop / record start, console commands.

Generic process control (status / stop / input), calibration and motor setup
live in lerobot_checkup.routes.process.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from lerobot_checkup.capabilities import Capability, register
from lerobot_checkup.process_manager import PROCESS_NAMES
from lerobot_checkup.routes.models import ProcessCommandRequest

from .._train_helpers import _normalize_console_command
from ..services.process_service import run_preflight, start_record, start_teleop
from ._state import AppState

logger = logging.getLogger(__name__)

register("/api/process/{name}/command", Capability.PROCESS_CONTROL)
register("/api/preflight", Capability.PROCESS_CONTROL)
register("/api/teleop/start", Capability.PROCESS_CONTROL)
register("/api/record/start", Capability.PROCESS_CONTROL)


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.post("/api/process/{name}/command")
    async def api_proc_command(name: str, data: ProcessCommandRequest | None = None):
        if name not in PROCESS_NAMES:
            return {"ok": False, "error": f"Unknown process: {name}"}

        if state.proc_mgr.is_running(name):
            return {"ok": False, "error": f"{name} is running. Stop it or send stdin input instead."}

        payload = data or ProcessCommandRequest()
        raw_command = payload.command.strip()
        try:
            args, normalized = _normalize_console_command(state.python_exe, raw_command)
        except ValueError as e:
            return {"ok": False, "error": str(e)}

        ok = state.proc_mgr.start(name, args)
        return {
            "ok": ok,
            "command": normalized,
            "error": None if ok else "Failed to launch command process.",
        }

    @router.post("/api/preflight")
    async def api_preflight(data: dict[str, object]):
        return run_preflight(data, state)

    @router.post("/api/teleop/start")
    async def api_teleop_start(data: dict[str, object]):
        return start_teleop(data, state)

    @router.post("/api/record/start")
    async def api_record_start(data: dict[str, object]):
        return start_record(data, state)

    return router
