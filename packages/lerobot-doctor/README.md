# lerobot-doctor

Hardware setup and diagnostics for [Hugging Face LeRobot](https://github.com/huggingface/lerobot) arms and cameras.

About a third of LeRobot's open issues are hardware setup: a port that changes name after a reboot, a motor that does not answer, a camera on a saturated USB bus, a calibration file with a bad range. `lerobot-doctor` answers those questions from the terminal, and every answer can be printed as JSON or Markdown so it can be pasted into an issue as-is.

> **Working name.** The distribution name is not final; the PyPI name `lerobot-doctor` is used by an unrelated project. The import name is `lerobot_doctor`.

## Install

```bash
pip install lerobot-doctor            # once published; today: pip install -e packages/lerobot-doctor
```

The CLI has no dependencies beyond the standard library. The motor check needs `lerobot` with the Feetech SDK (`pip install "lerobot[feetech]"`); the other commands work without it.

## Commands

| Command | Answers |
|---|---|
| `lerobot-doctor report` | Everything below as one Markdown report: OS, Python, lerobot version, user groups, ports, cameras, udev symlinks, calibration files |
| `lerobot-doctor ports` | Which serial ports look like arms (`/dev/ttyACM*`, `/dev/ttyUSB*`), their USB serial and bus position, and any stable symlink |
| `lerobot-doctor cameras` | Which V4L2 cameras exist, their model, and the USB bus and speed each one shares |
| `lerobot-doctor motors --port /dev/ttyACM0 --ids 1-6` | Which Feetech motors answer on a port, with position, load and current per motor |
| `lerobot-doctor calibration [FILE ...]` | Whether calibration files parse and have sane ranges; defaults to every file in the LeRobot cache |
| `lerobot-doctor calibration --pair LEADER FOLLOWER` | The same, plus a leader/follower cross-check |
| `lerobot-doctor udev status` | Whether the udev rules are installed and every `/dev` symlink they define exists |
| `lerobot-doctor udev install` | Copies a generated rules file into `/etc/udev/rules.d` with `sudo` and reloads udev (`--dry-run` prints the commands) |

Add `--json` to any command for machine-readable output.

Exit status is `0` when nothing is wrong, `1` when a check found a problem (a missing group, a missing symlink, a motor that did not answer, a calibration error), and `2` for usage errors, so the commands can gate scripts.

### Example

```
$ lerobot-doctor report
# lerobot-doctor report

- OS: Linux-6.8.0-45-generic-x86_64-with-glibc2.39 (kernel 6.8.0-45-generic)
- Python: 3.12.3
- lerobot: 0.6.1
- lerobot-doctor: 0.1.0
- User groups: dialout OK, video MISSING
  - fix: `sudo usermod -aG video $USER` then log out and back in

## Serial ports (arms)

| device  | path         | symlink        | serial       | usb   |
| ------- | ------------ | -------------- | ------------ | ----- |
| ttyACM0 | /dev/ttyACM0 | follower_arm_1 | 5A46085090   | 1-2.3 |
| ttyACM1 | /dev/ttyACM1 | leader_arm_1   | 5A46085091   | 1-2.4 |
...
```

## Library

The same package is the hardware layer of the [LeStudio](https://github.com/TheMomentLab/LeStudio) workbench, which imports it for its Status, Motor Setup and Camera Setup pages:

- `device_registry`, `device_helpers`: robot / teleoperator / camera catalogs from the installed `lerobot`, with a fallback catalog when it is absent; USB port and camera discovery.
- `udev_helpers`: generate, apply and remove udev rules for stable `/dev` symlinks.
- `motor_monitor_bridge`: a Feetech bus wrapper with collision detection and a freewheel mode.
- `motor_setup_bridge`, `calibrate_bridge`: subprocess entry points around `lerobot-setup-motors` and `lerobot-calibrate` that stream structured events.
- `calibration_validator`: range, drive-mode and leader/follower checks for calibration files.
- `type_policy`, `path_policy`: per-robot-family policy (Feetech SO-100 / SO-101 first, Dynamixel OMX second) and LeRobot cache paths.

## Scope

Feetech (SO-100 / SO-101) first, Dynamixel (OMX) second. Linux only (udev, V4L2). A standalone web UI for the same checks is planned; see `docs_public/direction.md` in the repository.

## License

Apache-2.0.
