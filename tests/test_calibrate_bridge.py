# pyright: reportMissingImports=false

from __future__ import annotations

import builtins
import io

from lestudio import calibrate_bridge


def test_install_input_prompt_passthrough_emits_prompt_line_immediately(monkeypatch):
    captured_prompts: list[object] = []
    stdout = io.StringIO()

    def fake_input(prompt: object = "") -> str:
        captured_prompts.append(prompt)
        return ""

    monkeypatch.setattr(builtins, "input", fake_input)
    monkeypatch.setattr(calibrate_bridge.sys, "stdout", stdout)

    restore = calibrate_bridge._install_input_prompt_passthrough()
    try:
        result = builtins.input("Move arm to center and press ENTER....")
    finally:
        restore()

    assert result == ""
    assert stdout.getvalue() == "Move arm to center and press ENTER....\n"
    assert captured_prompts == [""]


def test_install_input_prompt_passthrough_restores_original_input():
    original_input = builtins.input

    restore = calibrate_bridge._install_input_prompt_passthrough()
    restore()

    assert builtins.input is original_input
