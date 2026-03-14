## Description
<!-- Describe your changes in detail -->
<!-- What problem does this solve? -->

## Related Issue
<!-- If this addresses an open issue, link it here: -->
<!-- Fixes #123 -->

## Motivation and Context
<!-- Why is this change required? -->

## How Has This Been Tested?
<!-- Please describe in detail how you tested your changes. -->
<!-- Include details of your testing environment, and the tests you ran -->
- [ ] Added new unit tests
- [ ] Passed `cd frontend && npx tsc --noEmit && npm run build`
- [ ] Passed `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -m "not smoke_hw" tests`
- [ ] Passed `python3 -m ruff check src/lestudio && python3 -m mypy src/lestudio --ignore-missing-imports && python3 -m compileall -q src/lestudio`
- [ ] Hardware-affected change validated with `smoke_hw` tests (or marked N/A)

## Architecture Compliance
- [ ] I have not imported `lerobot.*` anywhere outside of the 5 designated adapter files (`teleop_bridge.py`, `record_bridge.py`, `camera_patch.py`, `device_registry.py`, `motor_monitor_bridge.py`).
- [ ] I have maintained separation of concerns.

## Documentation Sync
- [ ] If user-visible functionality or product messaging changed, I updated `docs/feature-spec.md`, `README.md`, and `README.ko.md`.
- [ ] If contributor workflow or validation flow changed, I updated `CONTRIBUTING.md` and related checklists/templates.

## Screenshots (if appropriate):
