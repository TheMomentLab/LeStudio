# LeStudio — Dataset Viewer/Editor 작업 티켓 분해안

최종 갱신: 2026-02-25  
기준 문서: `docs/private/archive/dataset-viewer-editor-adoption-plan.md`

---

## 1) 운영 규칙

- 본 문서는 P0/P1 실행을 GitHub Issue 단위로 쪼갠 백로그다.
- 기본 원칙: **작은 단위, 검증 가능한 완료조건(AC), 의존성 명시**.
- 아키텍처 제약:
  - `lerobot.*` import 경계(bridge/device_registry 외 신규 import 금지) 준수
  - 기존 FastAPI + polling job 패턴 재사용
  - 프론트는 `DatasetTab` 슬림화(컴포넌트/훅 분리)

권장 라벨 세트:
- `area:dataset`
- `type:feature` / `type:refactor` / `type:test` / `type:docs`
- `priority:P0` / `priority:P1`
- `size:S` / `size:M` / `size:L`
- `phase:week1` / `phase:week2` / `phase:later`

---

## 2) 공통 이슈 템플릿 (복붙용)

```md
## Summary
<무엇을 왜 하는지 2-3문장>

## Scope
- In:
  - <포함 작업>
- Out:
  - <제외 작업>

## Files (Expected)
- <path>
- <path>

## Acceptance Criteria
- [ ] AC1: <검증 가능한 조건>
- [ ] AC2: <검증 가능한 조건>
- [ ] AC3: <검증 가능한 조건>

## Verification
- [ ] LSP diagnostics clean
- [ ] Related tests pass
- [ ] Build/typecheck pass

## Dependencies
- Blocks: <없으면 N/A>
- Blocked by: <없으면 N/A>

## Risk/Notes
- <리스크/롤백 포인트>
```

---

## 3) P0 티켓 (2주)

## Epic A — Backend Curation Foundation

### P0-A1 — Dataset episodes 페이지네이션 API
- **Title**: `[P0][Dataset][API] Add paginated episodes endpoint`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week1`
- **Files**: `src/lestudio/server.py`
- **Depends on**: N/A
- **AC**:
  - [ ] `GET /api/datasets/{user}/{repo}/episodes` 구현 (`page`, `page_size`, `tag`, `sort`, `order`)
  - [ ] `total_items`, `total_pages`, `items` 일관성 보장
  - [ ] 빈 dataset/마지막 페이지/최대 page_size 경계값 처리

### P0-A2 — Dataset stats API (히스토그램 포함)
- **Title**: `[P0][Dataset][API] Add stats endpoint with histogram`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week1`
- **Files**: `src/lestudio/server.py`
- **Depends on**: P0-A1
- **AC**:
  - [ ] `GET /api/datasets/{user}/{repo}/stats` 구현
  - [ ] `length_histogram`, `tag_distribution`, `camera_coverage` 반환
  - [ ] 히스토그램 count 합 == 에피소드 수

### P0-A3 — Curation preview API
- **Title**: `[P0][Dataset][API] Add curation preview endpoint`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week1`
- **Files**: `src/lestudio/server.py`
- **Depends on**: P0-A1
- **AC**:
  - [ ] `POST /api/datasets/{user}/{repo}/curation/preview` 구현
  - [ ] `include_selected/exclude_selected` 모드 지원
  - [ ] preview의 `kept/removed` 카운트가 입력 selector와 일치

### P0-A4 — Non-destructive export job API
- **Title**: `[P0][Dataset][API] Add non-destructive curation export job`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:L`, `phase:week1`
- **Files**: `src/lestudio/server.py`
- **Depends on**: P0-A3
- **AC**:
  - [ ] `POST /api/datasets/{user}/{repo}/curation/export` 구현
  - [ ] `GET /api/datasets/curation/status/{job_id}` 구현
  - [ ] 원본 dataset 불변(read-only) 보장
  - [ ] 실패 시 임시 산출물 정리 및 에러 로그 제공

