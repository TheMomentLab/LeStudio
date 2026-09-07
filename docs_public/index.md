# LeStudio

**LeStudio** is hardware setup and diagnostics for [Hugging Face LeRobot](https://github.com/huggingface/lerobot) — stable USB port mapping, motor-ID setup, a live motor monitor and calibration validation — inside a web workbench that also runs the full loop from teleop to policy evaluation.

[LeLab](https://github.com/huggingface/leLab) is the official LeRobot GUI for the record → train → evaluate loop. LeStudio focuses on the step before that: getting hardware attached, identified and healthy. The hardware layer is being split into a standalone package; see [Direction](direction.md).

Start with installation and quick start if you're new to LeStudio. Use the architecture pages when you want to understand how the app is assembled internally.

## Features

### Workbench & Runtime Foundation
- **Workbench Layout** — Sidebar-driven workflow from hardware setup to training and evaluation.
- **Global Console Drawer** — Unified stdout/stderr stream, process input routing, and log copy actions.
- **Layout** — Desktop sidebar and a tablet drawer. Mobile widths are not supported.
- **Config Profiles** — Save, load, import, export, and delete working configurations.
- **Session History** — Track run-related events across recording, training, and evaluation flows.

### Hardware Setup & Validation
- **Status Dashboard** — Live device and process overview with CPU/RAM/Disk/GPU monitoring.
- **Camera Preview** — MJPEG and snapshot-based camera visibility from the UI.
- **Mapping** — Camera and arm udev rules with stable symlinks, and an Identify Arm wizard.
- **USB Bandwidth Monitoring** — Per-camera FPS, bandwidth, and bus utilization feedback.
- **Motor Setup wizard** — Write motor IDs one servo at a time with progress, error recovery and retry.
- **Motor Monitor** — Live position / load / current per motor, collision detection, freewheel, E-Stop.
- **Calibration** — Calibration execution, file management, and range / offset validation.
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

- [Direction](direction.md) — Where LeStudio fits next to LeLab, and the plan for the hardware package.
- [Installation](installation.md) — Set up your environment and install LeStudio.
- [Quick Start](getting-started.md) — Run your first session.
- [Architecture](architecture.md) — Understand the current system structure.
- [API and Streaming](api-and-streaming.md) — Learn how REST, WebSocket, and camera transport work.
- [Hardware Guide](hardware.md) — Connect cameras, arms, and configure udev rules.
- [Workflow](workflow.md) — End-to-end pipeline walkthrough.
- [Troubleshooting](troubleshooting.md) — Common issues and fixes.
- [Contributing](contributing.md) — Development constraints and contributor expectations.
