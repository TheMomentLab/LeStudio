# LeStudio — 리팩토링 계획 (Refactoring Plan)

최종 갱신: 2026-02-28
상태: ✅ Phase A + B + C 완료
상위 문서: [`roadmap.md`](roadmap.md)

---

## 배경

6일간의 집중 개발로 기능적으로 완성된 9탭 워크벤치가 만들어졌다. 그러나 빠른 개발 속도의 대가로 일부 파일이 비대해지고 패턴이 반복되는 기술 부채가 발생했다. 이 문서는 코드 수준의 리팩토링 항목을 우선순위별로 정리하고, 다음 기능 개발 전에 처리할 범위를 명확히 한다.

---

## 코드베이스 현황 스냅샷

### 리팩토링 전 (2026-02-28 초기)

#### 백엔드 (Python)

| 파일 | 줄 수 (전) | 역할 |
|---|---|---|
| `routes/dataset.py` | 1549 | 데이터셋 CRUD, Hub push/download, 통계, 태그, 파생 |
| `routes/training.py` | 642 | 학습 preflight, 체크포인트, eval start, env-types |
| `device_registry.py` | 549 | LeRobot 3-Registry 탐색 |
| `command_builders.py` | 383 | CLI 커맨드 빌더 |
| `_train_helpers.py` | 328 | CUDA/torchcodec/의존성 preflight |
| `routes/process.py` | 324 | 프로세스 관리, preflight, teleop/record/calibrate |
| `process_manager.py` | 309 | subprocess 생명주기, stdout 파싱 |
| `_streaming.py` | 285 | MJPEG 카메라 스트리밍 |

#### 프론트엔드 (React/TypeScript)

| 파일 | 줄 수 (전) | useState 수 | 판정 |
|---|---|---|---|
| `tabs/DatasetTab.tsx` | 1393 | 32 | 🔴 분리 필수 |
| `tabs/EvalTab.tsx` | 1049 | 27 | 🔴 분리 필수 |
| `tabs/TrainTab.tsx` | 1008 | 16 | 🟡 주시 |
| `tabs/DeviceSetupTab.tsx` | 980 | — | 🟡 주시 |
| `tabs/CalibrateTab.tsx` | 913 | — | 🟡 주시 |
| `tabs/RecordTab.tsx` | 810 | — | 🟡 주시 |
| `components/shared/ConsoleDrawer.tsx` | 571 | — | 🟡 주시 |
| `index.css` | 3049 | — | 🟡 분리 권장 |
| `store/index.ts` | 140 | — | ✅ 적정 |

### 리팩토링 후 (현재)

#### 백엔드 (Python)

| 파일 | 줄 수 (후) | 비고 |
|---|---|---|
| `routes/dataset/listing.py` | 407 | R-01 분리 |
| `routes/dataset/curation.py` | 764 | R-01 분리 |
| `routes/dataset/hub.py` | 396 | R-01 분리 |
| `routes/_state.py` | 72 | R-08: DatasetJobState 캡슐화 |
| `routes/training.py` | 411 | R-02: train 전용 |
| `routes/eval.py` | 260 | R-02: eval 독립 분리 |
| `routes/process.py` | 332 | R-05: _guard_process_start 추출 |
| `process_manager.py` | 312 | R-04: _process_line 추출 |
| `server.py` | 162 | R-07: re-export 정리 |

#### 프론트엔드 (React/TypeScript)

| 파일 | 줄 수 (후) | 비고 |
|---|---|---|
| `tabs/DatasetTab.tsx` | 1003 | HubSearchCard + DatasetQualityPanel 추출 |
| `tabs/EvalTab.tsx` | 321 | R-03: hooks + components 전부 분리 |
| `components/dataset/HubSearchCard.tsx` | 517 | R-03 추출 |
| `components/dataset/DatasetQualityPanel.tsx` | 117 | R-03 추출 |
| `hooks/useEvalCheckpoint.ts` | 84 | R-03 추출 |
| `hooks/useEvalProgress.ts` | 351 | R-03 추출 |
| `components/eval/EvalConfigPanel.tsx` | 264 | R-03 추출 |
| `components/eval/EvalProgressPanel.tsx` | 125 | R-03 추출 |
| `index.css` | 5 | R-06: @import 조합만 |
| `styles/variables.css` | 73 | R-06 분리 |
| `styles/base.css` | 148 | R-06 분리 |
| `styles/layout.css` | 770 | R-06 분리 |
| `styles/tabs.css` | 1272 | R-06 분리 |
| `styles/components.css` | 1031 | R-06 분리 |

**테스트: 47/47 통과 (frontend vitest), 빌드: 성공**

---

## 🔴 P0 — 완료

### ✅ R-01: `routes/dataset.py` 분리 + DatasetJobState 추출

**결과**: 1549줄 단일 파일 → `listing.py` / `curation.py` / `hub.py` 3파일 분리. `_state.py`에 `DatasetJobState` dataclass 캡슐화 (R-08 동시 처리).

### ✅ R-02: `routes/training.py` → eval 분리

**결과**: `routes/eval.py` 260줄 독립 분리. `routes/training.py` 411줄 (train 전용). 기존 테스트 통과.

