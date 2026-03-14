# LeStudio

**LeStudio** is a web-based GUI workbench for [Hugging Face LeRobot](https://github.com/huggingface/lerobot) — covering the full robot pipeline from hardware setup to policy evaluation.

It replaces the CLI-heavy LeRobot workflow with a browser-based interface that runs locally on your machine.

Start with installation and quick start if you're new to LeStudio. Use the architecture pages when you want to understand how the app is assembled internally.

## Features

### Workbench & Runtime Foundation
- **Workbench Layout** — Sidebar-driven workflow from hardware setup to training and evaluation.
- **Global Console Drawer** — Unified stdout/stderr stream, process input routing, and log copy actions.
- **Responsive Navigation** — Desktop sidebar, tablet icon rail, and mobile drawer layout.
- **Config Profiles** — Save, load, import, export, and delete working configurations.
- **Session History** — Track run-related events across recording, training, and evaluation flows.

### Hardware Setup & Validation
- **Status Dashboard** — Live device and process overview with CPU/RAM/Disk/GPU monitoring.
- **Camera Preview** — MJPEG and snapshot-based camera visibility from the UI.
- **Mapping** — Camera and arm udev rule management, including Arm Identify Wizard.
- **USB Bandwidth Monitoring** — Per-camera FPS, bandwidth, and bus utilization feedback.
- **Motor Setup** — Motor connectivity and setup via `lerobot_setup_motors`.
- **Calibration** — Calibration execution, file management, and delete.
- **Preflight Checks** — Validate devices, calibration, cameras, and CUDA before launch.

### Operation: Teleop & Record
- **Teleop** — Multi-camera teleoperation with preflight checks and live SHM-shared camera feeds.
- **Record** — Episode recording with browser-side episode control, resume support, and preflight checks.

### Dataset & Hub
- **Dataset** — Local dataset listing, detail, delete, and quality checks.
- **Episode Replayer** — Multi-camera synchronized playback with timeline scrubbing.
- **Episode Curation** — Per-episode delete, tag, and filter.
- **Hub Search & Download** — Search and download datasets directly from Hugging Face Hub.
- **Hub Push** — Push local datasets with tracked job progress.

### Training & Evaluation
- **Train** — LeRobot training with CUDA preflight, real-time loss/LR chart, ETA tracking, and hyperparameter presets.
- **Dependency Remediation** — Guided install flows for PyTorch and related training dependencies.
- **Checkpoint Browser** — Scan local checkpoints and auto-link to Eval.
- **Eval** — Policy evaluation with live output and per-episode result tracking.

### Monitoring & Operator Feedback
- **Runtime Status** — Shared WebSocket status, process stop controls, and orphan-process recovery signals.
- **System Monitoring** — GPU and system resource visibility from the UI.
- **Error Translation** — Common raw process failures converted into operator-readable guidance.
- **Desktop Notifications** — Browser notifications for completion and failure events.
- **Dark/Light Theme** — CSS variable-based theme toggle.

## Quick Links

- [Installation](installation.md) — Set up your environment and install LeStudio.
- [Quick Start](getting-started.md) — Run your first session.
- [Architecture](architecture.md) — Understand the current system structure.
- [API and Streaming](api-and-streaming.md) — Learn how REST, WebSocket, and camera transport work.
- [Hardware Guide](hardware.md) — Connect cameras, arms, and configure udev rules.
- [Workflow](workflow.md) — End-to-end pipeline walkthrough.
- [Troubleshooting](troubleshooting.md) — Common issues and fixes.
- [Contributing](contributing.md) — Development constraints and contributor expectations.
