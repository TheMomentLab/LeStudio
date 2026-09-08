# Troubleshooting

Robotics is hard. Dealing with hardware permissions and USB streams on Linux is often the trickiest part of setting up LeStudio.
This document covers the most common issues you might encounter and how to fix them.

## 0. Start with `lerobot-checkup`

Most hardware problems are one of five things: the port is not the port you think it is, a motor is not answering, a camera shares a saturated USB bus, your user is not in `dialout` / `video`, or a calibration file has a bad range. `lerobot-checkup` (installed with LeStudio, or on its own with `pip install lerobot-checkup`) answers each of those from the terminal:

```bash
lerobot-checkup report                     # everything below as one Markdown page — paste it into your issue
lerobot-checkup ports                      # serial ports that look like arms, with USB serial and stable symlink
lerobot-checkup cameras                    # cameras, their model, and the USB bus each one shares
lerobot-checkup motors --port /dev/ttyACM0 # which motor IDs answer, with position / load / current
lerobot-checkup calibration                # validate every calibration file in ~/.cache/huggingface/lerobot
lerobot-checkup udev status                # are the stable /dev symlinks in place?
```

### LeRobot error → what to run

These are the error strings LeRobot itself prints. They apply whether you launch through LeStudio or run `lerobot-teleoperate` / `lerobot-record` / `lerobot-setup-motors` directly.

| You see | Usually means | Run |
|---|---|---|
| `Motor 'gripper' (model 'sts3215') was not found. Make sure it is connected.` or `COMM_RX_TIMEOUT` from `lerobot-setup-motors` | The bus is open but no motor answers at that ID. Power off, wrong baud rate, a broken daisy-chain cable, or the ID was never set. | `lerobot-checkup motors --port /dev/ttyACM0 --ids 1-6`. If no ID answers: check the 12 V supply and the cable into the first motor. If IDs 1–3 answer and 4–6 do not: the chain is broken after motor 3. |
| `Failed to sync read 'Present_Position' on ids=[2,3,4,6] ... [TxRxResult] There is no status packet` | Some motors dropped off the bus, or two motors share an ID. | `lerobot-checkup motors --port ... --ids 1-6` lists exactly which IDs respond. Duplicate IDs show up as one responder for two physical motors. |
| `ConnectionError: Read failed due to communication error on port /dev/ttyACM0` | The port exists but is not the arm (it moved after a re-plug), or the arm is powered off. | `lerobot-checkup ports` to see which port carries which USB serial, then `lerobot-checkup udev status` if you use symlinks. |
| `could not open port /dev/ttyACM0` or `PermissionError: [Errno 13] Permission denied: '/dev/ttyACM0'` | Your user is not in `dialout`. | `lerobot-checkup report` prints your group membership and the `usermod` line to fix it. Log out and back in afterwards. |
| `FileNotFoundError: [Errno 2] No such file or directory: '/dev/ttyACM1'` after a reboot | USB enumeration order changed. | Map the arms to stable names in Motor Setup (or `lerobot-checkup udev install`), then use `/dev/follower_arm_1` in your config. |
| `OpenCVCamera(...)` fails to connect, `Can't open camera by index`, or the camera index changed | Index-based camera paths are not stable, or the camera is busy in another process. | `lerobot-checkup cameras` shows device, model and symlink. Use `/dev/video*` paths or udev symlinks instead of indexes. |
| Two cameras work alone but not together, or fps collapses; `dmesg` shows `No space left on device` | USB bandwidth. Uncompressed YUYV at 640×480@30 is about 147 Mbit/s per camera; two of them saturate a USB 2.0 bus. | `lerobot-checkup cameras` prints the USB bus and speed for every camera. Move one to another controller, or set `fourcc=MJPG` in the camera config. |
| The gripper opens fully at teleop start, the arm jumps on connect, or a joint rotates by itself after reconnection | A calibration range or homing offset is wrong, or the leader and follower were calibrated differently. | `lerobot-checkup calibration` (per-file ranges and drive modes), then `lerobot-checkup calibration --pair LEADER FOLLOWER` for the cross-check. Re-run `lerobot-calibrate` for the flagged arm. |
| `lerobot-find-cameras` prints nothing | Not in the `video` group, or no camera is index 0 of its device. | `lerobot-checkup report` (groups) and `lerobot-checkup cameras`. |

Every command takes `--json` and exits with status 1 when it found a problem, so they can gate a startup script.

## 1. udev Rules & Symlink Issues

LeStudio generates udev rules (like `99-lerobot.rules`) to bind unpredictable USB paths (e.g., `/dev/video2`) to stable symlinks (`top_cam_1`, `follower_arm_1`).

### Symptoms
- The UI shows "Not Found" for cameras or arms.
- When applying rules from the UI, you get a "Permission Denied" or "pkexec failed" error.
- You applied the rules, but the `/dev/top_cam_1` symlinks don't appear.