### P0-A5 — Export + Hub push 연계
- **Title**: `[P0][Dataset][API] Wire export result to optional Hub push`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week2`
- **Files**: `src/lestudio/server.py`
- **Depends on**: P0-A4
- **AC**:
  - [ ] export 요청에서 `push_to_hub` 옵션 처리
  - [ ] 상태 API에 `phase/progress/logs/result_repo_id/error` 제공
  - [ ] push 실패가 export 결과를 손상시키지 않음

## Epic B — Frontend Curation UX

### P0-B1 — DatasetTab 분해: EpisodeTable
- **Title**: `[P0][Dataset][FE] Extract EpisodeTable component`
- **Labels**: `area:dataset`, `type:refactor`, `priority:P0`, `size:M`, `phase:week1`
- **Files**:
  - `frontend/src/tabs/DatasetTab.tsx`
  - `frontend/src/components/dataset/EpisodeTable.tsx`
- **Depends on**: P0-A1
- **AC**:
  - [ ] 페이지네이션 목록 렌더링/정렬/필터 동작
  - [ ] 기존 episode 선택 UX 회귀 없음
  - [ ] DatasetTab 코드량 유의미 감소

### P0-B2 — DatasetTab 분해: CurationPanel + hook
- **Title**: `[P0][Dataset][FE] Add CurationPanel and useDatasetCuration hook`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:L`, `phase:week1`
- **Files**:
  - `frontend/src/components/dataset/CurationPanel.tsx`
  - `frontend/src/hooks/useDatasetCuration.ts`
  - `frontend/src/tabs/DatasetTab.tsx`
- **Depends on**: P0-A3, P0-A4
- **AC**:
  - [ ] preview/export/status polling 연결
  - [ ] include/exclude 모드 전환 + selected indices 반영
  - [ ] 진행 상태/오류 토스트 표시

