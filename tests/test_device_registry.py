from __future__ import annotations

import dataclasses

from lestudio import device_registry as dr


def test_get_robot_types_fallback_when_lerobot_unavailable(monkeypatch):
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", False)
    monkeypatch.setattr(dr, "_RobotConfig", None)
    assert dr.get_robot_types() == ["so101_follower", "so100_follower"]


def test_get_teleop_types_fallback(monkeypatch):
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", False)
    monkeypatch.setattr(dr, "_TeleoperatorConfig", None)
    assert dr.get_teleop_types() == ["so101_leader", "so100_leader"]


def test_get_teleop_types_filters_with_compatibility_map(monkeypatch):
    class FakeTeleopConfig:
        @staticmethod
        def get_known_choices():
            return {
                "so101_leader": object(),
                "keyboard": object(),
                "phone": object(),
            }

    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)
    monkeypatch.setattr(dr, "_TeleoperatorConfig", FakeTeleopConfig)
    result = dr.get_teleop_types("so101_follower")
    assert result == ["so101_leader"]


def test_real_registry_exposes_omx_when_lerobot_available():
    if not dr.is_lerobot_available() or dr._RobotConfig is None or dr._TeleoperatorConfig is None:
        return

    assert "omx_follower" in dr.get_robot_types()
    assert "omx_leader" in dr.get_teleop_types()


def test_get_camera_types_fallback(monkeypatch):
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", False)
    monkeypatch.setattr(dr, "_CameraConfig", None)
    assert dr.get_camera_types() == ["opencv"]


def test_get_capabilities_known_type_returns_copy():
    caps = dr.get_capabilities("so101_follower")
    caps["display_name"] = "mutated"
    caps_again = dr.get_capabilities("so101_follower")
    assert caps_again["display_name"] != "mutated"


def test_get_capabilities_omx_follower_has_expected_metadata():
    caps = dr.get_capabilities("omx_follower")

    assert caps["has_arm"] is True
    assert caps["arm_count"] == 1
    assert caps["has_cameras"] is False
    assert caps["motor_protocol"] == "dynamixel"
    assert caps["connection_type"] == "serial"
    assert caps["display_name"] == "OMX Follower"


def test_get_capabilities_so101_follower_has_expected_metadata():
    caps = dr.get_capabilities("so101_follower")

    assert caps["has_arm"] is True
    assert caps["arm_count"] == 1
    assert caps["has_cameras"] is True
    assert caps["motor_protocol"] == "feetech"
    assert caps["connection_type"] == "serial"
    assert caps["display_name"] == "SO-101 Follower"


def test_get_capabilities_unknown_type_infers_from_fields(monkeypatch):
    @dataclasses.dataclass
    class FakeConfig:
        port: str = "/dev/ttyUSB0"
        cameras: dict = dataclasses.field(default_factory=dict)
        teleop_keys: dict = dataclasses.field(default_factory=dict)
        remote_ip: str = "1.2.3.4"

    class FakeRobotConfig:
        @staticmethod
        def get_known_choices():
            return {"custom_bot": FakeConfig}

    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)
    monkeypatch.setattr(dr, "_RobotConfig", FakeRobotConfig)

    caps = dr.get_capabilities("custom_bot")
    assert caps["has_arm"] is True
    assert caps["has_cameras"] is True
    assert caps["is_remote"] is True
    assert caps["has_keyboard_teleop"] is True


def test_get_config_schema_returns_error_when_lerobot_unavailable(monkeypatch):
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", False)
    result = dr.get_config_schema("robots", "so101_follower")
    assert result["error"] == "LeRobot not available"
    assert result["fields"] == []


def test_get_config_schema_extracts_fields(monkeypatch):
    @dataclasses.dataclass
    class FakeRobot:
        name: str
        id: str = "r1"
        port: str = "/dev/ttyUSB0"
        calibration_dir: str = "/tmp/hidden"
        cameras: dict = dataclasses.field(default_factory=dict)

    class FakeRobotConfig:
        @staticmethod
        def get_known_choices():
            return {"fake": FakeRobot}

    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)
    monkeypatch.setattr(dr, "_RobotConfig", FakeRobotConfig)

    schema = dr.get_config_schema("robots", "fake")
    assert schema["error"] is None
    names = {f["name"] for f in schema["fields"]}
    assert "port" in names
    assert "cameras" in names
    assert "name" in names
    assert "calibration_dir" not in names
    port = next(f for f in schema["fields"] if f["name"] == "port")
    assert port["is_core"] is True
    required = next(f for f in schema["fields"] if f["name"] == "name")
    assert required["required"] is True


def test_get_config_schema_unknown_registry(monkeypatch):
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)
    result = dr.get_config_schema("unknown", "x")
    assert "Unknown registry" in result["error"]


def test_get_compatible_teleops_delegates():
    values = dr.get_compatible_teleops("so101_follower")
    assert isinstance(values, list)


def test_get_compatible_teleops_for_omx_follower_includes_omx_leader(monkeypatch):
    class FakeTeleopConfig:
        @staticmethod
        def get_known_choices():
            return {
                "omx_leader": object(),
                "keyboard_ee": object(),
                "keyboard": object(),
            }

    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)
    monkeypatch.setattr(dr, "_TeleoperatorConfig", FakeTeleopConfig)
    values = dr.get_compatible_teleops("omx_follower")

    assert "omx_leader" in values
    assert "keyboard" in values


def test_get_calibration_path_prefix_known_and_unknown():
    assert dr.get_calibration_path_prefix("so101_follower") == ("robots", "so_follower")
    assert dr.get_calibration_path_prefix("so101_leader") == ("teleoperators", "so_leader")
    assert dr.get_calibration_path_prefix("my_custom_type") == ("robots", "my_custom_type")


def test_get_calibration_path_prefix_omx_types_use_omx_dirs():
    assert dr.get_calibration_path_prefix("omx_follower") == ("robots", "omx_follower")
    assert dr.get_calibration_path_prefix("omx_leader") == ("teleoperators", "omx_leader")


def test_list_all_devices_shape(monkeypatch):
    monkeypatch.setattr(dr, "get_robot_types", lambda: ["r1"])
    monkeypatch.setattr(dr, "get_teleop_types", lambda robot_type=None: ["t1"])
    monkeypatch.setattr(dr, "get_camera_types", lambda: ["c1"])
    monkeypatch.setattr(dr, "_LEROBOT_AVAILABLE", True)

    payload = dr.list_all_devices()
    assert payload == {
        "robots": ["r1"],
        "teleoperators": ["t1"],
        "cameras": ["c1"],
        "lerobot_available": True,
    }
