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

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, please send a private message to the maintainers or use GitHub's private vulnerability reporting feature on the repository. We aim to respond within 48 hours.

Please include:
- A description of the vulnerability.
- Steps to reproduce it.
- Possible impacts if the vulnerability is exploited.

We appreciate your effort in keeping LeStudio safe for the robotics community!