### P0-B3 — SelectionToolbar + 단축키
- **Title**: `[P0][Dataset][FE] Add multi-select toolbar and keyboard shortcuts`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week1`
- **Files**:
  - `frontend/src/components/dataset/SelectionToolbar.tsx`
  - `frontend/src/tabs/DatasetTab.tsx`
- **Depends on**: P0-B1
- **AC**:
  - [ ] 일괄 선택/해제, 일괄 태그, 일괄 제외 액션 지원
  - [ ] 단축키(이전/다음, 태그, 선택 토글) 지원
  - [ ] 입력 포커스 중 단축키 비활성(오동작 방지)

### P0-B4 — StatsPanel (히스토그램/분포)
- **Title**: `[P0][Dataset][FE] Add stats panel with distribution views`
- **Labels**: `area:dataset`, `type:feature`, `priority:P0`, `size:M`, `phase:week2`
- **Files**:
  - `frontend/src/components/dataset/StatsPanel.tsx`
  - `frontend/src/tabs/DatasetTab.tsx`
- **Depends on**: P0-A2
- **AC**:
  - [ ] length histogram 시각화 표시
  - [ ] tag distribution/camera coverage 표시
  - [ ] 데이터 없음 상태(empty state) 처리

### P0-B5 — useDatasetEpisodes hook
- **Title**: `[P0][Dataset][FE] Add useDatasetEpisodes hook for paging/filter/sort`
- **Labels**: `area:dataset`, `type:refactor`, `priority:P0`, `size:M`, `phase:week2`
- **Files**:
  - `frontend/src/hooks/useDatasetEpisodes.ts`
  - `frontend/src/tabs/DatasetTab.tsx`
- **Depends on**: P0-A1, P0-B1
- **AC**:
  - [ ] 목록 API 상태(loading/error/data) 캡슐화
  - [ ] paging/filter/sort 상태 동기화
  - [ ] 탭 재진입 시 불필요한 재요청 최소화

## Epic C — Quality Gate / Validation

### P0-C1 — Backend tests for new endpoints
- **Title**: `[P0][Dataset][Test] Add backend tests for episodes/stats/curation APIs`
- **Labels**: `area:dataset`, `type:test`, `priority:P0`, `size:M`, `phase:week2`
- **Files**: `tests/**` (신규/수정), `src/lestudio/server.py`
- **Depends on**: P0-A1~A5
- **AC**:
  - [ ] 페이지네이션/히스토그램/preview/export status 테스트 추가
  - [ ] 실패 케이스(잘못된 입력, 없는 dataset) 테스트 포함
  - [ ] 원본 불변성 테스트 포함

### P0-C2 — Frontend tests for curation flow
- **Title**: `[P0][Dataset][Test] Add frontend tests for curation UX`
- **Labels**: `area:dataset`, `type:test`, `priority:P0`, `size:M`, `phase:week2`
- **Files**: `frontend/src/**/__tests__/*` (신규/수정)
- **Depends on**: P0-B1~B5
- **AC**:
  - [ ] multi-select + preview + export happy path 테스트
  - [ ] shortcut focus guard 테스트
  - [ ] polling lifecycle(cleanup) 테스트

### P0-C3 — User guide / release notes
- **Title**: `[P0][Dataset][Docs] Document curation workflow and constraints`
- **Labels**: `area:dataset`, `type:docs`, `priority:P0`, `size:S`, `phase:week2`
- **Files**: `README.md` or `docs/**`
- **Depends on**: P0-A/B/C 전체
- **AC**:
  - [ ] "원본 보존 + 새 dataset 생성" 흐름 문서화
  - [ ] known limitations 및 rollback 가이드 포함
  - [ ] 운영자 체크리스트 포함

---

## 4) P1 티켓 백로그

### P1-D1 — Video + time-series synchronized chart panel
- **Title**: `[P1][Dataset][FE] Add synchronized video/time-series panel`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:L`, `phase:later`
- **Depends on**: P0 완료

### P1-D2 — Action insights computations API
- **Title**: `[P1][Dataset][API] Add action insights metrics endpoint`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:L`, `phase:later`
- **Depends on**: P1-D1 (or 병렬 가능)

### P1-D3 — Outlier detection and smart filters
- **Title**: `[P1][Dataset][Feature] Add anomaly episode detection and smart filters`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:L`, `phase:later`
- **Depends on**: P1-D2

### P1-D4 — CLI command export from filter result
- **Title**: `[P1][Dataset][Feature] Export filter result as lerobot CLI command`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:M`, `phase:later`
- **Depends on**: P1-D3

### P1-D5 — 3D URDF viewer integration
- **Title**: `[P1][Dataset][FE] Add URDF pose viewer panel`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:L`, `phase:later`
- **Depends on**: P0 완료

### P1-D6 — Performance hardening for 10k+ episodes
- **Title**: `[P1][Dataset][Perf] Optimize for very large datasets`
- **Labels**: `area:dataset`, `type:feature`, `priority:P1`, `size:M`, `phase:later`
- **Depends on**: P0 완료

---

## 5) 2주 캘린더 매핑 (권장)

### Week 1
- Day 1-2: P0-A1, P0-A2
- Day 3-4: P0-A3, P0-A4
- Day 5: P0-B1, P0-B2, P0-B3(초기)

### Week 2
- Day 6-7: P0-B4, P0-B5, P0-B3(완료)
- Day 8: P0-A5
- Day 9: P0-C1, P0-C2
- Day 10: P0-C3 + stabilization

---

## 6) 이슈 생성 순서 (실행용)

권장 생성 순서(선행 의존성 기준):
1. P0-A1
2. P0-A2
3. P0-A3
4. P0-A4
5. P0-B1
6. P0-B2
7. P0-B3
8. P0-B4
9. P0-B5
10. P0-A5
11. P0-C1
12. P0-C2
13. P0-C3

운영 팁:
- 각 이슈 본문에 반드시 "Out of Scope"를 써서 범위 팽창 방지
- P0 완료 전 P1 구현 착수 금지 (조사/스파이크는 허용)
