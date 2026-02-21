# LeRobot Studio — Implementation Roadmap

## Current State

6-tab web GUI covering the full robot setup workflow:
**Status → Camera Setup → Motor Setup → Calibration → Teleop → Record**

Backend: FastAPI + subprocess spawning + WebSocket stdout streaming  
Frontend: Vanilla HTML/JS/CSS, no framework

### Completed Features

| Feature | Description |
|---------|-------------|
| Stream state feedback | Loading spinner, error card with Retry, frozen-feed detection (canvas pixel hash), LIVE badge |
| Quality presets | High / Medium / Low buttons in Teleop & Record tabs — adjusts fps + jpeg_quality via GET-then-PATCH |
| Per-feed on/off | × button pauses individual streams; Resume restores with cache-busting |
| USB bandwidth monitoring | Real-time fps · MB/s per feed card; USB bus utilization bar (warn/danger thresholds) |

---

## Phase 1 — Train Tab

**Goal**: Complete the workflow loop. Record a dataset → train a policy → deploy, all from one GUI.

**Core infrastructure needed**

| Item | File | Notes |
|------|------|-------|
| `build_train_args()` | `command_builders.py` | Wrap `python -m lerobot.scripts.train` |
| `/api/train/start` | `server.py` | Same pattern as `/api/record/start` |
| `/api/train/stop` | `server.py` | Via `ProcessManager.stop("train")` |
| Train tab UI | `index.html` + `main.js` | New `TrainTab` class |

**MVP UI controls**

- Policy type selector: ACT / Diffusion / TDMPC2
- Dataset repo ID input (pre-filled from Record tab config)
- Number of training steps
- Device selector: cuda / cpu (auto-detect GPU on load)
- Start / Stop buttons + log output panel

**+α (post-MVP)**

- Real-time loss curve chart (parse stdout → Chart.js)
- GPU utilization monitor (`nvidia-smi` polling via `/api/gpu/status`)
- Checkpoint list & resume from checkpoint
- Auto-upload to HuggingFace Hub on completion

**Known constraints**

- LeRobot train uses Hydra config — expose only key params, not all 20+
- Hide Train tab if no GPU detected (or show warning)
- Long-running process (hours~days) → server restart kills it; document this limitation clearly

---

## Phase 2 — Open Source Readiness

**Goal**: Make the project contributable by the LeRobot community.

- [ ] `CONTRIBUTING.md` — setup guide, PR flow, code style
- [ ] GitHub Actions CI — pylint + basic import/startup test
- [ ] Issue templates — Bug report, Feature request
- [ ] Docker image — `docker run` single-command startup
- [ ] Announce in LeRobot Discord / HuggingFace forums

---

## Phase 3 — Multi-Robot & Plugin Architecture

**Goal**: Support robots beyond SO-100/SO-101 without hardcoding.

- Abstract robot type into a config schema (currently hardcoded in `ROBOT_TYPES` list)
- Plugin interface: drop a YAML file to add a new robot type
- Community-contributed robot profiles (Koch v1.1, Moss v1, Aloha, etc.)

---

## Phase 4 — Dataset Browser

**Goal**: Review and curate recorded episodes without leaving the GUI.

- List local datasets from `~/.cache/huggingface/lerobot/`
- Episode playback (replay camera frames + motor positions)
- Episode delete / tag / export
- Basic stats: episode count, task distribution, recording duration

---

## Phase 5 — Remote Operation

**Goal**: Operate the robot from a different machine over the network.

- WebRTC camera streaming (low-latency, replace MJPEG)
- Remote teleop over WebSocket (send joint commands from browser)
- Auth layer (token-based, single-user)

---

## Dependency Map

```
Phase 1 (Train)     — independent, buildable now
Phase 2 (OSS)       — independent, buildable now
Phase 3 (Plugin)    — requires Phase 2 community validation
Phase 4 (Dataset)   — independent, buildable after Phase 1
Phase 5 (Remote)    — requires Phase 3 stability
```
