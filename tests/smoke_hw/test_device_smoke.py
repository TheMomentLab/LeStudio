from __future__ import annotations

import os

import pytest

from lestudio._device_helpers import get_arms, get_cameras

pytestmark = pytest.mark.smoke_hw


if os.environ.get("LESTUDIO_RUN_HW_SMOKE") != "1":
    pytest.skip(
        "Hardware smoke tests are opt-in. Set LESTUDIO_RUN_HW_SMOKE=1 to run.",
        allow_module_level=True,
    )


def test_device_scan_does_not_crash():
    """Smoke test: enumerate local devices on a real hardware host."""
    cameras = get_cameras()
    arms = get_arms()
    assert isinstance(cameras, list)
    assert isinstance(arms, list)
