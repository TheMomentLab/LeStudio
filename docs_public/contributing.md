# Contributing

Thank you for contributing to LeStudio!

This page is the public contributor entry point. For deeper internal design notes, see the repository docs under `docs/`.

## Development Setup

```bash
git clone --recursive https://github.com/TheMomentLab/lestudio.git
cd lestudio
conda activate lerobot
make dev
```

`make dev` installs the contributor toolchain used in CI (`ruff`, `mypy`, pytest helpers). Use `make install` only if you want the runtime package without dev tooling.

## Project Structure

```
LeStudio/
├── packages/
│   ├── lerobot-doctor/                 # Hardware layer library (no server, no CLI yet)
│   │   └── src/lerobot_doctor/
│   │       ├── device_registry.py      # 3-Registry discovery (lerobot import boundary)
│   │       ├── motor_monitor_bridge.py # FeetechMotorsBus REST (lerobot import boundary)
│   │       ├── calibrate_bridge.py     # Calibration subprocess entry
│   │       ├── motor_setup_bridge.py   # Motor setup subprocess entry
│   │       ├── calibration_validator.py
│   │       ├── type_policy.py          # Robot/teleop type policy
│   │       ├── path_policy.py          # Dataset/calibration path policy
│   │       ├── device_helpers.py
│   │       └── udev_helpers.py
│   └── lestudio/                       # Workbench: FastAPI backend + React frontend
│       ├── frontend/                   # React + TypeScript + Vite frontend
│       │   └── src/
│       │       ├── main.tsx            # Frontend entrypoint
│       │       ├── app/
│       │       │   ├── App.tsx         # Root app assembly
│       │       │   ├── routes.ts       # React Router route definitions
│       │       │   ├── store/          # Global app store
│       │       │   ├── components/     # Shared UI and layout components
│       │       │   └── hooks/          # Custom hooks
│       │       └── mock-api/           # Mock transport handlers
│       └── src/lestudio/               # Python FastAPI backend
│           ├── cli.py                  # CLI entrypoint
│           ├── server.py               # App factory + router assembly
│           ├── routes/                 # API route modules
│           ├── services/               # Dataset/process services
│           ├── process_manager.py      # subprocess lifecycle management
│           ├── command_builders.py     # CLI command builders
│           ├── teleop_bridge.py        # LeRobot teleop wrapper (lerobot import boundary)
│           ├── record_bridge.py        # LeRobot record wrapper (lerobot import boundary)
│           ├── camera_patch.py         # OpenCVCamera SHM patch (lerobot import boundary)
│           └── static/                 # Built frontend (npm run build output)
├── tests/                              # Backend pytest tests (both packages)
├── pyproject.toml                      # Shared tool config (pytest, ruff, mypy, pyright)
└── Makefile                            # install / dev / test / build-frontend
```

`lestudio` depends on `lerobot-doctor`; the dependency never points the other way. `make dev` installs both packages editable.

## Critical Constraints

### LeRobot Import Boundary

`lerobot.*` imports are **only** allowed in these five files:

- `packages/lestudio/src/lestudio/teleop_bridge.py`
- `packages/lestudio/src/lestudio/record_bridge.py`
- `packages/lestudio/src/lestudio/camera_patch.py`
- `packages/lerobot-doctor/src/lerobot_doctor/device_registry.py`
- `packages/lerobot-doctor/src/lerobot_doctor/motor_monitor_bridge.py`

Do **not** add `from lerobot.*` anywhere else. These five files are the adapter boundary for future multi-robot support.

### Frontend Rules

- **State management**: shared app store in `packages/lestudio/frontend/src/app/store/index.ts` — avoid uncontrolled local-state sprawl
- **Styling**: Match the existing utility-class and shared-component patterns in `packages/lestudio/frontend/src/app/components/`
- **Types**: Minimize `any`; define proper interfaces/types close to the feature or in shared contracts
- **Build output**: `packages/lestudio/frontend/` → `packages/lestudio/src/lestudio/static/` via `npm run build`

## Running Tests

**Backend:**

```bash
conda activate lerobot
python -m ruff check packages
python -m mypy packages/lerobot-doctor/src/lerobot_doctor packages/lestudio/src/lestudio --ignore-missing-imports
make test
```

**Frontend:**

```bash
cd packages/lestudio/frontend
npm ci
npm run lint
npm test -- --run
npm run test:e2e
npm run build
```

**Hardware smoke tests** (requires physical devices):

```bash
make test-hw
```

## Adding a Feature

When wrapping a new `lerobot` capability:

1. Update or add a command builder in `command_builders.py`
2. Add or extend a route module under `packages/lestudio/src/lestudio/routes/`, then include it from `server.py`
3. Create or update the page component under `packages/lestudio/frontend/src/app/pages/`
4. Add custom hooks in `packages/lestudio/frontend/src/app/hooks/` if needed
5. Verify WebSocket log streaming works end-to-end

## Code Quality

- No `as any`, `@ts-ignore`, or `@ts-expect-error` in TypeScript
- No empty `catch` blocks
- Run `lsp_diagnostics` (or `tsc --noEmit`) before submitting a PR
- Match existing patterns — check nearby files before introducing a new paradigm

## Related Docs

- [Architecture](architecture.md) for the high-level system view
- [API and Streaming](api-and-streaming.md) for transport behavior
- Repository internal docs in `docs/` for deeper implementation notes
