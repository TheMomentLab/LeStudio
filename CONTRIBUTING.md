# Contributing to LeStudio

LeStudio is a web GUI orchestrator for Hugging Face LeRobot workflows.
This guide defines the minimum engineering bar for pull requests.

## Local Setup

```bash
git clone https://github.com/TheMomentLab/lestudio.git
cd lestudio
conda create -n lerobot python=3.12 -y
conda activate lerobot
make dev
cd packages/lestudio/frontend && npm ci && cd ..
```

The repository is a monorepo with two Python packages under `packages/`:

- `packages/lerobot-doctor` — hardware layer library (device discovery, udev/type/path policy, motor and calibration bridges). No server or CLI yet.
- `packages/lestudio` — the workbench: FastAPI backend under `src/lestudio/` and the React frontend under `frontend/`. Depends on `lerobot-doctor`.

Shared tool configuration (pytest, ruff, mypy, pyright) lives in the root `pyproject.toml`; `tests/` covers both packages.

Upstream `lerobot` is a pip dependency of `lestudio` (`>=0.4.4,<0.7`), not a submodule. CI runs the backend on Python 3.10 (resolves lerobot 0.4.x) and 3.12 (resolves the latest 0.6.x) so upstream drift fails the build instead of surfacing on a user's machine.

Use `make install` only if you want the runtime packages without contributor tooling. `make dev` installs both packages editable plus the dev extras used by CI (`ruff`, `mypy`, pytest helpers).

## Development Run

Backend:

```bash
conda activate lerobot
lestudio serve --port 8000 --no-browser
```

Frontend:

```bash
cd packages/lestudio/frontend
npm run dev
```

Restart guidance (what to restart after frontend/backend changes):

- See `docs/operations/dev-restart-guide.md`

## Non-Negotiable Architecture Rule

Do not import `lerobot.*` outside these 5 adapter files:

1. `packages/lestudio/src/lestudio/teleop_bridge.py`
2. `packages/lestudio/src/lestudio/record_bridge.py`
3. `packages/lestudio/src/lestudio/camera_patch.py`
4. `packages/lerobot-doctor/src/lerobot_doctor/device_registry.py`
5. `packages/lerobot-doctor/src/lerobot_doctor/motor_monitor_bridge.py`

All other backend code must stay decoupled and run LeRobot through subprocess orchestration.

A few files reference `lerobot` **indirectly** via subprocess spawning or `importlib.import_module()`.
These are intentional and acceptable because they create runtime coupling only, not compile-time imports:

- `packages/lestudio/src/lestudio/command_builders.py` — Builds subprocess command strings containing `lerobot` script paths
- `packages/lerobot-doctor/src/lerobot_doctor/calibrate_bridge.py` — Uses `importlib.import_module()` for dynamic robot-type resolution
- `packages/lestudio/src/lestudio/eval_bridge.py` — Uses `importlib.import_module()` to register robot / teleoperator families, then delegates to `lerobot_eval`
- `packages/lerobot-doctor/src/lerobot_doctor/motor_setup_bridge.py` — Spawns `lerobot_setup_motors` as a subprocess

The CI boundary check (`rg` + `grep` in `ci.yml`) enforces the compile-time import rule.
Subprocess and dynamic-import patterns are outside its scope by design.

## Required Checks Before PR

Backend:

```bash
python3 -m ruff check packages
python3 -m mypy packages/lerobot-doctor/src/lerobot_doctor packages/lestudio/src/lestudio --ignore-missing-imports
python3 -m compileall -q packages/lerobot-doctor/src/lerobot_doctor packages/lestudio/src/lestudio
make test
```

Frontend:

```bash
cd packages/lestudio/frontend
npm ci
npm run lint
npm test -- --run
npm run test:e2e
npm run build
```

Hardware smoke checks (optional, real devices only):

```bash
make test-hw
```

## Test Scope Expectations

1. Backend route/process logic changes must include regression tests in `tests/`.
2. Frontend state or tab behavior changes must pass `npm run lint`, `npm test -- --run`, `npm run test:e2e`, and `npm run build`.
3. Hardware-dependent validation belongs in `tests/smoke_hw` with `@pytest.mark.smoke_hw`.

## Pull Request Expectations

1. Explain behavioral impact and risks clearly.
2. Include validation commands and outcomes in the PR description.
3. Keep commits focused and reviewable.
4. Follow the release gate in [CHANGELOG.md](CHANGELOG.md) for release-facing changes.
5. If user-visible functionality or top-level product messaging changes, update `docs_public/feature-spec.md`, `README.md`, and `README.ko.md` in the same PR.

## Security Reporting

Do not post vulnerabilities in public issues.
Use GitHub private vulnerability reporting or contact maintainers privately.
