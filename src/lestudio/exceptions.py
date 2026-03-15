from __future__ import annotations


class LeStudioError(Exception):
    pass


class ProcessError(LeStudioError):
    pass


class ProcessAlreadyRunningError(ProcessError):
    pass


class ProcessNotRunningError(ProcessError):
    pass


class ProcessLaunchError(ProcessError):
    pass


class DeviceError(LeStudioError):
    pass


class DeviceNotFoundError(DeviceError):
    pass


class CalibrationError(LeStudioError):
    pass


class ConfigError(LeStudioError):
    pass


class ConfigNotFoundError(ConfigError):
    pass


class DatasetError(LeStudioError):
    pass


class DatasetNotFoundError(DatasetError):
    pass


class HubError(LeStudioError):
    pass


class MotorError(LeStudioError):
    pass


class PreflightError(LeStudioError):
    pass
