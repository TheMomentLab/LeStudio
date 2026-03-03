# LeStudio — Dataset Viewer/Editor 도입 실행계획 (P0/P1)

최종 갱신: 2026-02-25  
상태: 실행안 (Execution Plan)

---

## 1) 목적

LeStudio의 현재 Dataset 기능(리플레이, 태깅, 품질검사, Hub 검색/다운로드/푸시)을 유지하면서,
외부 OSS의 강점을 안전하게 흡수해 **데이터 큐레이션 생산성**과 **분석 깊이**를 높인다.

참고 대상:
- `lerobot-dataset-visualizer` (Apache-2.0)
- `lerobot-data-studio` (MIT)
- `phosphobot/dataset-viewer` (MIT, private dataset 접근 아이디어 참고)

---

## 2) 현재 기준선 (LeStudio)

현재 구현됨:
- Dataset 상세/멀티카메라 동기 재생/스크럽: `frontend/src/tabs/DatasetTab.tsx`
- 태깅/필터: `frontend/src/tabs/DatasetTab.tsx`, `src/lestudio/server.py` (`/tags`)
- 품질 검사: `src/lestudio/server.py` (`/quality`)
- Hub 검색/다운로드/푸시: `src/lestudio/server.py`, `frontend/src/tabs/DatasetTab.tsx`

현재 없음(갭):
- 비디오-시계열 동기 그래프 패널
- 고급 통계 시각화(히스토그램 등)
- 자동 문제 에피소드 탐지/필터 추천
- 비파괴(non-destructive) 편집 결과를 "새 데이터셋"으로 생성
- 큐레이션 전용 단축키/대량 작업 UX
- 3D URDF 포즈 뷰어

---

## 3) 우선순위 (P0/P1)

### P0 (즉시 도입)

1. **비파괴 편집 파이프라인**
   - 선택된 에피소드를 제외/포함해 새 dataset 생성
   - 원본 dataset은 절대 수정하지 않음

2. **큐레이션 생산성 UX**
   - 에피소드 다중 선택 + 일괄 태그/제외
   - 키보드 단축키(다음/이전, good/bad/review, 선택 토글)

3. **대용량 대응 로딩**
   - episode 목록 페이지네이션
   - 필요한 메타만 우선 로드 (lazy panel)

4. **기본 통계 패널**
   - episode length 분포 히스토그램
   - 태그 분포, 카메라 커버리지 요약

### P1 (P0 안정화 후)

1. **비디오-시계열 동기 그래프** (state/action/sensor)
2. **Action Insights** (autocorrelation, state-action alignment, variance heatmap)
3. **자동 이상 에피소드 탐지 + 필터 제안**
4. **3D URDF 포즈 뷰어**

---

## 4) 2주 실행계획 (Week 1-2)

## Week 1 — P0 코어 백엔드 + 기본 UI 골격

### Day 1-2
- API 스펙 확정 및 서버 스캐폴딩
- 에피소드 페이지네이션 API 구현
- 통계 API(요약 + 히스토그램 bin) 구현

### Day 3-4
- 비파괴 편집 "미리보기(Preview)" API 구현
- 비파괴 편집 "실행(Job)" API 구현(백그라운드 작업 + 상태 폴링)
- 실패 롤백/임시파일 정리 처리

### Day 5
- DatasetTab에 "Curation Panel" 기본 UI 추가
- 페이지네이션/다중선택/일괄태그 UI 연결
- 단축키 1차 적용

Week 1 완료 기준:
- 1k+ episode dataset에서 목록/선택/미리보기가 타임아웃 없이 동작
- 새 dataset 생성 job이 성공/실패 상태를 정확히 리포트

## Week 2 — P0 완성 + 검증

### Day 6-7
- 통계 패널(히스토그램/분포 뷰) 완성
- 필터(태그/길이/품질 기준) + 미리보기 연동 고도화

### Day 8
- Hub push 연계(생성된 새 dataset 후속 업로드 UX)
- 에러 메세지/토스트/가이드 문구 정리

### Day 9
- 테스트 집중(단위/통합/수동 시나리오)
- 대용량/경계값 데이터셋 검증

### Day 10
- 문서화(사용 가이드 + 제약 사항)
- P1 착수용 기술부채 정리

Week 2 완료 기준:
- P0 기능 전부 e2e 시나리오 통과
- 사용자 기준 "원본 보존 + 새 dataset 생성" 흐름이 3클릭 이내로 완료

---

## 5) 백엔드 API 스펙 (P0)

아래는 `src/lestudio/server.py` 확장 기준 제안 스펙.

1) `GET /api/datasets/{user}/{repo}/episodes`
- 목적: 페이지네이션된 episode 목록
- query:
  - `page` (default: 1)
  - `page_size` (default: 100, max: 500)
  - `tag` (`all|good|bad|review|untagged`)
  - `sort` (`episode_index|length`)
  - `order` (`asc|desc`)
