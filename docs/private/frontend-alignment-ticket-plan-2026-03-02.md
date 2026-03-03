# Frontend-Backend Alignment Ticket Plan (2026-03-02)

## Goal

`frontend/`를 `frontend_legacy/` 및 현재 FastAPI 백엔드 계약과 정합되게 맞춘다.

## Evidence Baseline

- Backend routes: `src/lestudio/routes/process.py`, `src/lestudio/routes/motor.py`, `src/lestudio/routes/config.py`, `src/lestudio/routes/udev.py`, `src/lestudio/routes/dataset/hub.py`, `src/lestudio/routes/streaming.py`
- New frontend pages/services: `frontend/src/app/pages/*.tsx`, `frontend/src/app/services/*`
- Legacy reference: `frontend_legacy/src/tabs/*.tsx`, `frontend_legacy/src/components/**/*.tsx`, `frontend_legacy/src/hooks/*.ts`

## Tickets

### LS-FE-001 (P0) Motor Setup 실API 연결

- Problem
  - 신규 `MotorSetup`가 목 데이터 기반이며 백엔드 `/api/motor/*`를 호출하지 않는다.
  - `frontend/src/app/pages/MotorSetup.tsx`에서 `/api/` 호출 없음.
- Backend contract
  - `POST /api/motor/connect` (`src/lestudio/routes/motor.py:30`)
  - `GET /api/motor/positions` (`src/lestudio/routes/motor.py:58`)
  - `POST /api/motor/{motor_id}/move` (`src/lestudio/routes/motor.py:69`)
  - `POST /api/motor/torque_off` (`src/lestudio/routes/motor.py:84`)
  - `POST /api/motor/freewheel/enter` (`src/lestudio/routes/motor.py:104`)
  - `POST /api/motor/freewheel/exit` (`src/lestudio/routes/motor.py:112`)
  - `POST /api/motor/disconnect` (`src/lestudio/routes/motor.py:122`)
- Legacy reference
  - `frontend_legacy/src/tabs/MotorSetupTab.tsx:83`, `frontend_legacy/src/tabs/MotorSetupTab.tsx:119`, `frontend_legacy/src/tabs/MotorSetupTab.tsx:185`
- Scope
  - `frontend/src/app/pages/MotorSetup.tsx`
  - `frontend/src/app/services/contracts.ts` (필요시 motor request/response 타입 추가)
- Acceptance criteria
  - 연결/해제/포지션 조회/개별 모터 이동/프리휠/토크 오프가 실제 백엔드 호출로 동작.
  - 프로세스/토스트/오류 메시지가 기존 패턴(`apiClient`, store toast)에 맞게 반영.
- Verification
  - `npm run build` (frontend)
  - 수동 API 플로우: connect -> positions -> move -> freewheel enter/exit -> torque_off -> disconnect

### LS-FE-002 (P0) Calibration API 복구

- Problem
  - `Calibration.tsx`는 존재하지만 실 API 호출 없이 목 데이터 기반.
  - 또한 라우트에 노출되지 않은 dead page 상태.
- Backend contract
  - `GET /api/calibrate/file` (`src/lestudio/routes/process.py:241`)
  - `GET /api/calibrate/list` (`src/lestudio/routes/process.py:258`)
  - `DELETE /api/calibrate/file` (`src/lestudio/routes/process.py:287`)
  - `POST /api/calibrate/start` (`src/lestudio/routes/process.py:304`)
- Legacy reference
  - `frontend_legacy/src/tabs/CalibrateTab.tsx:389`, `frontend_legacy/src/tabs/CalibrateTab.tsx:400`, `frontend_legacy/src/tabs/CalibrateTab.tsx:488`
- Scope
  - 선택 A: `MotorSetup.tsx` 내부 캘리브레이션 블록에 API를 붙이고 `Calibration.tsx` 제거
  - 선택 B: `routes.ts`에 `/calibration` 라우트 복구 후 `Calibration.tsx`를 실API 연결
- Acceptance criteria
  - 캘리브레이션 시작, 파일 리스트 조회, 파일 존재/삭제가 실제 백엔드와 동기화.
  - dead route/page 잔재가 남지 않음.
- Verification
  - `npm run build`
  - 수동 플로우: list -> start -> file check -> delete

### LS-FE-003 (P0) 잘못된 내부 링크 수정

- Problem
  - Dataset 화면에서 `to="/record"` 링크가 실제 라우트 `recording`과 불일치.
- Evidence
  - `frontend/src/app/pages/DatasetManagement.tsx:754`
  - `frontend/src/app/routes.ts:21`
- Scope
  - `frontend/src/app/pages/DatasetManagement.tsx`
- Acceptance criteria
  - 링크 클릭 시 Recording 페이지(`/recording`)로 정상 이동.
- Verification
  - `npm run build`
  - 수동 이동 확인

### LS-FE-004 (P1) Profiles UI/기능 복구

