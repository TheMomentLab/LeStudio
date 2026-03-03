# LeStudio Dataset 고도화 도입 계획

최종 갱신: 2026-02-28

## 1) 목적

`lerobot-data-studio`와 `lerobot-dataset-visualizer`의 핵심 가치를 LeStudio Dataset 탭에 최대한 흡수하되,
우리 아키텍처/코드 스타일을 유지한 재구현 방식으로 단계적으로 도입한다.

## 2) 원칙 (라이선스 + 아키텍처)

1. 코드 복사 대신 기능/동작을 참조한 재구현을 기본으로 한다.
2. 출처는 `THIRD_PARTY_NOTICES.md`에 기능 단위로 기록한다(저장소 URL, 참조 커밋, 참조 범위).
3. LeRobot 결합 경계 원칙(bridge + registry 4접점)은 유지한다. Dataset 기능은 `routes`/`command_builders`/`process_manager` 계층에서 처리한다.
4. 기존 UX 패턴(상태 배지, job polling, toast, preflight 성격의 가드)을 재사용한다.
5. 성능 우선: 대형 데이터셋은 전량 로드 금지, 페이지네이션/샘플링/지연 계산을 기본값으로 둔다.

## 3) 현재 기준선 (LeStudio)

이미 구현됨:

- 로컬 데이터셋 목록/상세/삭제
- 멀티 카메라 동기 재생 + 스크러빙
- 에피소드 태깅(`good`/`bad`/`review`) + 필터
- 품질 검사(메타/에피소드/비디오 무결성)
- HF Hub 검색/다운로드 + push job 추적

핵심 한계:

- 선택 에피소드 기반 "새 데이터셋 생성"(비파괴 편집) 없음
- 자동 플래깅(저움직임/jerky/outlier) 없음
- action/state 고급 분석 패널 없음
- URDF 3D 시각화 없음

## 4) 도입 대상 기능 매핑

| 기능군 | 참조 원천 | LeStudio 도입 방식 | 우선순위 |
|---|---|---|---|
| 선택 에피소드로 새 데이터셋 생성 | lerobot-data-studio | 서버 Job + 진행률 폴링 + "원본 보존" 워크플로우 | P0 |
| 다중 비디오 재생 UX 강화(단축키/탐색) | lerobot-data-studio | Dataset 전용 단축키 계층 추가 | P0 |
| 자동 필터링/플래그 + CLI export | lerobot-dataset-visualizer | Curation 섹션에 규칙 기반 분석 + 명령 생성 | P1 |
| Cross-episode Insights | lerobot-dataset-visualizer | 통계/분포/정렬 지표 패널 추가 | P2 |
| URDF 3D 포즈 뷰어 | lerobot-dataset-visualizer | 선택 관절 시계열 기반 3D 뷰 | P3 |

### 4.1) OSS 구현 방식 비교 매트릭스 (lerobot_ws 기준)

| 프로젝트 | 핵심 목적 | 편집/큐레이션 실행 방식 | 품질/필터 계산 방식 | 결과 반영 방식 |
|---|---|---|---|---|
| LeStudio | 통합 워크벤치 내 큐레이션/파생 생성 | FastAPI 백엔드에서 `subprocess`로 `lerobot_edit_dataset` 실행 + job polling | 서버에서 parquet 읽어 per-episode `movement`, `jerk_score` 계산(캐시 포함) | UI에서 태깅/필터 후 파생 dataset 생성 (`new_repo_id` 필수) |
| lerobot-data-studio | 선택 에피소드 기반 새 데이터셋 생성 | FastAPI `BackgroundTasks`에서 `delete_episodes(...)` in-process 호출 | 별도 jerk/movement 자동 플래그보다는 선택/검토 중심 | 백그라운드 작업 후 `push_to_hub()`로 새 dataset 업로드 |
| lerobot-dataset-visualizer | 대규모 dataset 시각화/분석 | 앱 내에서 delete 실행 대신, flagged episode로 CLI 명령 문자열 export | `low movement`, `jerky` 등 cross-episode 지표 계산(정규화 포함) | 사용자가 export된 `lerobot-edit-dataset` 명령을 외부에서 실행 |
| lerobot-annotate | 구간/태스크 라벨링 | delete 기반 큐레이션이 아니라 annotation export 중심 | episode timestamp 구간 기준으로 subtask/high-level task 인덱스 생성 | parquet에 `subtask_index`, `task_index_high_level` 컬럼 추가 |
| 공식 lerobot (`dataset_tools`/`lerobot_edit_dataset`) | 데이터셋 편집 primitive 제공 | `delete_episodes`, `split`, `merge`, `remove_feature` 등 연산 제공 | `compute_stats`는 quantile/mean/std 중심(품질 휴리스틱 미포함) | `new_repo_id` 없으면 원본 경로 기반 갱신 흐름 가능 |

