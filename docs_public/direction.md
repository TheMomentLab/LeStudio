# Direction

Last updated: 2026-09-08
Status: decided, not yet implemented — see the plan at the bottom

---

## 1. What changed

LeStudio started on 2026-02-21 as a full-loop web workbench for LeRobot: hardware setup → teleop → record → dataset → train → eval. At that time no official GUI existed; the only candidate was a June 2025 hackathon repo (`nicolas-rabault/leLab`) with 24 commits and no activity for ten months.

Six weeks after LeStudio's last commit, Hugging Face moved that repo into its organization (2026-04-29), pushed 317 commits in May, added it to the LeRobot docs (2026-06-03) and README (2026-06-17). **LeLab is now the official LeRobot GUI.** In the same window LeRobot 0.6.0 gained native Foxglove visualization for teleop / record / replay / eval, and the official dataset visualizer gained the same episode-quality filters LeStudio ships.

So the sentence LeStudio was built on — "there is no GUI for LeRobot" — was true in February and is false now.

## 2. Where LeStudio fits today

| Axis | Who covers it | LeStudio |
|---|---|---|
| Full-loop workflow GUI | LeLab (official, SO-101 only) | Overlaps. Not a place to compete with the official tool. |
| Dataset quality & curation | Official dataset visualizer (movement / jerk / length flags), RoboticsData `score_lerobot_episodes` (5 metrics, CLI) | Same three metrics, fewer than the CLI. Tag → derive inside the GUI is the only extra. |
| Live visualization / teleop | Foxglove built into LeRobot 0.6.0 | Overlaps, less capable. |
| Vendor robots (OMX …) | ROBOTIS Physical AI Tools, `omx_follower` in LeRobot core | Not a differentiator. |
| **Hardware setup & diagnostics** | LeRobot CLI (`find_port`, `setup_motors`, `calibrate`, `find_cameras`) and LeLab's SO-101-only guided calibration | **Open.** udev port mapping with stable symlinks, Identify Arm, motor-ID wizard, Motor Monitor (position / load / current / collision / freewheel / E-Stop), calibration file validation, camera mapping. No other GUI in the survey offers these. |

Demand is not hypothetical. Of the 1,459 issues in `huggingface/lerobot`, keyword buckets for ports / udev (267), camera detection (258), motor IDs (205) and calibration (97) add up to more than a third. Those users currently get CLI output and forum answers.

The full survey with repository metrics and sources lives in the project notes (market position report, 2026-09-07).

## 3. Decision

**Keep LeStudio. Add a second, narrower product. One repository, two packages.**

- **`lerobot-doctor`** *(working name — not final)*: the hardware setup and diagnostics layer as a standalone tool. `pip install`, one command opens the web UI, and a CLI for the same checks so answers can be pasted into issues. Depends on upstream `lerobot` by version range, not on a fork.
- **LeStudio Workbench**: the existing full-loop UI, which depends on `lerobot-doctor` for its Status / Motor Setup / Camera Setup pages.

Why not pivot LeStudio itself: the workbench is finished work and shows the full stack; turning it into a diagnostics tool throws that away. Why not a second repository: a solo maintainer would fix every LeRobot API change twice. The 2026-09-07 CI failure was exactly that kind of drift.

What moves into `lerobot-doctor` (all of it exists today):

| Area | Backend | Frontend |
|---|---|---|
| Device discovery, udev rules, Identify Arm | `device_registry.py`, `routes/udev.py`, `routes/devices.py` | `SystemStatus`, `MotorSetup/MappingTabPanel`, `IdentifyArmModal` |
| Motor ID wizard | `motor_setup_bridge.py`, `routes/process.py` (motor_setup) | `MotorSetup/SetupTabPanel` |
| Motor Monitor | `motor_monitor_bridge.py`, `routes/motor.py` | `MotorSetup/MonitorTabPanel`, `MotorCard` |
| Calibration run + validation | `calibrate_bridge.py`, `calibration_validator.py` | `MotorSetup/CalibrationTabPanel` |
| Camera discovery + preview | `routes/streaming.py` (stats, snapshot) | `CameraSetup` |

Shared between both packages: the design tokens and `components/wireframe` primitives (`DESIGN_GUIDE.md`), `apiClient`, the store, and the mock transport.

## 4. Plan

Order matters: the first three steps add no features. They draw the boundary and ship.

1. **Re-layout as a monorepo** — `packages/lerobot-doctor` and `packages/lestudio`, shared frontend primitives. Behaviour unchanged. *Done 2026-09-08 for the Python side: the hardware layer (device registry, udev/type/path policy, motor and calibration bridges) now lives in `lerobot-doctor` as a library, and `lestudio` depends on it. The frontend is not split yet and `lerobot-doctor` has no server or CLI; those come with step 3.*
2. **Drop the lerobot fork submodule** — depend on upstream `lerobot` by version range; run CI against the latest release so drift shows up immediately. *Done 2026-09-08: `lestudio` depends on `lerobot>=0.4.4,<0.7`; CI runs Python 3.10 (0.4.x floor) and 3.12 (latest 0.6.x). The fork's extras (Lepton camera, depth recording, one-hot record labels, MJPG-first camera probe, real-robot eval registration) are not carried over.*
3. **Publish `lerobot-doctor`** — `pip install`, `lerobot-doctor` (web) and `lerobot-doctor ports | motors | cameras | calibration` (CLI). First public release.
4. **Answer where the pain is** — point LeRobot port / motor / camera issues at the tool.
5. **Then the workbench** — reposition LeStudio as "diagnostics plus the full loop", and decide page by page what to keep versus hand to LeLab.

Feetech (SO-100 / SO-101) first; Dynamixel (OMX) second. Mobile widths are out of scope.

## 5. Non-goals

- Competing with LeLab on the full workflow, cloud training or 3D visualization.
- Re-implementing what Foxglove now does for live plots.
- Supporting robots the LeRobot core does not.

## 6. Risks

- **LeRobot moves fast.** Version-range dependency plus CI against latest is the mitigation; a pinned fork is not.
- **Hugging Face may add the same features to LeLab.** Contributing pieces upstream is the hedge, not a reason to wait.
- **Motor Monitor is Feetech-specific** until Dynamixel support lands.
- **A solo project reads as abandoned after a gap.** Small, regular releases matter more than any single feature.

## 7. Reading the rest of the docs

Everything else under `docs_public/` describes the workbench as it runs today. Where a page says "LeStudio does X", X is either workbench-only or destined for `lerobot-doctor` per the table above; the split has not shipped yet.
