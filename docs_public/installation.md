# Installation

This guide covers the minimum environment and commands needed to get LeStudio running from source.

## Requirements

- Python 3.12 recommended. 3.10 / 3.11 still work, but resolve to lerobot 0.4.x (the last line supporting them).
- Linux (for `udev` rules and `/dev/video*` access)
- [Hugging Face LeRobot](https://github.com/huggingface/lerobot) is installed automatically as a pip dependency (`lerobot>=0.4.4,<0.7`)

### System Packages (Ubuntu / Debian)

LeStudio and LeRobot depend on system libraries that are not installed by `pip`. On a fresh Ubuntu 22.04+ machine, install these first:

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    cmake \
    git \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6
```

| Package | Why |
|---|---|
| `build-essential`, `cmake` | Compile native Python extensions during `pip install` |
| `git` | Clone the repository |
| `ffmpeg` | Video encoding/decoding for dataset recording and playback |
| `libgl1-mesa-glx`, `libglib2.0-0`, `libsm6`, `libxext6` | Runtime libraries required by OpenCV |

#### User Groups for Hardware Access

If you plan to use cameras or motor arms, your user must be in the right groups:

```bash
sudo usermod -a -G video,dialout $USER
```

Log out and back in (or reboot) for changes to take effect.

- `video` — camera access (`/dev/video*`)
- `dialout` — serial motor access (`/dev/ttyUSB*`, `/dev/ttyACM*`)

### Optional

| Capability | Requirement |
|---|---|
| udev apply (one-click) | Passwordless `sudo` or a desktop Polkit agent (`pkexec`) |
| Hub push / download | `huggingface-cli login` with a valid token |
| GPU monitoring / CUDA preflight | CUDA environment + `nvidia-smi` |

## Install from Source

```bash
git clone https://github.com/TheMomentLab/lestudio.git
cd lestudio

# one-time: create conda env if you don't have one
conda create -n lerobot python=3.12 -y

conda activate lerobot
make install
```

`make install` installs `lerobot-doctor` and `lestudio` in editable mode. `lestudio` declares upstream `lerobot` as a dependency, so pip pulls it (with the dataset, training and Feetech / Dynamixel extras) for your Python version. If you need a specific torch build (CUDA version, CPU-only), install torch first; pip keeps a compatible torch that is already present.

Upgrading from an older checkout that used the `lerobot` git submodule: delete the `lerobot/` directory and run `make install` again. The fork is no longer used.

If you plan to contribute or run the full verification stack (`ruff`, `mypy`, pytest helpers), run `make dev` after the base install.

## Verify Installation

```bash
lestudio --help
```

Expected output lists `serve` and `install-udev` subcommands.

## Command Line Options

```
usage: lestudio [-h] {serve,install-udev} ...

subcommands:
  serve           Start the LeStudio web server (default when no subcommand given)
  install-udev    Install udev rules via sudo (CLI alternative to the web UI)

lestudio serve:
  --port PORT           Server port (default: 7860)
  --host HOST           Server host (default: 127.0.0.1)
  --lerobot-path PATH   Path to lerobot source (auto-detected if installed)
  --config-dir DIR      Config directory (default: ~/.config/lestudio)
  --rules-path PATH     udev rules file (default: /etc/udev/rules.d/99-lerobot.rules)
  --browser             Open a browser automatically on startup
  --no-browser          Deprecated no-op; browser is not opened unless --browser is passed
  --headless            Alias for --no-browser
```

Flags can be passed without explicitly typing `serve`:

```bash
lestudio --port 8080   # same as: lestudio serve --port 8080
```

## Network & CORS

Default bind is local-only (`127.0.0.1`).

To expose on LAN:

```bash
lestudio serve --host 0.0.0.0
```

Override CORS with environment variables:

```bash
# Comma-separated explicit allowlist
export LESTUDIO_CORS_ORIGINS="http://localhost:7860,https://studio.example.com"

# Optional regex override
export LESTUDIO_CORS_ORIGIN_REGEX='^https://(localhost|127\.0\.0\.1)(:\d+)?$'
```

!!! warning
    `LESTUDIO_CORS_ORIGINS="*"` is supported for development only — not recommended for shared networks.

## Next Steps

- Continue with [Quick Start](getting-started.md) to launch your first session.
- Use [Hardware Guide](hardware.md) if you need help wiring cameras, arms, or udev rules.
- Check [Troubleshooting](troubleshooting.md) if installation succeeds but runtime setup fails.
