"""Pydantic models for the LeStudio-only routes (Hub, training).

Hardware models live in lerobot_doctor.routes.models.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class HfTokenRequest(BaseModel):
    """Body for POST/PUT /api/hf/token — stores a Hugging Face API token."""

    token: str = Field(description="Hugging Face API token (hf_…)")


class DepsStatusResponse(BaseModel):
    ok: bool = True
    huggingface_cli: bool = False
    teleop_antijitter_plugin: bool = False
    rules_needs_root: bool = False
    rules_needs_install: bool = False


class HfWhoamiResponse(BaseModel):
    ok: bool = False
    username: str | None = None
    error: str | None = None


class TrainPreflightResponse(BaseModel):
    ok: bool = False
    reason: str = ""
    action: str = ""
    command: str = ""
