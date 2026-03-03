# Frontend-Backend Parity Matrix (2026-03-02)

## Scope

- Compare backend route surface in `src/lestudio/routes/` against:
  - current UI: `frontend/src/app`
  - legacy UI: `frontend_legacy/src`
- Status labels:
  - `integrated`: used by current frontend
  - `partial`: current uses related flow but misses legacy-covered endpoint(s)
  - `missing`: used by legacy but not wired in current frontend

## High-Impact Parity Matrix

| Endpoint | Backend Evidence | Current Frontend Evidence | Legacy Frontend Evidence | Status | Note |
|---|---|---|---|---|---|
| `GET /api/train/preflight` | `src/lestudio/routes/training.py:126` | `frontend/src/app/pages/Training.tsx:239`, `frontend/src/app/pages/Evaluation.tsx:171` | `frontend_legacy/src/tabs/TrainTab.tsx:242`, `frontend_legacy/src/tabs/EvalTab.tsx:56` | integrated | Train/Eval preflight wired in both UIs. |
| `POST /api/train/install_pytorch` | `src/lestudio/routes/training.py:199` | `frontend/src/app/pages/Training.tsx:315` | `frontend_legacy/src/tabs/TrainTab.tsx:260` | integrated | One-click install path preserved. |
| `POST /api/train/install_torchcodec_fix` | `src/lestudio/routes/training.py:220` | `frontend/src/app/pages/Evaluation.tsx:205` | `frontend_legacy/src/tabs/TrainTab.tsx:280`, `frontend_legacy/src/tabs/EvalTab.tsx:85` | partial | Current uses it in Eval, but Train-side recovery flow parity is missing. |
| `POST /api/train/colab/config` | `src/lestudio/routes/training.py:302` | 없음 | `frontend_legacy/src/tabs/TrainTab.tsx:559` | missing | Legacy Colab config/upload helper not ported. |
| `GET /api/train/colab/link` | `src/lestudio/routes/training.py:379` | 없음 | `frontend_legacy/src/tabs/TrainTab.tsx:581` | missing | Legacy Colab launch-link retrieval not ported. |
| `GET /api/datasets` | `src/lestudio/routes/dataset/listing.py:27` | `frontend/src/app/pages/DatasetManagement.tsx:963`, `frontend/src/app/pages/Training.tsx:335` | `frontend_legacy/src/tabs/DatasetTab.tsx:100` | integrated | Dataset listing is present. |
| `GET /api/datasets/{user}/{repo}` | `src/lestudio/routes/dataset/listing.py:75` | `frontend/src/app/pages/DatasetManagement.tsx:952` | `frontend_legacy/src/tabs/DatasetTab.tsx:159` | integrated | Detail fetch parity preserved. |
| `DELETE /api/datasets/{user}/{repo}` | `src/lestudio/routes/dataset/listing.py:182` | `frontend/src/app/pages/DatasetManagement.tsx:952` | `frontend_legacy/src/tabs/DatasetTab.tsx:368` | integrated | Delete flow preserved. |
| `GET /api/datasets/{user}/{repo}/quality` | `src/lestudio/routes/dataset/listing.py:193` | 없음 | `frontend_legacy/src/tabs/DatasetTab.tsx:421` | missing | Quality panel/regression checks not ported. |
| `POST /api/datasets/{user}/{repo}/push` | `src/lestudio/routes/dataset/hub.py:50` | 없음 | `frontend_legacy/src/tabs/DatasetTab.tsx:396` | missing | Hub push start missing in current Dataset page. |
| `GET /api/datasets/push/status/{job_id}` | `src/lestudio/routes/dataset/hub.py:167` | 없음 | `frontend_legacy/src/tabs/DatasetTab.tsx:122` | missing | Push progress polling missing. |
| `GET /api/datasets/{user}/{repo}/stats` | `src/lestudio/routes/dataset/curation.py:350` | 없음 | `frontend_legacy/src/components/dataset/DatasetAutoFlagPanel.tsx:104` | missing | Auto-flag stats viewer not ported. |
| `POST /api/datasets/{user}/{repo}/stats/recompute` | `src/lestudio/routes/dataset/curation.py:390` | 없음 | `frontend_legacy/src/components/dataset/DatasetAutoFlagPanel.tsx:130` | missing | Recompute trigger missing. |
| `GET /api/datasets/stats/status/{job_id}` | `src/lestudio/routes/dataset/curation.py:508` | 없음 | `frontend_legacy/src/components/dataset/DatasetAutoFlagPanel.tsx:160` | missing | Stats async polling missing. |
| `POST /api/datasets/stats/cancel/{job_id}` | `src/lestudio/routes/dataset/curation.py:518` | 없음 | `frontend_legacy/src/components/dataset/DatasetAutoFlagPanel.tsx:201` | missing | Stats cancel path missing. |
| `POST /api/datasets/{user}/{repo}/derive` | `src/lestudio/routes/dataset/curation.py:542` | 없음 | `frontend_legacy/src/components/dataset/DatasetCurationPanel.tsx:124` | missing | Derived dataset creation flow missing. |
| `GET /api/datasets/derive/status/{job_id}` | `src/lestudio/routes/dataset/curation.py:728` | 없음 | `frontend_legacy/src/components/dataset/DatasetCurationPanel.tsx:90` | missing | Derive job polling missing. |
| `POST /api/datasets/derive/cancel/{job_id}` | `src/lestudio/routes/dataset/curation.py:738` | 없음 | `frontend_legacy/src/components/dataset/DatasetCurationPanel.tsx:189` | missing | Derive cancel missing. |
| `POST /api/datasets/{user}/{repo}/tags/bulk` | `src/lestudio/routes/dataset/curation.py:306` | 없음 | `frontend_legacy/src/components/dataset/DatasetAutoFlagPanel.tsx:265` | missing | Bulk-tagging helper missing. |
| `GET /api/hub/datasets/search` | `src/lestudio/routes/dataset/hub.py:357` | `frontend/src/app/services/contracts.ts:380` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:185` | integrated | Hub search wired via shared contract helper. |
| `POST /api/hub/datasets/download` | `src/lestudio/routes/dataset/hub.py:386` | `frontend/src/app/pages/DatasetManagement.tsx:126` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:222` | integrated | Hub download start preserved. |
| `GET /api/hub/datasets/download/status/{job_id}` | `src/lestudio/routes/dataset/hub.py:489` | `frontend/src/app/pages/DatasetManagement.tsx:153` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:247` | integrated | Download polling preserved. |
| `GET /api/hf/token/status` | `src/lestudio/routes/dataset/hub.py:179` | `frontend/src/app/hf-auth-context.tsx:33` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:106` | integrated | HF auth status preserved. |
| `POST /api/hf/token` | `src/lestudio/routes/dataset/hub.py:190` | `frontend/src/app/components/layout/AppShell.tsx:933` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:135` | integrated | Token set preserved. |
| `DELETE /api/hf/token` | `src/lestudio/routes/dataset/hub.py:210` | `frontend/src/app/components/layout/AppShell.tsx:901` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:159` | integrated | Token delete preserved. |
| `GET /api/hf/whoami` | `src/lestudio/routes/dataset/hub.py:222` | `frontend/src/app/hf-auth-context.tsx:32` | `frontend_legacy/src/components/dataset/HubSearchCard.tsx:144` | integrated | Identity check preserved. |
| `GET /api/rules/current` | `src/lestudio/routes/udev.py:37` | `frontend/src/app/pages/CameraSetup.tsx:120`, `frontend/src/app/pages/MotorSetup.tsx:302` | `frontend_legacy/src/tabs/DeviceSetupTab.tsx:360` | integrated | Rules current in use. |
| `GET /api/rules/status` | `src/lestudio/routes/udev.py:41` | `frontend/src/app/pages/CameraSetup.tsx:121` | `frontend_legacy/src/tabs/DeviceSetupTab.tsx:205` | integrated | Rules status preserved. |
| `GET /api/udev/rules` | `src/lestudio/routes/udev.py:33` | 없음 | `frontend_legacy/src/tabs/DeviceSetupTab.tsx:209` | partial | Current relies on `/api/rules/current` and omits readable-rules endpoint usage. |
| `POST /api/rules/apply` | `src/lestudio/routes/udev.py:82` | `frontend/src/app/pages/CameraSetup.tsx:159`, `frontend/src/app/pages/MotorSetup.tsx:575` | `frontend_legacy/src/tabs/DeviceSetupTab.tsx:229` | integrated | Apply flow preserved. |
| `GET /ws` | `src/lestudio/routes/streaming.py:223` | `frontend/src/app/services/apiClient.ts:236` | `frontend_legacy/src/hooks/useWebSocket.ts` | integrated | Log streaming path preserved. |

## Additional Notes

- Motor monitor endpoints are mounted with prefix `/api/motor` via `APIRouter(prefix="/api/motor")` in `src/lestudio/routes/motor.py:25`, and current frontend uses that full path (e.g. `frontend/src/app/pages/MotorSetup.tsx:390`).
- This matrix is parity-focused (legacy-relevant high-impact routes), not a full 83-route exhaustiveness sheet.

## Recommended Execution Order

1. Training parity: add `/api/train/colab/config`, `/api/train/colab/link`, and Train-side torchcodec recovery in `frontend/src/app/pages/Training.tsx`.
2. Dataset parity: port push/quality/stats/derive/bulk-tag flows into `frontend/src/app/pages/DatasetManagement.tsx`.
3. Device parity decision: either reintroduce `/api/udev/rules` readable view in `frontend/src/app/pages/CameraSetup.tsx` (or explicitly deprecate with backend cleanup).
