# Troubleshooting Guide

Robotics is hard. Dealing with hardware permissions and USB streams on Linux is often the trickiest part of setting up LeStudio. 
This document covers the most common issues you might encounter and how to fix them.

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