### Solutions
1. **Apply Manually**: If the UI "Apply" button fails (because your Linux environment lacks a graphical Polkit agent or you are SSH'd without root), run the commands manually:
   ```bash
   lestudio install-udev
   ```
   *Note: This will ask for your `sudo` password in the terminal.*

2. **Re-plug USB cables**: udev rules trigger when a device is connected. After applying the rules, physically unplug and plug back the USB hubs/cameras/arms. Alternatively, reboot your computer.

3. **Check dmesg for conflicts**:
   Run `dmesg -w` and plug in your camera. If you see USB bandwidth errors (`No space left on device`), you have too many cameras on a single USB controller. You must spread your cameras across different physical USB ports on your motherboard.

## 2. Camera Access (Permission Denied)

### Symptoms
- LeStudio Status UI says "Permission denied for /dev/video*".
- The preview shows a broken image icon.

### Solutions
On Linux, accessing `/dev/video*` devices requires you to be in the `video` group (and sometimes `dialout` or `tty` for serial arms).

```bash
# Add yourself to the groups
sudo usermod -a -G video $USER
sudo usermod -a -G dialout $USER
sudo usermod -a -G tty $USER

# YOU MUST LOG OUT AND LOG BACK IN OR RESTART for this to take effect!
# To apply immediately in the current terminal, run:
newgrp video
newgrp dialout
```

## 3. Training & CUDA Preflight Failures

Before starting a PyTorch training run, LeStudio checks your GPU compatibility via a Preflight check.

### Symptoms
- The Train tab says "CUDA arch mismatch" or "CUDA is not available".
- You see `RuntimeError: libnppicc.so not found` or similar `torchcodec` errors.

### Solutions
LeStudio runs within the Python environment you started it from. If it says CUDA is missing, your PyTorch installation in this `conda` environment was built for CPU, or your NVIDIA drivers are mismatched.

1. **Let LeStudio Fix It**: If LeStudio offers a "Fix" button or shows an install command in the console (e.g., `pip install --pre torch torchvision torchaudio --index-url ...`), click it or run it in your terminal. LeStudio automatically calculates the exact PyTorch wheel URL for your GPU architecture.
2. **torchcodec & FFmpeg**: If you are decoding MP4 datasets, `torchcodec` needs FFmpeg libraries. Run:
   ```bash
   conda install -y -c conda-forge ffmpeg
   ```
   If it still complains about `libnppicc`, install the CUDA toolkit runtime:
   ```bash
   conda install -y -c nvidia cuda-toolkit
   ```

## 4. Zombie Processes / Port Conflicts

### Symptoms
- "Cannot start teleop: process is already running" but nothing is happening.
- "Address already in use" errors in the console.

### Solutions
LeStudio manages processes like `lerobot_teleop` as child processes. Sometimes, if LeStudio crashes or is killed forcefully (`kill -9`), the child processes keep running and hold onto the USB cameras or network ports.

1. Click the "Stop" button in the UI.
2. If that fails, open your terminal and kill them manually:
   ```bash
   pkill -f "lerobot"
   ```

## 5. Network (0.0.0.0) Token Auth Issues

### Symptoms
- You run `lestudio serve --host 0.0.0.0` and connect from another computer.
- You click a button (e.g., "Start Teleop") and see a red "Unauthorized" or 401 error.

### Solutions
By design, remote access requires a security token to prevent unauthorized execution of code on your robot.
1. Check the terminal where you launched `lestudio`. You will see a line like: `Token (Network auth): 4f8b9...`
2. However, the web UI must automatically send this. Currently, the easiest way to ensure the UI has the token is to use an SSH tunnel (which looks like localhost to the server, bypassing auth), OR explicitly set the token environment variable before starting:
   ```bash
   export LESTUDIO_TOKEN="my-secret"
   lestudio serve --host 0.0.0.0
   ```
   *(Note: Browser-side token input UI is planned for a future release.)*

## 6. Eval (Policy Evaluation) Issues

### Symptoms
- `ValueError: env.type is required` when starting eval.
- `KeyError: observation.images.follower_cam_1` or similar camera key errors.
- `gymnasium.error.NameNotFound` or "Environment plugin not installed" errors.

### Solutions

1. **"env.type is required"**: Select an Env Type in the Eval tab. If the checkpoint's `config.yaml` does not include `env.type`, LeStudio tries to infer it automatically, but you may still need to choose it manually.
   - `gym_manipulator` — 일반적인 로봇 팔 teleoperation 데이터셋
   - `aloha` — ALOHA bi-arm 데이터셋

2. **Camera key mismatch**: This happens when the Eval environment expects camera keys such as `observation.images.top`, but your dataset uses different names such as `observation.images.follower_cam_1`.
   - Use the Camera Mapping section in the Eval tab to map dataset cameras to environment cameras.
   - `gym_manipulator` expects a `top` camera by default.

3. **"Environment plugin not installed"**: The gym environment package you want to use is not installed.
   ```bash
   # gym_manipulator의 경우 (lerobot 내장 — 별도 설치 불필요)
   # aloha의 경우
   pip install gym-aloha
   ```
   Restart LeStudio after installation.

## Related Guides

- Read [Installation](installation.md) if the issue starts before the server launches.
- Read [Hardware Guide](hardware.md) for cameras, arms, permissions, and udev rules.
- Read [Workflow](workflow.md) to understand where a failure happens in the overall pipeline.