비교 시 주의사항:

- 동일 기능명이라도 메트릭 정의가 다를 수 있다. 예: LeStudio의 `jerk_score`(2차 차분 기반)와 visualizer의 `jerky`(정규화된 mean `|Δa|`)는 서로 다른 지표다.
- `delete_episodes`는 공통 primitive지만, orchestration은 프로젝트마다 다르다(서브프로세스 실행 vs in-process 호출 vs CLI export).
- 본 문서의 "비파괴 파생" 원칙은 LeStudio UX 기준이며, 공식 CLI 자체는 옵션 조합에 따라 원본 경로 갱신 흐름도 가능하다.

## 5) 실행 단계

### Phase 0 (핵심 가치 즉시 확보)

목표: "데이터셋 정제 파이프라인"을 실사용 가능 상태로 만든다.

- Backend
  - `src/lestudio/command_builders.py`: `lerobot-edit-dataset` 명령 빌더 추가
  - `src/lestudio/routes/dataset.py`: 파생 데이터셋 생성 API 추가
    - `POST /api/datasets/{user}/{repo}/derive`
    - `GET /api/datasets/derive/status/{job_id}`
  - job state는 기존 push/download 패턴과 동일한 구조로 확장
- Frontend
  - `frontend/src/tabs/DatasetTab.tsx`: 대형 컴포넌트 분해(Overview/Replay/Curation)
  - Curation 패널에 "선택 에피소드 -> 새 데이터셋" 액션 추가
  - 생성 진행률 배지/바/로그 tail 표시
- DoD
  - 원본 데이터셋을 건드리지 않고 신규 repo_id 생성 가능
  - 실패 시 재시도 가능, 상태 표시 일관성 유지

### Phase 1 (자동 정제)

목표: 수동 태깅만으로 놓치던 이상 에피소드를 자동 탐지한다.

- Backend
  - 에피소드 통계 API 추가(길이, 움직임, jerk score)
  - 대용량 대비 샘플링/배치 계산 옵션 제공
- Frontend
  - Filtering 섹션 추가(임계값 슬라이더 + flagged list)
  - "flagged episodes 보기"와 "CLI 명령 복사" 버튼 제공
- DoD
  - 사용자가 자동 플래그를 검토 후 바로 삭제/파생 생성 흐름으로 연결 가능

### Phase 2 (Insights)

목표: 학습 전 데이터 품질을 정량적으로 판단할 수 있게 한다.

- 지표
  - action velocity 분포
  - episode length 분포
  - state-action alignment score
  - cross-episode variance
- 구현
  - 서버 계산 + 프론트 차트 패널
  - 데이터셋/카메라/조인트 필터 연동
- DoD
  - Insights 지표가 학습 실패 위험 탐지에 실제 도움(문서화된 해석 가이드 포함)

### Phase 3 (URDF 3D 뷰)

목표: 수치 기반 분석을 3D 동작 시각화와 연결한다.

- 로봇 프로파일별 URDF 로더
- 시간축 동기화 재생(비디오/차트/3D)
- 성능 옵션(해상도, 프레임 스킵, 간단 렌더 모드)

## 6) 파일/모듈 설계 가이드

### Frontend (권장 분해)

- `frontend/src/tabs/DatasetTab.tsx` (오케스트레이션)
- `frontend/src/components/dataset/DatasetOverviewPanel.tsx`
- `frontend/src/components/dataset/DatasetReplayPanel.tsx`
- `frontend/src/components/dataset/DatasetCurationPanel.tsx`
- `frontend/src/components/dataset/DatasetInsightsPanel.tsx`
- `frontend/src/components/dataset/DatasetUrdfPanel.tsx` (Phase 3)
- `frontend/src/hooks/useDatasetJobs.ts`

### Backend (권장 분해)

- `src/lestudio/routes/dataset.py` (API + job polling)
- `src/lestudio/command_builders.py` (edit/derive command 조립)
- 필요 시 `src/lestudio/process_manager.py`에 dataset job 공통 유틸 추가

