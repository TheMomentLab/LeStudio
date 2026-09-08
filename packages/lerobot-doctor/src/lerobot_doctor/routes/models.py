"""Pydantic request/response models for the hardware-layer API routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProcessCommandRequest(BaseModel):
    """Body for POST /api/process/{name}/command — runs an installer command."""

    command: str = Field(default="", description="Shell command to run (pip/conda allowlist enforced)")


class ProcessInputRequest(BaseModel):
    """Body for POST /api/process/{name}/input — sends stdin to a running process."""

    text: str = Field(default="", description="Text to write to process stdin")


class CameraSettingsRequest(BaseModel):
    """Body for POST /api/camera_settings — persists camera codec/resolution/fps."""

    codec: str = Field(default="MJPG")
    width: int = Field(default=640, ge=1)
    height: int = Field(default=480, ge=1)
    fps: int = Field(default=30, ge=1, le=120)
    jpeg_quality: int = Field(default=70, ge=1, le=100)


class CameraPathsRequest(BaseModel):
    """Body for POST /api/camera/check_paths — checks if device paths exist."""

    paths: list[str] = Field(default_factory=list)


class DeviceCameraResponse(BaseModel):
    device: str
    path: str = ""
    kernels: str = ""
    symlink: str = ""
    model: str = "Unknown"


class DeviceArmResponse(BaseModel):
    device: str
    path: str = ""
    symlink: str = ""
    serial: str = ""
    kernels: str = ""


class DevicesResponse(BaseModel):
    cameras: list[DeviceCameraResponse] = Field(default_factory=list)
    arms: list[DeviceArmResponse] = Field(default_factory=list)
