# lerobot-checkup

Hardware setup and diagnostics for [Hugging Face LeRobot](https://github.com/huggingface/lerobot) arms and cameras.

About a third of LeRobot's open issues are hardware setup: a port that changes name after a reboot, a motor that does not answer, a camera on a saturated USB bus, a calibration file with a bad range. `lerobot-checkup` answers those questions from the terminal, and every answer can be printed as JSON or Markdown so it can be pasted into an issue as-is.

## Install

```bash
pip install lerobot-checkup            # or, from a checkout: pip install -e packages/lerobot-checkup
```

The diagnostics commands use only the standard library; the web UI pulls FastAPI, uvicorn, OpenCV and psutil. The motor check and the Motor Setup / Calibration pages need `lerobot` with the Feetech SDK (`pip install "lerobot[feetech]"`); everything else works without it.

## Web UI

```bash
lerobot-checkup            # same as: lerobot-checkup serve
```

Opens `http://localhost:7861` with three pages: **Status** (devices, udev mapping, system resources), **Motor Setup** (device mapping with stable symlinks, Identify Arm, the motor-ID wizard, a live motor monitor, calibration runs and validation) and **Camera Setup** (discovery, live preview, USB bandwidth). `--host 0.0.0.0` exposes it on the LAN behind a session token printed at startup; `--browser` opens a browser on desktop sessions. Configuration lives in `~/.config/lestudio`, shared with LeStudio.

## Commands

| Command | Answers |
|---|---|
| `lerobot-checkup serve` | The web UI (see above); the default when no subcommand is given |
| `lerobot-checkup report` | Everything below as one Markdown report: OS, Python, lerobot version, user groups, ports, cameras, udev symlinks, calibration files |
| `lerobot-checkup ports` | Which serial ports look like arms (`/dev/ttyACM*`, `/dev/ttyUSB*`), their USB serial and bus position, and any stable symlink |
| `lerobot-checkup cameras` | Which V4L2 cameras exist, their model, and the USB bus and speed each one shares |
| `lerobot-checkup motors --port /dev/ttyACM0 --ids 1-6` | Which Feetech motors answer on a port, with position, load and current per motor |
| `lerobot-checkup calibration [FILE ...]` | Whether calibration files parse and have sane ranges; defaults to every file in the LeRobot cache |
| `lerobot-checkup calibration --pair LEADER FOLLOWER` | The same, plus a leader/follower cross-check |
| `lerobot-checkup udev status` | Whether the udev rules are installed and every `/dev` symlink they define exists |
| `lerobot-checkup udev install` | Copies a generated rules file into `/etc/udev/rules.d` with `sudo` and reloads udev (`--dry-run` prints the commands) |

Add `--json` to any command for machine-readable output.

Exit status is `0` when nothing is wrong, `1` when a check found a problem (a missing group, a missing symlink, a motor that did not answer, a calibration error), and `2` for usage errors, so the commands can gate scripts.

### Example

```
$ lerobot-checkup report
# lerobot-checkup report

- OS: Linux-6.8.0-45-generic-x86_64-with-glibc2.39 (kernel 6.8.0-45-generic)
- Python: 3.12.3
- lerobot: 0.6.1
- lerobot-checkup: 0.1.0
- User groups: dialout OK, video MISSING
  - fix: `sudo usermod -aG video $USER` then log out and back in

## Serial ports (arms)

| device  | path         | symlink        | serial       | usb   |
| ------- | ------------ | -------------- | ------------ | ----- |
| ttyACM0 | /dev/ttyACM0 | follower_arm_1 | 5A46085090   | 1-2.3 |
| ttyACM1 | /dev/ttyACM1 | leader_arm_1   | 5A46085091   | 1-2.4 |
...
```

## Reporting a hardware problem

Run `lerobot-checkup report` and paste the output into the issue. It is Markdown, so it renders as-is on GitHub, and it carries the facts a maintainer asks for first: OS, Python and lerobot versions, group membership, which ports and cameras exist and on which USB bus, whether the stable symlinks resolve, and whether the calibration files parse.

The commands map onto the errors LeRobot prints:

| LeRobot says | Run |
|---|---|
| `Motor '...' (model 'sts3215') was not found`, `COMM_RX_TIMEOUT`, `Failed to sync read 'Present_Position' on ids=[...]`, `There is no status packet` | `lerobot-checkup motors --port PORT --ids 1-6` |
| `Read failed due to communication error on port /dev/ttyACM0`, `No such file or directory: '/dev/ttyACM1'` | `lerobot-checkup ports`, `lerobot-checkup udev status` |
| `Permission denied: '/dev/ttyACM0'`, `could not open port` | `lerobot-checkup report` (group membership) |
| camera fails to open, index changed, two cameras will not run together, `dmesg`: `No space left on device` | `lerobot-checkup cameras` |
| gripper opens fully at teleop start, arm jumps on connect, joint rotates after reconnection | `lerobot-checkup calibration`, `lerobot-checkup calibration --pair LEADER FOLLOWER` |

## Library

The same package is the hardware layer of the [LeStudio](https://github.com/TheMomentLab/LeStudio) workbench: LeStudio composes `lerobot_checkup.server.build_app` with its own workflow routes, and its Status, Motor Setup and Camera Setup pages are the checkup pages.

- `device_registry`, `device_helpers`: robot / teleoperator / camera catalogs from the installed `lerobot`, with a fallback catalog when it is absent; USB port and camera discovery.
- `udev_helpers`: generate, apply and remove udev rules for stable `/dev` symlinks.
- `motor_monitor_bridge`: a Feetech bus wrapper with collision detection and a freewheel mode.
- `motor_setup_bridge`, `calibrate_bridge`: subprocess entry points around `lerobot-setup-motors` and `lerobot-calibrate` that stream structured events.
- `calibration_validator`: range, drive-mode and leader/follower checks for calibration files.
- `type_policy`, `path_policy`: per-robot-family policy (Feetech SO-100 / SO-101 first, Dynamixel OMX second) and LeRobot cache paths.
- `server`, `process_manager`, `routes/`, `services/`: the FastAPI assembly, the subprocess manager and the hardware API used by both the checkup web UI and LeStudio.

## Scope

Feetech (SO-100 / SO-101) first, Dynamixel (OMX) second. Linux only (udev, V4L2). See `docs_public/direction.md` in the repository for the plan.

## License

Apache-2.0.
