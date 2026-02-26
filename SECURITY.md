# Security Policy

## Supported Versions

Currently, LeStudio is in rapid development. We provide security updates only for the **`main`** branch (latest commit).

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| Older   | :x:                |

## Network Exposure & Token Authentication

By default, LeStudio binds to `127.0.0.1` (localhost). In this mode, no authentication is required.

If you expose LeStudio to a network using `--host 0.0.0.0`, the server automatically requires a **session token** for sensitive endpoints (process execution, dataset manipulation, etc.).
- The token is generated at startup and printed to the server console.
- Alternatively, you can lock the token using the `LESTUDIO_TOKEN` environment variable.

**⚠️ WARNING:** LeStudio executes Python subprocesses and reads hardware devices (`/dev/video*`, `/dev/tty*`). Do **not** expose LeStudio directly to the public internet (e.g., via port-forwarding without a VPN or reverse proxy). Treat it as an internal lab tool.

## Operational Security Baseline (OSS Release)

Before exposing LeStudio to teammates or lab networks:

1. Keep server binding local by default (`127.0.0.1`) unless remote access is required.
2. If remote access is required, enforce token auth and network controls (VPN/reverse proxy/firewall).
3. Run the CI-equivalent checks before release:
   - `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -m "not smoke_hw" tests`
   - `cd frontend && npm run lint && npm test -- --run && npm run build`
4. Keep hardware tests separate from CI using `smoke_hw` marker tests.

## Known Security Limitations

1. LeStudio is designed for trusted lab environments, not direct internet exposure.
2. Commands are executed as local subprocesses; host-level hardening remains the operator's responsibility.
3. Hardware device access relies on Linux device permissions and local system policy configuration.

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, please send a private message to the maintainers or use GitHub's private vulnerability reporting feature on the repository. We aim to respond within 48 hours.

Please include:
- A description of the vulnerability.
- Steps to reproduce it.
- Possible impacts if the vulnerability is exploited.

We appreciate your effort in keeping LeStudio safe for the robotics community!
