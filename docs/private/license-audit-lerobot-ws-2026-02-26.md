# lerobot_ws OSS license audit (2026-02-26)

This note summarizes license signals for top-level repositories under `lerobot_ws` to support safe code reference and reuse.

## Scope and method

- Scope: direct children of `/home/jinhyuk2me/dev_ws/lerobot_ws`
- Local evidence: top-level `LICENSE*`, `NOTICE*`, `COPYING*`, plus README license sections
- Remote cross-check: GitHub repository metadata (`/repos/{owner}/{repo}`) for repos without local license files
- Important: this is an engineering compliance checklist, not legal advice

## Repository classification

| Repository | Local license evidence | Detected license | Copying status | Required actions before reuse |
|---|---|---|---|---|
| `bambot` | `bambot/LICENSE` | Apache-2.0 | Allowed with conditions | Keep copyright/license text; include attribution; carry NOTICE if any upstream NOTICE exists |
| `lerobot-data-studio` | `lerobot-data-studio/LICENSE` | MIT | Allowed with conditions | Keep copyright/license text |
| `lerobot-dataset-visualizer` | `lerobot-dataset-visualizer/LICENSE` | Apache-2.0 | Allowed with conditions | Keep copyright/license text; include attribution; carry NOTICE if present |
| `lerobot-studio` | `lerobot-studio/LICENSE` | Apache-2.0 | Allowed with conditions | Keep copyright/license text; include attribution; carry NOTICE if present |
| `lerobot` | `lerobot/LICENSE` | Apache-2.0 | Allowed with conditions | Keep copyright/license text; include attribution; carry NOTICE if present |
| `LeStudio` | `LeStudio/LICENSE` | Apache-2.0 | Allowed with conditions | Keep copyright/license text; include attribution; carry NOTICE if present |
| `phosphobot` | `phosphobot/LICENSE` | MIT | Allowed with conditions | Keep copyright/license text |
| `Any4LeRobotGUI` | No local `LICENSE*`; README says MIT (`Any4LeRobotGUI/README.md`) | Unknown in local tree (`license: null` in GitHub metadata) | Hold (do not verbatim copy yet) | Obtain explicit license file/commit from upstream first |
| `leLab` | No local `LICENSE*`; README says MIT (`leLab/README.md`) | Unknown in local tree (`license: null` in GitHub metadata) | Hold (do not verbatim copy yet) | Obtain explicit license file/commit from upstream first |
| `lerobot-annotate` | No local `LICENSE*`; no README license section | Unknown (`license: null` in GitHub metadata) | Hold (do not verbatim copy) | Treat as all-rights-reserved until explicit license appears |
| `robot-web` | No local `LICENSE*`; no README license section | Unknown (`license: null` in GitHub metadata) | Hold (do not verbatim copy) | Treat as all-rights-reserved until explicit license appears |

## NOTICE/COPYING check

- No top-level `NOTICE*`/`COPYING*` files were found in the audited repos.
- If you copy from Apache-licensed repos, still check per-file headers and subdirectories for additional notice requirements.

## Submodule caveats (not fully auditable in current checkout)

- `Any4LeRobotGUI/.gitmodules` points to submodule `backend` (`https://github.com/Tavish9/any4lerobot.git`), but the submodule directory is empty in this checkout.
- `phosphobot/.gitmodules` references `docs` and `bullet3`, but both directories are empty in this checkout.
- Action: initialize submodules and audit their licenses separately before copying from those paths.

## Practical reuse policy for this workspace

1. Prefer "reference then re-implement" over verbatim copy.
2. Verbatim copy is allowed only when the source has an explicit permissive license (MIT/Apache-2.0 in this audit) and obligations are carried over.
3. For unknown/unlicensed sources, only use ideas/architecture; do not copy code text.
4. Track provenance in your repo (for example, `THIRD_PARTY_NOTICES.md` with source URL, commit, file path, license).

## Suggested next step

Create a small allowlist for day-to-day coding:

- `ALLOW_WITH_ATTRIBUTION`: `bambot`, `lerobot-data-studio`, `lerobot-dataset-visualizer`, `lerobot-studio`, `lerobot`, `LeStudio`, `phosphobot`
- `HOLD_UNTIL_LICENSE_CLARIFIED`: `Any4LeRobotGUI`, `leLab`, `lerobot-annotate`, `robot-web`