- response:
  - `items`, `page`, `page_size`, `total_items`, `total_pages`

2) `GET /api/datasets/{user}/{repo}/stats`
- 목적: 통계 패널 데이터
- response:
  - `episode_count`, `frame_count`, `fps`
  - `length_histogram` (`[{bin_start, bin_end, count}]`)
  - `tag_distribution` (`{good,bad,review,untagged}`)
  - `camera_coverage`

3) `POST /api/datasets/{user}/{repo}/curation/preview`
- 목적: 필터/선택 결과 미리보기
- body:
  - `mode` (`exclude_selected|include_selected`)
  - `selected_episode_indices` (`number[]`)
  - `filters` (optional)
- response:
  - `kept_count`, `removed_count`, `kept_indices_sample`, `removed_indices_sample`

4) `POST /api/datasets/{user}/{repo}/curation/export`
- 목적: 비파괴 새 dataset 생성 job 시작
- body:
  - `target_repo_id` (`username/dataset`)
  - `mode`, `selected_episode_indices`, `filters`
  - `push_to_hub` (`boolean`, default false)
- response:
  - `ok`, `job_id`

5) `GET /api/datasets/curation/status/{job_id}`
- 목적: export job 상태 폴링
- response:
  - `status` (`queued|running|success|error`)
  - `phase`, `progress`, `logs`, `result_repo_id`, `error`

서버 구현 원칙:
- 장시간 작업은 기존 push/download와 동일하게 background job + polling 패턴 유지
- 임시 결과물은 job 종료 시 정리
- 원본 dataset 경로는 read-only 취급

---

## 6) 프론트엔드 컴포넌트 분해안 (P0)

기존 `frontend/src/tabs/DatasetTab.tsx`를 과대화 방지 차원에서 분리:

- `frontend/src/components/dataset/EpisodeTable.tsx`
  - 페이지네이션 목록, 다중 선택, 정렬

- `frontend/src/components/dataset/CurationPanel.tsx`
  - include/exclude 모드, preview, export 실행

- `frontend/src/components/dataset/StatsPanel.tsx`
  - 길이 히스토그램, 태그 분포, 품질 요약

- `frontend/src/components/dataset/SelectionToolbar.tsx`
  - 일괄 태그/선택 토글/단축키 힌트

- `frontend/src/hooks/useDatasetCuration.ts`
  - preview/export/status polling 상태 캡슐화

- `frontend/src/hooks/useDatasetEpisodes.ts`
  - 페이지네이션 목록/필터/정렬 상태 캡슐화

유지 원칙:
- 전역 상태는 필요한 최소만 Zustand에 유지
- API 호출은 기존 `apiGet/apiPost/apiDelete` 패턴 유지

---

## 7) 테스트 체크리스트 (P0 완료 조건)

### 백엔드
- [ ] `episodes` 페이지네이션 경계값 (빈 dataset, 마지막 페이지, page_size 최대치)
- [ ] `stats` 히스토그램 bin 합계 == 총 에피소드 수
- [ ] `curation/preview` include/exclude 계산 정확성
- [ ] `curation/export` 성공/실패/중단 시 job 상태 일관성
- [ ] 원본 dataset 파일이 변경되지 않음(비파괴 보장)

### 프론트엔드
- [ ] 다중 선택/일괄 태그/필터 상태 충돌 없음
- [ ] 단축키가 입력 필드 포커스 상태에서 오동작하지 않음
- [ ] preview 결과와 실제 export 결과 count 일치
- [ ] polling 중 탭 이동/재진입 시 메모리 누수 없음

### 통합/수동
- [ ] 1k+ episodes에서 체감 응답성 확인
- [ ] Hub push 연계 시 권한/네트워크 오류 UX 확인
- [ ] 실패 토스트/로그 문구가 즉시 행동 가능한 정보 제공

---

## 8) 리스크 및 완화

1. **대용량 dataset 성능 저하**
   - 완화: 서버 페이지네이션 + 프론트 lazy 렌더 + 샘플링 응답

2. **편집 결과 신뢰성 문제**
   - 완화: preview/export 동일 selector 재사용 + 카운트 검증 테스트

3. **기존 DatasetTab 복잡도 폭증**
   - 완화: 컴포넌트/훅 분리, 탭 컨테이너는 orchestration만 담당

4. **OSS 코드 도입 시 컴플라이언스 누락**
   - 완화: 출처/라이선스 명시, 수정 파일 변경 고지, 제3자 라이선스 문서화

---

## 9) P1 착수 게이트

아래가 만족되면 P1 착수:
- P0 API/UX 결함률 안정화 (주요 버그 0)
- 1k+ episode 환경에서 재현 가능한 성능 기준 통과
- 큐레이션 결과 dataset 생성/업로드 운영 검증 완료

P1 우선순위 권장 순서:
1) 동기 그래프  
2) Action Insights  
3) 자동 이상 탐지  
4) 3D URDF 뷰어
