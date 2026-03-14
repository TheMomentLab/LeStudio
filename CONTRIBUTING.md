# Contributing to LeStudio

LeStudio is a web GUI orchestrator for Hugging Face LeRobot workflows.
This guide defines the minimum engineering bar for pull requests.

## Local Setup

```bash
git clone --recursive https://github.com/TheMomentLab/lestudio.git
cd lestudio
conda create -n lerobot python=3.10 -y
conda activate lerobot
make install
cd frontend && npm ci && cd ..
```

## Development Run

Backend:

```bash
conda activate lerobot
lestudio serve --port 8000 --no-browser
```

Frontend:

```bash
cd frontend
npm run dev
```

Restart guidance (what to restart after frontend/backend changes):

- See `docs/operations/dev-restart-guide.md`

## Non-Negotiable Architecture Rule

Do not import `lerobot.*` outside these 5 adapter files:

1. `src/lestudio/teleop_bridge.py`
2. `src/lestudio/record_bridge.py`
3. `src/lestudio/camera_patch.py`
4. `src/lestudio/device_registry.py`
5. `src/lestudio/motor_monitor_bridge.py`

All other backend code must stay decoupled and run LeRobot through subprocess orchestration.

## Required Checks Before PR

Backend:

```bash
python3 -m ruff check src/lestudio
python3 -m mypy src/lestudio --ignore-missing-imports
python3 -m compileall -q src/lestudio
make test
```

Frontend:

```bash
cd frontend
npm ci
npx tsc --noEmit
npm run build
```

Hardware smoke checks (optional, real devices only):

```bash
make test-hw
```

## Test Scope Expectations

1. Backend route/process logic changes must include regression tests in `tests/`.
2. Frontend state or tab behavior changes must be validated with `npx tsc --noEmit` and `npm run build`; add automated tests when the repo gains frontend test coverage.
3. Hardware-dependent validation belongs in `tests/smoke_hw` with `@pytest.mark.smoke_hw`.

## Pull Request Expectations

1. Explain behavioral impact and risks clearly.
2. Include validation commands and outcomes in the PR description.
3. Keep commits focused and reviewable.
4. Follow the release gate in [CHANGELOG.md](CHANGELOG.md) for release-facing changes.
5. If user-visible functionality or top-level product messaging changes, update `docs/feature-spec.md`, `README.md`, and `README.ko.md` in the same PR.

## Security Reporting

Do not post vulnerabilities in public issues.
Use GitHub private vulnerability reporting or contact maintainers privately.