### ✅ R-03: EvalTab 상태/로직 추출

**결과**: 1049줄 → 321줄. 아래 4개 파일로 분리:
- `hooks/useEvalProgress.ts` (351줄) — 로그 파싱 + 진행률/보상/성공률 추적
- `hooks/useEvalCheckpoint.ts` (84줄) — 체크포인트 로딩 + env 메타데이터 추론
- `components/eval/EvalConfigPanel.tsx` (264줄) — 설정 패널
- `components/eval/EvalProgressPanel.tsx` (125줄) — 진행률 + 메트릭 표시

---

## 🟡 P1 — 완료

### ✅ R-04: ProcessManager._reader() 라인 처리 중복 제거

**결과**: `_process_line(name, text)` 메서드 추출. `process_manager.py` 312줄.

### ✅ R-05: 프로세스 시작 가드 패턴 추출

**결과**: `_guard_process_start(state, name)` 헬퍼 함수 추출. `routes/process.py`에서 모든 start 엔드포인트에 적용.

### ✅ R-06: CSS 파일 분리

**결과**: `index.css` 3049줄 → `styles/` 5개 파일 분리. `index.css`는 5줄 @import 조합으로 대체.

### ✅ R-07: server.py 역방향 호환 re-export 정리

**결과**: `server.py` 162줄. re-export 블록 없음. 외부 참조 없는 것 확인 후 제거 완료.

### ✅ R-08: AppState dataset-specific 필드 캡슐화

**결과**: `DatasetJobState` dataclass를 `routes/_state.py`에 분리. `AppState.dataset_jobs` 필드로 캡슐화. R-01과 동시 처리.

---

## 🟢 P2 — 코드 품질 — 완료

### ✅ R-09: `_streaming.py` 모듈 레벨 가변 상태 캐플화

**결과**: `StreamerManager` 클래스로 캐플화 완료 — 이미 `_streaming.py`에 존재. singleton `_default_manager` 생성.

### ✅ R-10: 인라인 import 정리

**결과**: `routes/streaming.py`, `routes/udev.py` 함수 내부 import 파일 상단으로 이동. `routes/process.py` 이미 정리됨 확인.

### ✅ R-11: 타입 안전성 강화

- `_extract_train_metric` 반환: `TrainMetric` TypedDict — 이미 `process_manager.py`에 존재 확인.
- route handler `data: dict` → Pydantic model: `routes/models.py` 신규 생성 (55줄). 6개 Request 모델 적용.
- `LeStudioConfig` 타입: `frontend/src/lib/types.ts`에 누락 필드 추가 + `as string` 캐스팅 109개 제거.

### ✅ R-12: 테스트 커버리지 확장

**결과**: `tests/test_dataset_config_routes.py` 신규 (170줄, 10개 테스트). 전체 백엔드 103/103 통과.
- 프론트엔드: 47개 vitest 통과.

---

## 실행 현황

```
Phase A (완료 ✅):
  R-04: ProcessManager._reader 중복 제거
  R-05: 프로세스 시작 가드 추출
  R-02: training.py → eval.py 분리
  R-07: server.py re-export 정리

Phase B (완료 ✅):
  R-01: dataset.py 분리
  R-08: AppState dataset 필드 캡슐화 (R-01과 동시)
  R-03: EvalTab 상태 추출 (hooks + components)
  R-06: CSS 분리

Phase C (완료 ✅):
  R-09: StreamerManager 캐플화 확인 (이미 완료 상태)
  R-10: 인라인 import 정리 (streaming.py, udev.py)
  R-11: Pydantic 모델 + TS 타입 강화
  R-12: 테스트 커버리지 확장 (103 백엔드 + 47 프론트엔드)

---

## 변경 영향 범위

| 리팩토링 | 백엔드 파일 | 프론트엔드 파일 | 테스트 영향 |
|---|---|---|---|
| R-01 ✅ | dataset.py → 3파일 + _state.py | 없음 | route path 동일 유지, 테스트 통과 |
| R-02 ✅ | training.py, eval.py (신규) | 없음 | route count assertion 변경 완료 |
| R-03 ✅ | 없음 | EvalTab.tsx → 4파일 | 프론트엔드 테스트 47/47 통과 |
| R-04 ✅ | process_manager.py | 없음 | 기존 테스트 통과 |
| R-05 ✅ | routes/process.py | 없음 | 기존 테스트 통과 |
| R-06 ✅ | 없음 | index.css → 5파일 | 없음 |
| R-07 ✅ | server.py | 없음 | import 경로 확인 완료 |
| R-08 ✅ | _state.py, dataset/ | 없음 | 기존 테스트 통과 |
| R-09 ✅ | 이미 완료 상태 확인 | 없음 | 없음 |
| R-10 ✅ | routes/streaming.py, udev.py | 없음 | 103/103 통과 |
| R-11 ✅ | routes/models.py (신규), process.py 등 | lib/types.ts 누락 필드 추가 | 103/103 통과, 47/47 통과 |
| R-12 ✅ | test_dataset_config_routes.py (신규 10개) | 없음 | 103/103 통과 |