- Problem
  - 백엔드 profile API는 존재하나 신규 프론트에서 사용하지 않음.
- Backend contract
  - `GET /api/profiles` (`src/lestudio/routes/config.py:37`)
  - `GET/POST/DELETE /api/profiles/{name}` (`src/lestudio/routes/config.py:49`, `src/lestudio/routes/config.py:58`, `src/lestudio/routes/config.py:67`)
  - `POST /api/profiles-import` (`src/lestudio/routes/config.py:80`)
- Legacy reference
  - `frontend_legacy/src/components/shared/ProfileSelector.tsx:28`
- Scope
  - `frontend/src/app/components/layout/AppShell.tsx` 또는 shared 컴포넌트에 Profile selector 도입
  - `frontend/src/app/services/contracts.ts` profile response 파서 추가
- Acceptance criteria
  - profile 저장/불러오기/삭제/import 동작.
- Verification
  - `npm run build`
  - 수동 플로우: save -> load -> import -> delete

### LS-FE-005 (P1) Hub Download Job 연동

- Problem
  - 신규 Dataset Hub UI는 검색은 실제 API이나 download는 시뮬레이션 진행률만 사용.
- Evidence
  - 시뮬레이션 코드: `frontend/src/app/pages/DatasetManagement.tsx:58`
  - 백엔드: `POST /api/hub/datasets/download` (`src/lestudio/routes/dataset/hub.py:287`)
  - 백엔드: `GET /api/hub/datasets/download/status/{job_id}` (`src/lestudio/routes/dataset/hub.py:390`)
- Legacy reference
  - `frontend_legacy/src/components/dataset/HubSearchCard.tsx:222`
- Scope
  - `frontend/src/app/pages/DatasetManagement.tsx`
  - `frontend/src/app/services/contracts.ts`
- Acceptance criteria
  - Download 버튼이 실제 job 생성 후 상태 polling으로 진행률/완료 상태 표시.
- Verification
  - `npm run build`
  - 수동 플로우: search -> download start -> status poll -> complete

### LS-FE-006 (P1) Udev 상태 진단 가시성 강화

- Problem
  - 신규 CameraSetup은 `/api/rules/current` 중심이고 `/api/rules/status`, `/api/udev/rules`, `/api/rules/verify`를 활용하지 않아 진단 정보가 약함.
- Evidence
  - 신규: `frontend/src/app/pages/CameraSetup.tsx:79`, `frontend/src/app/pages/CameraSetup.tsx:114`
  - 레거시: `frontend_legacy/src/tabs/DeviceSetupTab.tsx:205`, `frontend_legacy/src/tabs/DeviceSetupTab.tsx:209`
  - 백엔드: `src/lestudio/routes/udev.py:33`, `src/lestudio/routes/udev.py:41`, `src/lestudio/routes/udev.py:97`
- Scope
  - `frontend/src/app/pages/CameraSetup.tsx`
- Acceptance criteria
  - rules status/verify 결과를 UI에서 확인 가능하고 apply 실패 원인 표시 강화.
- Verification
  - `npm run build`
  - 수동 플로우: status 확인 -> apply -> verify

### LS-FE-007 (P2) Process 상태 복구 경로 보강

- Problem
  - 신규 프론트는 WS 기반 상태 반영 비중이 높아 새로고침/재접속 시 상태 복구가 약해질 수 있음.
- Backend contract
  - `GET /api/process/{name}/status` (`src/lestudio/routes/process.py:45`)
- Scope
  - `frontend/src/app/services/bootstrap.ts` 또는 AppShell 초기화에 process status hydration 추가
- Acceptance criteria
  - 초기 로드시 각 process 상태가 백엔드와 동기화된 값으로 반영.
- Verification
  - `npm run build`
  - 수동 플로우: process 실행 중 새로고침 -> 상태 유지 확인

### LS-FE-008 (P2) 계약 동기화 가드레일 구축

- Problem
  - 수동 계약 매핑만으로는 재발 가능성이 높음.
- Scope
  - OpenAPI 기반 TypeScript client 생성(또는 최소한 schema diff CI)
  - WS 메시지 타입을 discriminated union으로 고정
  - 핵심 endpoint smoke test 추가(teleop/record/train/eval/dataset/hub)
- Acceptance criteria
  - PR 단계에서 계약 깨짐이 자동 감지됨.
- Verification
  - CI에서 타입 생성/검증 및 smoke test 통과

## Execution Order

1. LS-FE-003 (빠른 링크 오류 수정)
2. LS-FE-001, LS-FE-002 (실제 운영 기능 복구)
3. LS-FE-005, LS-FE-004, LS-FE-006 (데이터/운영 기능 회복)
4. LS-FE-007, LS-FE-008 (안정화/재발 방지)

## Recommended Validation Gate Per Ticket

- `cd frontend && npm run build`
- 변경 endpoint에 대한 수동 시나리오 확인
- 가능하면 backend 실행 상태에서 WS/REST 동작 확인
