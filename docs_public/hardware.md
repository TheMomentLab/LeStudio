# Hardware Guide

## Supported Hardware

LeStudio works with any hardware supported by [Hugging Face LeRobot](https://github.com/huggingface/lerobot), including:

- **Cameras**: Any V4L2-compatible USB camera (`/dev/video*`)
- **Arms**: Feetech STS/SCS servo-based arms (e.g., SO-ARM100, Koch v1.x)

## Connecting Devices

### Cameras

1. Plug in your USB cameras.
2. Run `ls /dev/video*` to confirm they appear.
3. Open the **Mapping** tab in LeStudio to bind them to stable symlinks.

### Arms

1. Connect the leader and follower arms via USB.
2. The **Arm Identify Wizard** in the Mapping tab detects arms by a disconnect/reconnect diff.

## udev Rules

LeStudio uses udev rules to assign stable symlinks like `top_cam_1` and `follower_arm_1` to your devices — so `/dev/video2` doesn't change after a reboot.

### Creating Rules

1. Go to **Mapping** tab → **Add Camera Rule** or **Add Arm Rule**.
2. Fill in a friendly name (e.g., `top_cam_1`).
3. Click **Apply Rules**.

### Applying Rules

LeStudio writes rules to `/etc/udev/rules.d/99-lerobot.rules` using either:

- **Polkit** (`pkexec`) — graphical sudo prompt (desktop environments)
- **sudo** — terminal password prompt
- **Manual** — `lestudio install-udev` in your terminal

After applying, re-plug your USB devices (or reboot) to activate symlinks.

### Verifying Rules

The Mapping tab shows ✅/❌ status for each symlink. You can also check:

```bash
ls -la /dev/top_cam_1 /dev/follower_arm_1
```

## USB Bandwidth

USB cameras compete for bandwidth on shared USB controllers. LeStudio shows a real-time **USB bandwidth bar** per camera feed (fps, MB/s, and bus utilization).

!!! warning
    If you see `No space left on device` errors in `dmesg`, your cameras are on the same USB bus.
    Spread cameras across different physical USB ports on your motherboard (different PCIe roots).

## Motor Setup

Use the **Motor Setup** tab to:

- Run `lerobot_setup_motors` for your arm
- Verify motor IDs and connectivity

This step is typically only needed for new hardware or after replacing servos.
