"""lerobot-doctor: hardware setup and diagnostics for LeRobot.

Device discovery and udev port mapping, motor-ID setup, a live motor monitor,
calibration validation, a `lerobot-doctor` CLI for pasteable reports, and the
web UI (`lerobot-doctor serve`). LeStudio builds its workbench on top of the
same server assembly (see lerobot_doctor.server).
"""

__version__ = "0.1.0"
