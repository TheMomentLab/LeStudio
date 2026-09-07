from __future__ import annotations

import importlib

from lestudio import eval_bridge


def test_register_device_families_skips_missing_modules(monkeypatch):
    real_import = importlib.import_module

    def fake_import(name: str):
        if name.endswith("omx_follower") or name.endswith("omx_leader"):
            raise ImportError(name)
        if name == "lerobot.utils.import_utils":
            raise ImportError(name)
        return object()

    monkeypatch.setattr(importlib, "import_module", fake_import)
    loaded = eval_bridge.register_device_families()
    assert "lerobot.robots.omx_follower" not in loaded
    assert "lerobot.robots.bi_so_follower" in loaded
    assert "lerobot.teleoperators.bi_so_leader" in loaded
    monkeypatch.setattr(importlib, "import_module", real_import)


def test_main_registers_then_delegates(monkeypatch):
    calls: list[str] = []

    class FakeEval:
        @staticmethod
        def main() -> None:
            calls.append("eval")

    monkeypatch.setattr(eval_bridge, "register_device_families", lambda: calls.append("register") or [])
    monkeypatch.setattr(importlib, "import_module", lambda name: FakeEval if name == "lerobot.scripts.lerobot_eval" else object())
    eval_bridge.main()
    assert calls == ["register", "eval"]
