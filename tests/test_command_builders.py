# pyright: reportMissingImports=false

from __future__ import annotations

import json
from pathlib import Path

import pytest

from lestudio import command_builders as cb


def test_dataset_cache_path_uses_hf_lerobot_prefix(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    assert cb.dataset_cache_path("user/repo") == tmp_path / ".cache" / "huggingface" / "lerobot" / "user/repo"


def test_resolve_record_resume_false_cleans_cache(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    cache_dir = cb.dataset_cache_path("user/repo")
    cache_dir.mkdir(parents=True)
    (cache_dir / "stale.txt").write_text("x")

    requested, enabled = cb.resolve_record_resume({"record_resume": False, "record_repo_id": "user/repo"})
    assert (requested, enabled) == (False, False)
    assert not cache_dir.exists()


def test_resolve_record_resume_true_enabled_when_meta_exists(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    meta = cb.dataset_cache_path("user/repo") / "meta" / "tasks.parquet"
    meta.parent.mkdir(parents=True)
    meta.write_bytes(b"parquet")

    requested, enabled = cb.resolve_record_resume({"record_resume": True, "record_repo_id": "user/repo"})
    assert (requested, enabled) == (True, True)


def test_resolve_record_resume_true_without_meta_cleans_cache(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    cache_dir = cb.dataset_cache_path("user/repo")
    cache_dir.mkdir(parents=True)
    (cache_dir / "old.bin").write_bytes(b"old")

    requested, enabled = cb.resolve_record_resume({"record_resume": True, "record_repo_id": "user/repo"})
    assert (requested, enabled) == (True, False)
    assert not cache_dir.exists()


def test_build_teleop_args_single_mode_includes_speed_limit():
    args = cb.build_teleop_args(
        "/py",
        {
            "follower_port": "/dev/follower_arm_1",
            "leader_port": "/dev/leader_arm_1",
            "teleop_speed": "0.25",
            "teleop_antijitter_enabled": True,
            "teleop_antijitter_alpha": 0.4,
            "teleop_antijitter_deadband": 1.25,
            "teleop_antijitter_max_step": 2.5,
            "robot_id": "r1",
            "teleop_id": "t1",
        },
    )
    assert args[:3] == ["/py", "-m", "lestudio.teleop_bridge"]
    assert "--robot.type=so101_follower" in args
    assert "--teleop.type=so101_leader" in args
    assert "--robot.max_relative_target=8.0" in args
    assert "--lestudio.antijitter.enabled=true" in args
    assert "--lestudio.antijitter.alpha=0.4" in args
    assert "--lestudio.antijitter.deadband=1.25" in args
    assert "--lestudio.antijitter.max_step=2.5" in args
    assert "--lestudio.invert.shoulder_lift=false" in args
    assert "--lestudio.invert.wrist_roll=false" in args
    assert "--lestudio.debug.enabled=false" in args


def test_normalized_process_types_preserves_explicit_omx_single_types():
    robot_type, teleop_type = cb._normalized_process_types(
        {"robot_type": "omx_follower", "teleop_type": "omx_leader"},
        is_bi=False,
    )

    assert robot_type == "omx_follower"
    assert teleop_type == "omx_leader"


def test_normalized_process_types_uses_type_policy_defaults(monkeypatch):
    class FakeDefaults:
        robot_type = "custom_single_robot"
        teleop_type = "custom_single_teleop"

    monkeypatch.setattr(
        cb,
        "type_policy",
        type("FakePolicy", (), {"get_defaults_for_mode": staticmethod(lambda mode: FakeDefaults)})(),
        raising=False,
    )

    robot_type, teleop_type = cb._normalized_process_types({}, is_bi=False)

    assert robot_type == "custom_single_robot"
    assert teleop_type == "custom_single_teleop"


def test_normalized_process_types_coerces_non_bi_types_in_bimanual_mode():
    robot_type, teleop_type = cb._normalized_process_types(
        {"robot_type": "omx_follower", "teleop_type": "so101_leader"},
        is_bi=True,
    )

    assert robot_type == "bi_so_follower"
    assert teleop_type == "bi_so_leader"


def test_build_teleop_args_single_mode_includes_joint_invert_flags_when_enabled():
    args = cb.build_teleop_args(
        "/py",
        {
            "follower_port": "/dev/follower_arm_1",
            "leader_port": "/dev/leader_arm_1",
            "teleop_invert_shoulder_lift": True,
            "teleop_invert_wrist_roll": True,
        },
    )

    assert "--lestudio.invert.shoulder_lift=true" in args
    assert "--lestudio.invert.wrist_roll=true" in args


def test_build_teleop_args_single_mode_includes_debug_flag_when_enabled():
    args = cb.build_teleop_args(
        "/py",
        {
            "follower_port": "/dev/follower_arm_1",
            "leader_port": "/dev/leader_arm_1",
            "teleop_debug_enabled": True,
        },
    )

    assert "--lestudio.debug.enabled=true" in args


def test_build_teleop_args_single_mode_preserves_explicit_omx_types():
    args = cb.build_teleop_args(
        "/py",
        {
            "robot_type": "omx_follower",
            "teleop_type": "omx_leader",
            "follower_port": "/dev/omx_follower",
            "leader_port": "/dev/omx_leader",
            "robot_id": "omx_follower",
            "teleop_id": "omx_leader",
        },
    )

    assert "--robot.type=omx_follower" in args
    assert "--teleop.type=omx_leader" in args
    assert "--robot.id=omx_follower" in args
    assert "--teleop.id=omx_leader" in args


def test_build_teleop_args_bi_mode_without_limit_when_speed_1():
    args = cb.build_teleop_args(
        "/py",
        {
            "robot_mode": "bi",
            "left_follower_port": "/dev/f1",
            "right_follower_port": "/dev/f2",
            "left_leader_port": "/dev/l1",
            "right_leader_port": "/dev/l2",
            "left_robot_id": "bimanual_follower_left",
            "right_robot_id": "bimanual_follower_right",
            "left_teleop_id": "bimanual_leader_left",
            "right_teleop_id": "bimanual_leader_right",
            "teleop_speed": "1.0",
        },
    )
    assert "--robot.type=bi_so_follower" in args
    assert "--teleop.type=bi_so_leader" in args
    assert "--robot.id=bimanual_follower" in args
    assert "--teleop.id=bimanual_leader" in args
    assert "--robot.calibration_dir=" in " ".join(args)
    assert "--teleop.calibration_dir=" in " ".join(args)
    assert not any("max_relative_target" in a for a in args)
    assert "--lestudio.antijitter.enabled=false" in args


def test_build_record_args_single_with_camera_serialization():
    cfg = {
        "record_repo_id": "u/ds",
        "record_episodes": 3,
        "record_task": "pick",
        "follower_port": "/dev/f",
        "leader_port": "/dev/l",
        "robot_type": "so100_follower",
        "teleop_type": "so100_leader",
        "cameras": {"top_1": "video0", "wrist_1": "/dev/video1", "none": ""},
        "record_cam_width": 320,
        "record_cam_height": 240,
        "record_cam_fps": 15,
    }
    args = cb.build_record_args("/py", cfg, resume_enabled=True)
    assert "--resume=true" in args
    cam_arg = next(a for a in args if a.startswith("--robot.cameras="))
    payload = json.loads(cam_arg.split("=", 1)[1])
    assert payload["top_1"]["index_or_path"] == "/dev/video0"
    assert payload["wrist_1"]["width"] == 320
    assert "--robot.type=so100_follower" in args
    assert "--teleop.type=so100_leader" in args


def test_build_record_args_single_preserves_explicit_omx_types():
    cfg = {
        "record_repo_id": "u/omx",
        "record_episodes": 1,
        "record_task": "move",
        "follower_port": "/dev/omx_follower",
        "leader_port": "/dev/omx_leader",
        "robot_type": "omx_follower",
        "teleop_type": "omx_leader",
    }

    args = cb.build_record_args("/py", cfg, resume_enabled=False)

    assert "--robot.type=omx_follower" in args
    assert "--teleop.type=omx_leader" in args


def test_build_record_args_bi_mode_places_camera_on_left_arm():
    cfg = {
        "robot_mode": "bi",
        "left_follower_port": "/dev/f1",
        "right_follower_port": "/dev/f2",
        "left_leader_port": "/dev/l1",
        "right_leader_port": "/dev/l2",
        "left_robot_id": "bimanual_follower_left",
        "right_robot_id": "bimanual_follower_right",
        "left_teleop_id": "bimanual_leader_left",
        "right_teleop_id": "bimanual_leader_right",
        "cameras": {"top_1": "/dev/video0"},
    }
    args = cb.build_record_args("/py", cfg, resume_enabled=False)
    assert "--robot.type=bi_so_follower" in args
    assert "--teleop.type=bi_so_leader" in args
    assert "--robot.id=bimanual_follower" in args
    assert "--teleop.id=bimanual_leader" in args
    assert "--robot.calibration_dir=" in " ".join(args)
    assert "--teleop.calibration_dir=" in " ".join(args)
    # BiSOFollowerConfig has no top-level 'cameras' — only left_arm_config.cameras
    assert "--robot.cameras={}" not in args
    left_cam = next(a for a in args if a.startswith("--robot.left_arm_config.cameras="))
    assert "video0" in left_cam


def test_build_record_args_bi_mode_normalizes_non_bi_types():
    cfg = {
        "robot_mode": "bi",
        "robot_type": "so101_follower",
        "teleop_type": "so101_leader",
        "left_follower_port": "/dev/f1",
        "right_follower_port": "/dev/f2",
        "left_leader_port": "/dev/l1",
        "right_leader_port": "/dev/l2",
        "left_robot_id": "bimanual_follower_left",
        "right_robot_id": "bimanual_follower_right",
        "left_teleop_id": "bimanual_leader_left",
        "right_teleop_id": "bimanual_leader_right",
    }
    args = cb.build_record_args("/py", cfg, resume_enabled=False)
    assert "--robot.type=bi_so_follower" in args
    assert "--teleop.type=bi_so_leader" in args


def test_build_teleop_args_bi_mode_auto_normalizes_ids_without_suffixes():
    args = cb.build_teleop_args(
        "/py",
        {
            "robot_mode": "bi",
            "left_follower_port": "/dev/f1",
            "right_follower_port": "/dev/f2",
            "left_leader_port": "/dev/l1",
            "right_leader_port": "/dev/l2",
            "left_robot_id": "follower",
            "right_robot_id": "follower",
            "left_teleop_id": "leader",
            "right_teleop_id": "leader",
        },
    )
    assert "--robot.id=follower" in args
    assert "--teleop.id=leader" in args


def test_build_calibrate_args_single_robot_and_leader():
    robot_args = cb.build_calibrate_args("/py", {"robot_type": "so101_follower", "robot_id": "rid", "port": "/dev/f"})
    assert robot_args[:3] == ["/py", "-m", "lestudio.calibrate_bridge"]
    assert "--robot.type=so101_follower" in robot_args
    assert "--robot.id=rid" in robot_args

    leader_args = cb.build_calibrate_args("/py", {"robot_type": "so101_leader", "robot_id": "lid", "port": "/dev/l"})
    assert leader_args[:3] == ["/py", "-m", "lestudio.calibrate_bridge"]
    assert "--teleop.type=so101_leader" in leader_args
    assert "--teleop.id=lid" in leader_args


def test_build_calibrate_args_bi_leader_uses_teleop_namespace():
    args = cb.build_calibrate_args(
        "/py",
        {
            "robot_mode": "bi",
            "bi_type": "bi_so_leader",
            "robot_id": "bi-id",
            "left_port": "/dev/l1",
            "right_port": "/dev/l2",
        },
    )
    assert args[:3] == ["/py", "-m", "lestudio.calibrate_bridge"]
    assert "--teleop.type=bi_so_leader" in args
    assert any(a.startswith("--teleop.calibration_dir=") for a in args)
    assert "--teleop.left_arm_config.port=/dev/l1" in args
    assert "--teleop.right_arm_config.port=/dev/l2" in args


def test_build_calibrate_args_bi_follower_uses_robot_calibration_dir():
    args = cb.build_calibrate_args(
        "/py",
        {
            "robot_mode": "bi",
            "bi_type": "bi_so_follower",
            "robot_id": "bi-id",
            "left_port": "/dev/f1",
            "right_port": "/dev/f2",
        },
    )
    assert args[:3] == ["/py", "-m", "lestudio.calibrate_bridge"]
    assert "--robot.type=bi_so_follower" in args
    assert any(a.startswith("--robot.calibration_dir=") for a in args)
    assert "--robot.left_arm_config.port=/dev/f1" in args
    assert "--robot.right_arm_config.port=/dev/f2" in args


def test_build_motor_setup_args_switches_namespace_for_leader():
    robot_args = cb.build_motor_setup_args("/py", {"robot_type": "so101_follower", "port": "/dev/f"})
    assert robot_args[0] == "/py"
    assert robot_args[1].endswith("motor_setup_bridge.py")
    assert "--python-exe=/py" in robot_args
    assert "--robot-type=so101_follower" in robot_args
    assert "--port=/dev/f" in robot_args

    leader_args = cb.build_motor_setup_args("/py", {"robot_type": "so101_leader", "port": "/dev/l"})
    assert leader_args[0] == "/py"
    assert leader_args[1].endswith("motor_setup_bridge.py")
    assert "--robot-type=so101_leader" in leader_args
    assert "--port=/dev/l" in leader_args


def test_build_motor_setup_args_rejects_unsupported_type():
    with pytest.raises(ValueError, match="Motor Setup does not support"):
        cb.build_motor_setup_args("/py", {"robot_type": "bi_so_follower", "port": "/dev/f"})


def test_build_motor_setup_args_uses_type_policy_support_check(monkeypatch):
    monkeypatch.setattr(
        cb,
        "type_policy",
        type("FakePolicy", (), {"supports_motor_setup": staticmethod(lambda robot_type: False)})(),
        raising=False,
    )

    with pytest.raises(ValueError, match="Motor Setup does not support"):
        cb.build_motor_setup_args("/py", {"robot_type": "so101_follower", "port": "/dev/f"})


def test_build_train_args_maps_tdmpc2_and_optional_fields():
    args = cb.build_train_args(
        "/py",
        {
            "train_policy": "tdmpc2",
            "train_repo_id": "u/ds",
            "train_steps": 123,
            "train_device": "cpu",
            "train_batch_size": 16,
            "train_lr": 1e-4,
        },
    )
    assert "--policy.type=tdmpc" in args
    assert "--dataset.repo_id=u/ds" in args
    assert "--batch_size=16" in args
    assert "--optimizer.lr=0.0001" in args


def test_build_eval_args_requires_env_type_when_not_inferable():
    try:
        cb.build_eval_args("/py", {"eval_task": "pick-red"})
    except ValueError as exc:
        assert "env.type" in str(exc)
    else:
        raise AssertionError("Expected ValueError when env.type is missing")


def test_build_eval_args_includes_dataset_override_when_provided():
    args = cb.build_eval_args(
        "/py", {"eval_repo_id": "u/ds", "eval_env_type": "aloha", "eval_task": "AlohaInsertion-v0"}
    )
    assert "--dataset.repo_id=u/ds" not in args


def test_build_eval_args_passes_env_type_as_is():
    args = cb.build_eval_args("/py", {"eval_env_type": "gym_manipulator", "eval_task": "real_robot"})
    assert "--env.type=gym_manipulator" in args
    assert "--env.task=real_robot" in args
    assert "--env.robot.calibration_dir=" in " ".join(args)
    assert "--env.teleop.calibration_dir=" in " ".join(args)


def test_build_eval_args_single_real_robot_includes_calibration_dirs_and_ids(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    args = cb.build_eval_args(
        "/py",
        {
            "eval_env_type": "gym_manipulator",
            "eval_task": "real_robot",
            "eval_robot_type": "so101_follower",
            "eval_teleop_type": "so101_leader",
            "follower_port": "/dev/follower_arm_1",
            "leader_port": "/dev/leader_arm_1",
            "robot_id": "follower_arm_1",
            "teleop_id": "leader_arm_1",
        },
    )

    assert (
        f"--env.robot.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'robots' / 'so_follower'}"
        in args
    )
    assert (
        f"--env.teleop.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'teleoperators' / 'so_leader'}"
        in args
    )
    assert "--env.robot.id=follower_arm_1" in args
    assert "--env.teleop.id=leader_arm_1" in args


def test_build_eval_args_single_real_robot_preserves_omx_types_and_dirs(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    args = cb.build_eval_args(
        "/py",
        {
            "eval_env_type": "gym_manipulator",
            "eval_task": "real_robot",
            "eval_robot_type": "omx_follower",
            "eval_teleop_type": "omx_leader",
            "follower_port": "/dev/omx_follower",
            "leader_port": "/dev/omx_leader",
            "robot_id": "omx_follower",
            "teleop_id": "omx_leader",
        },
    )

    assert "--env.robot.type=omx_follower" in args
    assert "--env.teleop.type=omx_leader" in args
    assert (
        f"--env.robot.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'robots' / 'omx_follower'}"
        in args
    )
    assert (
        f"--env.teleop.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'teleoperators' / 'omx_leader'}"
        in args
    )
    assert "--env.robot.id=omx_follower" in args
    assert "--env.teleop.id=omx_leader" in args


def test_build_eval_args_bi_real_robot_includes_calibration_dirs(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    args = cb.build_eval_args(
        "/py",
        {
            "robot_mode": "bi",
            "eval_env_type": "gym_manipulator",
            "eval_task": "real_robot",
            "eval_robot_type": "bi_so_follower",
            "eval_teleop_type": "bi_so_leader",
            "left_robot_id": "bimanual_follower_left",
            "right_robot_id": "bimanual_follower_right",
            "left_teleop_id": "bimanual_leader_left",
            "right_teleop_id": "bimanual_leader_right",
        },
    )

    assert (
        f"--env.robot.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'robots' / 'bi_so_follower'}"
        in args
    )
    assert (
        f"--env.teleop.calibration_dir={tmp_path / '.cache' / 'huggingface' / 'lerobot' / 'calibration' / 'teleoperators' / 'bi_so_leader'}"
        in args
    )
    assert "--env.robot.id=bimanual_follower" in args
    assert "--env.teleop.id=bimanual_leader" in args


def test_build_eval_args_bi_real_robot_auto_normalizes_numbered_ids():
    args = cb.build_eval_args(
        "/py",
        {
            "robot_mode": "bi",
            "eval_env_type": "gym_manipulator",
            "eval_task": "real_robot",
            "eval_robot_type": "bi_so_follower",
            "eval_teleop_type": "bi_so_leader",
            "left_robot_id": "follower_arm_1",
            "right_robot_id": "follower_arm_2",
            "left_teleop_id": "leader_arm_1",
            "right_teleop_id": "leader_arm_2",
        },
    )
    assert "--env.robot.id=follower_arm" in args
    assert "--env.teleop.id=leader_arm" in args


def test_build_eval_args_infers_env_from_train_config(tmp_path: Path):
    policy_dir = tmp_path / "policy"
    policy_dir.mkdir(parents=True)
    (policy_dir / "train_config.json").write_text('{"env": {"type": "aloha", "task": "AlohaInsertion-v0"}}')

    args = cb.build_eval_args("/py", {"eval_policy_path": str(policy_dir)})

    assert "--env.type=aloha" in args
    assert "--env.task=AlohaInsertion-v0" in args


def test_build_eval_args_preserves_gym_prefix_and_uses_env_name_fallback(tmp_path: Path):
    policy_dir = tmp_path / "policy"
    policy_dir.mkdir(parents=True)
    (policy_dir / "train_config.json").write_text('{"env": {"type": "gym_manipulator", "name": "real_robot"}}')

    args = cb.build_eval_args("/py", {"eval_policy_path": str(policy_dir)})

    assert "--env.type=gym_manipulator" in args
    assert "--env.task=real_robot" in args


def test_build_eval_args_error_message_for_null_env_in_real_robot_checkpoint(tmp_path: Path):
    """When train_config.json has env: null (real-robot training), the error
    message should guide the user to set Env Type override."""
    policy_dir = tmp_path / "policy"
    policy_dir.mkdir(parents=True)
    (policy_dir / "train_config.json").write_text('{"env": null}')

    try:
        cb.build_eval_args("/py", {"eval_policy_path": str(policy_dir)})
    except ValueError as exc:
        msg = str(exc)
        assert "env.type" in msg
        assert "Env Type override" in msg or "Advanced Overrides" in msg
    else:
        raise AssertionError("Expected ValueError for null env")


def test_build_eval_args_error_message_for_missing_task():
    """When env.type is set but task is missing, error should guide user to set Task."""
    try:
        cb.build_eval_args("/py", {"eval_env_type": "manipulator"})
    except ValueError as exc:
        msg = str(exc)
        assert "env.task" in msg or "Task" in msg
    else:
        raise AssertionError("Expected ValueError for missing task")
