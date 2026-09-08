# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Direction
- LeLab became the official LeRobot GUI (April–June 2026). LeStudio is being
  reorganised around hardware setup and diagnostics as a standalone package
  (`lerobot-checkup`) with the workbench kept on top. See
  `docs_public/direction.md`. Steps 1 and 2 of the plan are done (below).

### Added
- `lerobot-checkup serve` (also the default with no arguments): the standalone
  hardware web UI — Status, Motor Setup and Camera Setup — on port 7861. It is
  the same frontend built with `npm run build:checkup` (hardware pages only,
  no Hub / training probes) served by `lerobot_checkup.server`.
- `lerobot-checkup` CLI: `ports`, `cameras`, `motors --port`, `calibration
  [--pair]`, `udev status|install` and `report` (Markdown, or `--json` on any
  command) so hardware state can be pasted into issues. Exit status 1 flags a
  problem. `lestudio install-udev` delegates to it. The package builds as an
  sdist/wheel (`python -m build packages/lerobot-checkup`) and a tag-triggered
  workflow (`lerobot-checkup-v*`) publishes it through PyPI trusted publishing.
- The package is named `lerobot-checkup` (import `lerobot_checkup`); the
  working name `lerobot-doctor` collides with an unrelated PyPI project.
- OMX (OpenManipulator-X) support, a robot-family policy catalog and
  centralized calibration-source resolution (merged from `dev`).
- Semantic design tokens for both themes (`frontend/src/styles/theme.css`),
  a custom ESLint plugin (`design/prefer-design-token` and friends) and a
  `design:audit` ratchet script wired into CI.
- Shared UI primitives: `Card` (`icon`, `action`, `bodyClassName`,
  `titleClassName`), `SectionLabel`, `EmptyState compact`, `SubTabs` /
  `ModeToggle` `size`, shared `inputClassName` / `selectClassName`.
- `MotorSetupControlBar`: Motor Setup's four tabs use the same bottom
  control bar as Teleop / Record / Train / Eval.
- Status prerequisites are actions: the Hugging Face row opens the token
  popover, Device Mapping links to Motor Setup.
- Mock transport now covers the Motor Monitor, dataset stats / tags /
  derive / push / delete, and process-status flips, so every screen state
  is reachable offline.
- `tests/_routing.py` helper for route introspection across FastAPI versions.

### Changed
- Repository re-laid out as a monorepo: `packages/lerobot-checkup` (hardware
  layer library: device registry, udev / type / path policy, motor and
  calibration bridges) and `packages/lestudio` (FastAPI backend + React
  frontend, depends on `lerobot-checkup`). Shared tool config lives in the
  root `pyproject.toml`. Behaviour unchanged.
- Upstream `lerobot` is now a pip dependency (`>=0.4.4,<0.7`) instead of a
  pinned fork submodule. CI runs the backend on Python 3.10 (lerobot 0.4.x)
  and 3.12 (latest 0.6.x). The record and teleop bridges handle the
  keyboard-listener and visualization helper renames in lerobot 0.5+.
- The server assembly and the hardware routes moved into `lerobot_checkup`:
  auth / CORS / logging middlewares, `ProcessManager`, camera streaming, the
  device watcher, `AppState`, and the devices / config / udev / motor /
  process / streaming route modules. `lestudio.server` composes
  `lerobot_checkup.server.build_app` with its workflow routers (operate,
  training, eval, dataset). Public API paths are unchanged.
- Eval launches through `lestudio.eval_bridge`, which registers the
  bimanual and OMX robot / teleoperator families before delegating to
  upstream `lerobot_eval` (the fork used to patch this into the script).
- Every page migrated from raw Tailwind palette classes to design tokens
  (1,948 → 0); the ESLint rule is enforced on all of `src/app`.
- One look per role: green only on process-start buttons, one segmented
  control style, one selection style, one empty-state component, one
  keyboard-focus outline for pressable controls.
- Sidebar docks at 1024px instead of 768px; the stepper bar is sticky.
- Toaster sits below the header instead of over its controls.
- Session History timestamps and console tab emphasis toned to match.
- Dependencies: react-router 7.18.3, vite 6.4.3 (npm audit clean),
  pyarrow ≥ 23.0.1.

### Removed
- The `lerobot` git submodule (TheMomentLab fork). Delete the old `lerobot/`
  directory and re-run `make install` when upgrading a checkout.
- `tests/test_so_drive_modes.py` and `tests/test_feetech_serial_trace.py`:
  they exercised patches the fork carried inside lerobot itself (SO drive-mode
  defaults, first-sync-read retry, Feetech homing-offset wrap), which do not
  exist upstream.

### Fixed
- Backend tests passed vacuously / failed on FastAPI ≥ 0.13x because
  `include_router` no longer flattens `app.routes`.
- Card bodies with a fixed height collapsed inside the column flex
  container, hiding the evaluation reward chart.
- Motor Setup wizard colours were dark-only and unreadable on the light
  theme; Colab snippet and debug snapshot blocks were forced dark.
- Calibration tab showed the Single / Bi-Arm selector twice.
- Dataset list rows were not reachable from the keyboard.
- Two React `exhaustive-deps` warnings and three token-rule violations
  introduced by the `dev` merge.

## [0.1.0] - 2026-03-03

### Added
- Full web GUI workflow for LeRobot setup and operations:
  Status, Camera Setup, Motor Setup, Calibration, Teleop, Recording, Dataset,
  Training, and Evaluation flows.
- FastAPI backend route modules for process orchestration, devices, udev,
  training, evaluation, dataset listing/curation/hub, and streaming.
- Process lifecycle management with streamed logs and command/input bridging.
- Dataset curation and Hugging Face Hub integration paths.
- Public docs site via MkDocs and bilingual README support.

### Changed
- Package and naming migration from legacy naming to `lestudio`.
- Frontend architecture migration and wireframe/app-shell integration.
- UX refinements across 9-tab workflow and responsive layouts.

### Fixed
- Multiple training/evaluation preflight and blocker UX consistency issues.
- Console and dataset UI polishing and reliability issues.
- Recording/teleop feed and runtime stability fixes.

### Refactored
- Backend typing and request model cleanup with broader route coverage.
- Frontend component extraction for heavy pages and baseline test harness setup.

### Documentation
- Added release checklist, troubleshooting updates, and broader design docs.

---

For detailed release process and validation gates, see `docs/release-checklist.md`.

When documenting user-visible changes for a release, keep `docs_public/feature-spec.md`, `README.md`, and `README.ko.md` synchronized with the shipped product scope.