## 7) 리스크와 대응

1. 대규모 parquet 처리 성능 저하
   - 대응: 샘플링/캐시/증분 계산, 타임아웃 및 진행률 노출
2. UI 복잡도 급상승
   - 대응: Dataset 탭을 섹션화하고 기본은 Guided(핵심만), Advanced에서 고급 패널 노출
3. 외부 참조 기능의 과도한 범위 확장
   - 대응: 각 Phase DoD 통과 전 다음 단계 착수 금지

## 8) 검증 계획

코드 반영마다 아래를 고정 실행:

- Backend: `python3 -m compileall -q src/lestudio`
- Backend test: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -m "not smoke_hw" tests`
- Frontend lint/build: `npm run lint`, `npm run build` (in `frontend/`)
- 수동 시나리오
  - 로컬 데이터셋 선택 -> 에피소드 필터/태깅
  - 파생 데이터셋 생성 -> 진행률 -> 완료 후 목록 반영
  - Hub push/download 기존 기능 회귀 확인

## 9) 운영 방식

- 작은 PR 단위로 단계적 도입(Phase 0를 2~3개 PR로 분해)
- 문서/코드 동기화 원칙: API 추가 시 Dataset 탭 UX와 같은 PR에서 연결
- 기능 플래그(`datasetV2`)로 초기 배포 후 기본값 점진 전환

## 10) 완료 기준 (프로젝트 관점)

- 사용자가 LeStudio 안에서 "탐색 -> 필터링 -> 정제 -> 파생 생성 -> Hub 업로드"를 끊김 없이 수행 가능
- 기존 Dataset 기능(검색/다운로드/재생/태깅/품질검사/push) 회귀 없음
- 대형 데이터셋에서도 UI 멈춤 없이 진행률/취소/재시도 경험 제공

## 11) 진행 현황 업데이트 (2026-02-28)

### 11.1 결정: DatasetTab 분해는 지금 시작

- [x] **Q1**: `frontend/src/tabs/DatasetTab.tsx` 분해를 지금 착수할 것인가?
  - **→ A: 예. Split now (단계적/저위험 분해)**
  - 근거: 단일 탭 파일에 상태/이펙트/API/폴링이 과밀하여, 신규 기능 도입 전 구조 리스크를 낮추는 편이 총비용이 작다.

### 11.2 근거 지표 (현재 코드 기준)

| 항목 | 현재 수치 | 비교/해석 |
|---|---:|---|
| `DatasetTab.tsx` 길이 | 1359 lines | 탭 중 최장 (`TrainTab.tsx` 1008, `DeviceSetupTab.tsx` 980, `CalibrateTab.tsx` 913) |
| `useState(` | 23 | 탭 중 최다 수준 |
| `useEffect(` | 10 | 상위권, 부작용 관리 부담 큼 |
| `/api/` 참조 | 17 | 단일 탭에서 API 도메인 결합이 큼 |
| `setInterval(` | 2 | push/download polling이 탭 파일에 직접 결합 |

다중 도메인이 한 파일에 공존:
- 로컬 데이터셋 목록/상세/삭제
- 태깅/필터/페이지네이션
- 품질 검사
- HF 토큰/검색/다운로드
- Hub push 상태 추적
- 멀티 비디오 replay 제어

### 11.3 권장 분해 순서 (저위험 우선)

1. **PR-1 (behavior-preserving)**: `DatasetOverviewPanel` 추출
   - 목록/선택/삭제/태그 필터/페이지네이션 UI를 패널로 이동
   - API 호출 타이밍/동작은 기존과 동일 유지
2. **PR-2 (behavior-preserving)**: `DatasetReplayPanel` 추출
   - replay 컨트롤/타임라인/멀티 비디오 렌더 블록 이동
   - 재생 동기화 로직은 변경 없이 이관
3. **PR-3 (side-effect 격리)**: `useDatasetJobs.ts` 도입
   - Hub download/push polling 및 상태머신을 훅으로 캡슐화
   - 탭은 "명령(start) + 상태 표시"만 담당
4. **PR-4 (기능 확장 단계)**: `DatasetInsightsPanel`/`DatasetUrdfPanel` 착수
   - Phase 2/3 기능 도입 시점에만 진행

### 11.4 경계 정의 (Parent vs Panel/Hook)

- `DatasetTab.tsx`(Parent): 선택 dataset/episode 같은 상위 오케스트레이션, 패널 간 공통 상태 연결, 전역 toast 트리거
- `DatasetOverviewPanel`/`DatasetReplayPanel`(Child): UI 렌더링과 UI 이벤트 수집 중심, 부모 callback 호출
- `useDatasetJobs.ts`(Hook): polling lifecycle, 진행률/phase/status, cleanup 책임 집중

### 11.5 진입/완료 기준

- 각 PR은 "동작 보존"을 우선하며, 수동 시나리오(탐색/태깅/파생/Hub push/download/replay) 회귀가 없어야 한다.
- `PR-3` 완료 시 목표:
  - `DatasetTab.tsx`에서 polling interval 직접 관리 코드 제거
  - Hub job 상태 처리가 hook 경계로 이동
- 다음 단계(Insights/URDF)는 Phase 0~1 DoD 통과 후 착수한다.

### 11.6 현재 갭 메모

- 본 문서 9절의 기능 플래그(`datasetV2`)는 현재 코드 기준 미도입 상태다.
- 따라서 우선은 패널/훅 분해를 "기능 변경 없는 구조 개선"으로 진행하고, 기능 플래그는 별도 PR로 도입한다.

### 11.7 PR 단위 실행 체크리스트 (바로 작업용)

#### PR-1: `DatasetOverviewPanel` 추출 (behavior-preserving)

- [ ] 파일 추가: `frontend/src/components/dataset/DatasetOverviewPanel.tsx`
- [ ] `frontend/src/tabs/DatasetTab.tsx`에서 목록/선택/삭제/태그 필터/페이지네이션 UI 블록을 패널로 이동
- [ ] 기존 API 호출 순서/타이밍 유지 (`refreshList`, `loadDataset`, `reloadTags` 동작 불변)
- [ ] DoD: 렌더/동작 차이 없이 기존 Dataset 목록/선택/삭제/태그 필터/페이지 전환이 동일하게 동작
- [ ] 검증: `npm run lint`, `npm run build` (in `frontend/`)

#### PR-2: `DatasetReplayPanel` 추출 (behavior-preserving)

- [ ] 파일 추가: `frontend/src/components/dataset/DatasetReplayPanel.tsx`
- [ ] `frontend/src/tabs/DatasetTab.tsx`에서 replay 컨트롤/타임라인/멀티 비디오 렌더 블록 이동
- [ ] 비디오 동기화/스크러빙/속도 제어/에피소드 경계 클램프 로직 불변
- [ ] DoD: 기존 replay UX(재생/일시정지/탐색/속도/동기화) 회귀 없음
- [ ] 검증: `npm run lint`, `npm run build` (in `frontend/`)

#### PR-3: `useDatasetJobs.ts` 도입 (side-effect 격리)

- [ ] 파일 추가: `frontend/src/hooks/useDatasetJobs.ts`
- [ ] download/push polling interval 및 상태 갱신 로직을 hook으로 이동
- [ ] `frontend/src/tabs/DatasetTab.tsx`는 start 명령 + 상태 바인딩만 담당
- [ ] DoD: `DatasetTab.tsx`에서 polling interval 직접 관리 코드 제거, download/push 상태 표시 동일
- [ ] 검증: `npm run lint`, `npm run build` (in `frontend/`)

#### PR-4: Insights/URDF 패널 착수 (기능 확장 단계)

- [ ] 파일 추가: `frontend/src/components/dataset/DatasetInsightsPanel.tsx`
- [ ] 파일 추가: `frontend/src/components/dataset/DatasetUrdfPanel.tsx`
- [ ] Phase 2/3 DoD 기준 충족 전에는 스텁/플래그 기반으로만 노출
- [ ] DoD: 기존 Dataset 기능 회귀 없이 새 패널이 독립적으로 활성화/비활성화 가능
- [ ] 검증: `npm run lint`, `npm run build` (in `frontend/`)

#### 공통 머지 게이트 (모든 PR)

- [ ] 수동 시나리오: 로컬 데이터셋 선택 -> 필터/태깅 -> 파생 생성 -> Hub push/download -> replay
- [ ] 회귀 없음 확인: 기존 Dataset 기능(검색/다운로드/재생/태깅/품질검사/push)
- [ ] 문서 동기화: 본 문서 11절 진행 상태 체크박스 업데이트
