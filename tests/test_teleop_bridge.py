# pyright: reportMissingImports=false

from __future__ import annotations

import builtins
import importlib
import io
from types import SimpleNamespace

from lestudio import teleop_bridge


def test_extract_antijitter_settings_filters_custom_args():
    settings, filtered = teleop_bridge.extract_antijitter_settings([
        "--robot.type=so101_follower",
        "--lestudio.antijitter.enabled=true",
        "--lestudio.antijitter.alpha=0.5",
        "--lestudio.antijitter.deadband=1.25",
        "--lestudio.antijitter.max_step=2.0",
    ])

    assert settings.enabled is True
    assert settings.alpha == 0.5
    assert settings.deadband == 1.25
    assert settings.max_step == 2.0
    assert filtered == ["--robot.type=so101_follower"]


def test_extract_joint_inversion_settings_filters_custom_args():
    settings, filtered = teleop_bridge.extract_joint_inversion_settings([
        "--robot.type=so101_follower",
        "--lestudio.invert.shoulder_lift=true",
        "--lestudio.invert.wrist_roll=false",
    ])

    assert settings.shoulder_lift is True
    assert settings.wrist_roll is False
    assert filtered == ["--robot.type=so101_follower"]


def test_extract_debug_settings_filters_custom_args():
    settings, filtered = teleop_bridge.extract_debug_settings([
        "--robot.type=so101_follower",
        "--lestudio.debug.enabled=true",
        "--lestudio.debug.interval_s=0.5",
    ])

    assert settings.enabled is True
    assert settings.sample_interval_s == 0.5
    assert filtered == ["--robot.type=so101_follower"]


def test_build_debug_snapshot_payload_collects_joint_positions():
    payload = teleop_bridge._build_debug_snapshot_payload(
        loop_index=7,
        uptime_s=1.25,
        active_loop_ms=5.0,
        raw_action={"shoulder_lift.pos": 12.0, "gripper.open": 1.0},
        observation={"shoulder_lift.pos": 8.0, "wrist_roll.pos": -3.0},
        teleop_action={"shoulder_lift.pos": 12.0},
        robot_action={"shoulder_lift.pos": 10.0, "wrist_roll.pos": -4.0},
    )

    assert payload["loop_index"] == 7
    assert payload["schema_version"] == 1
    assert payload["joint_count_total"] == 2
    assert payload["joint_count_emitted"] == 2
    assert payload["truncated"] is False
    assert payload["leader_raw_pos"] == {"shoulder_lift.pos": 12.0}
    assert payload["follower_current_pos"] == {
        "shoulder_lift.pos": 8.0,
        "wrist_roll.pos": -3.0,
    }
    assert payload["teleop_action_pos"] == {"shoulder_lift.pos": 12.0}
    assert payload["follower_goal_pos"] == {
        "shoulder_lift.pos": 10.0,
        "wrist_roll.pos": -4.0,
    }
    assert payload["goal_minus_current_pos"] == {
        "shoulder_lift.pos": 2.0,
        "wrist_roll.pos": -1.0,
    }
    assert payload["max_abs_goal_error"] == 2.0
    assert payload["rms_goal_error"] == 1.5811
    assert payload["worst_joint"] == "shoulder_lift.pos"


def test_patch_default_processors_prepends_antijitter_step(monkeypatch):
    created = {}

    class FakeStep:
        def __init__(self, **kwargs):
            created.update(kwargs)

    pipeline = SimpleNamespace(steps=["identity"])
    teleop_mod = SimpleNamespace(
        make_default_processors=lambda: (pipeline, "robot", "obs"),
    )

    monkeypatch.setattr(teleop_bridge, "_load_antijitter_step_class", lambda: FakeStep)
    teleop_bridge._patch_default_processors(
        teleop_mod,
        teleop_bridge.AntiJitterSettings(enabled=True, alpha=0.2, deadband=0.9, max_step=1.1),
        teleop_bridge.JointInvertSettings(),
    )

    teleop_action_processor, robot_action_processor, robot_observation_processor = teleop_mod.make_default_processors()
    assert type(teleop_action_processor.steps[0]) is FakeStep
    assert teleop_action_processor.steps[1] == "identity"
    assert robot_action_processor == "robot"
    assert robot_observation_processor == "obs"
    assert created == {
        "alpha": 0.2,
        "deadband": 0.9,
        "max_step": 1.1,
        "enabled": True,
    }


def test_patch_default_processors_prepends_joint_invert_step():
    pipeline = SimpleNamespace(steps=["identity"])
    teleop_mod = SimpleNamespace(
        make_default_processors=lambda: (pipeline, "robot", "obs"),
    )

    teleop_bridge._patch_default_processors(
        teleop_mod,
        teleop_bridge.AntiJitterSettings(),
        teleop_bridge.JointInvertSettings(shoulder_lift=True, wrist_roll=True),
    )

    teleop_action_processor, robot_action_processor, robot_observation_processor = teleop_mod.make_default_processors()
    assert teleop_action_processor.steps[1] == "identity"
    assert robot_action_processor == "robot"
    assert robot_observation_processor == "obs"

    step = teleop_action_processor.steps[0]
    updated = step.action({"shoulder_lift.pos": 12.5, "wrist_roll.pos": -7.0, "elbow_flex.pos": 3.0})
    assert updated == {
        "shoulder_lift.pos": -12.5,
        "wrist_roll.pos": 7.0,
        "elbow_flex.pos": 3.0,
    }


def test_antijitter_plugin_available_false_when_import_fails(monkeypatch):
    def fail_import(name: str):
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(importlib, "import_module", fail_import)
    assert teleop_bridge.antijitter_plugin_available() is False


def test_antijitter_plugin_available_false_when_disabled_by_env(monkeypatch):
    monkeypatch.setenv("LESTUDIO_DISABLE_ANTIJITTER_PLUGIN", "1")
    assert teleop_bridge.antijitter_plugin_available() is False


def test_install_input_prompt_passthrough_emits_prompt_line_immediately(monkeypatch):
    captured_prompts: list[object] = []
    stdout = io.StringIO()

    def fake_input(prompt: object = "") -> str:
        captured_prompts.append(prompt)
        return ""

    monkeypatch.setattr(builtins, "input", fake_input)
    monkeypatch.setattr(teleop_bridge.sys, "stdout", stdout)

    restore = teleop_bridge._install_input_prompt_passthrough()
    try:
        result = builtins.input("Press ENTER to continue:")
    finally:
        restore()

    assert result == ""
    assert stdout.getvalue() == "Press ENTER to continue:\n"
    assert captured_prompts == [""]


def test_install_input_prompt_passthrough_restores_original_input(monkeypatch):
    original_input = builtins.input

    restore = teleop_bridge._install_input_prompt_passthrough()
    restore()

    assert builtins.input is original_input
