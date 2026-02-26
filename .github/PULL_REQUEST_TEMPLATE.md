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
- [ ] Passed `cd frontend && npm test -- --run`
- [ ] Passed `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -m "not smoke_hw" tests`
- [ ] Passed `cd frontend && npm run lint && npm run build`
- [ ] Hardware-affected change validated with `smoke_hw` tests (or marked N/A)

## Architecture Compliance
- [ ] I have not imported `lerobot.*` anywhere outside of the 4 designated adapter files (`teleop_bridge.py`, `record_bridge.py`, `camera_patch.py`, `device_registry.py`).
- [ ] I have maintained separation of concerns.

## Screenshots (if appropriate):
