# LeStudio 탭별 심층 UI/UX 점검 (진행형)

최종 갱신: 2026-02-25
점검 방식: Playwright 실브라우저(Desktop 1440x900, Mobile 390x844) + 코드 구조 교차 검토
기준: 순서(정보 위계), 컴포넌트 적합성, task flow 완결성

---

## 1) Status 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (before)
  - Desktop: `status-desktop-top.png`, `status-desktop-mid.png`, `status-desktop-bottom.png`
  - Mobile: `status-mobile-top.png`, `status-mobile-mid.png`, `status-mobile-bottom.png`
- 스크린샷 (re-audit before)
  - Desktop: `status-reaudit-before-desktop-top.png`, `status-reaudit-before-desktop-mid.png`, `status-reaudit-before-desktop-bottom.png`
  - Mobile: `status-reaudit-before-mobile-top.png`, `status-reaudit-before-mobile-mid.png`, `status-reaudit-before-mobile-bottom.png`
- 관련 코드
  - `frontend/src/tabs/StatusTab.tsx` (375줄)
  - `frontend/src/index.css` (.status-grid, .status-issues)

### 1-1. 핵심 목적/사용자 과업

- 목적: "지금 바로 작업(teleop/record/train/eval)을 시작해도 되는가"에 대한 preflight 판단
- UX 목표: `판단 → 조치 → 다음 탭 이동`이 한 번에 이어지는 의사결정 패널
- 랜딩 페이지로서 첫 인상 결정

### 1-2. 실제 Flow 분석 (정밀, 스크린샷 기반)

#### Flow A: 작업 시작 전 readiness 확인
1. 진입 시 `readinessIssues` 자동 계산 (cameras/arms/resources/running process)
2. issues 있으면 `status-issues` 배너에 원인 + CTA 표시
3. 각 카드에서 세부 확인

**스크린샷 관찰 (desktop-top)**:
- Header "Action Needed" verdict 정상 표시 ✅
- "No arm port detected" issues 배너 + "→ Go to Mapping" CTA ✅
- 4-card grid (Cameras/Arms/Processes/Resources) 2열 레이아웃 ✅
- Session History full-width card ✅
- Refresh All 버튼이 devices+resources+history 모두 갱신 ✅

#### Flow B: Session History 이력 확인
1. 역순 이벤트 리스트 (teleop_end, train_end, train_start...)
2. meta 요약 (policy, repo_id, steps) 표시
3. Clear 버튼 (confirm 모달 보호)

**스크린샷 관찰 (desktop-mid, desktop-bottom)**:
- 이벤트 타입이 `teleop_end`, `train_start` 등 snake_case 원본 그대로 표시 — 사용자 친화적이지 않음
- 타임스탬프가 ISO 형식 `2026-02-24T22:58:33` — 읽기 어려움
- meta 요약은 잘 동작함 ("policy: act · repo_id: jinhyuk2me/helloworld · steps: 1000") ✅
- Clear 버튼이 `btn-sm` 일반 스타일 — 파괴적 액션인데 시각적 구분 없음

**모바일 관찰 (mobile-top)**:
- 헤더에 "System Status" + "Action Needed" + "Last updated: 2:54:39 PM" + "↺ Refresh All"이 모두 한 줄에 몰림
- verdict 뱃지와 "Last updated" 텍스트가 줄바꿈되며 이상하게 배치됨
- 카드 grid는 1-column으로 정상 스택 ✅

### 1-3. 컴포넌트 적합성

| 컴포넌트 | 적합 | 비고 |
|---|---|---|
| Header verdict | ✅ | Ready/Action Needed 3상태 |
| Issues banner + CTA | ✅ | 원인 + 액션 연결 우수 |
| 4-card grid | ✅ | 운영 대시보드 패턴 적합 |
| Resource bars | ✅ | 임계 상태 인지 빠름 |
| Process status dots | ✅ | green pulse/gray idle 직관적 |
  | Session History | ⚠️ | 타입/타임스탬프 가독성 부족 |
  | Clear button | ⚠️ | 파괴적 액션인데 일반 버튼 스타일 |
| Empty device CTA | ✅ | "→ Go to Mapping" 잘 제공 |

  ### 1-4. 상태-조치 매핑 결함

| 상태 | 조치 | 평가 |
|---|---|---|
| No camera/arm | "→ Go to Mapping" CTA | ✅ 우수 |
| Process running | "→ Open [Process]" CTA | ✅ 우수 |
| Resources fail | "→ Retry Resources" CTA | ✅ |
| History event type | snake_case 그대로 표시 | ❌ 가독성 |
| History timestamp | ISO 형식 | ❌ 가독성 |
| Clear action | btn-sm 일반 스타일 | ⚠️ 시각적 구분 없음 |

### 1-5. Quick Win 적용 (4개)

1. **QW-1**: Readiness 배너를 issue-chip 리스트로 개편 — 단일 문자열(`No arm port detected`) 대신 다중 issue 칩으로 가독성/액션성 강화.
2. **QW-2**: 중복 Mapping CTA 정리 — 상단 issues 배너에서만 CTA를 제공하고, Camera/Arm empty 카드의 중복 버튼 제거.
3. **QW-3**: Ready 상태 후속 전환 배너 추가 — `All core checks passed` + `→ Open Mapping`, `→ Proceed to Teleop` CTA.
4. **QW-4**: Session History UX 개선 — Expand/Collapse 토글 추가 + Resource bar 접근성(`role=progressbar`, aria*)/업데이트 시간 표시.

### 1-6. 적용 위치 (Round 2)

- `frontend/src/tabs/StatusTab.tsx`
  - `readinessIssues`를 객체 배열로 변경해 issue-chip 렌더링
  - `resourceUpdatedAt`, `historyExpanded` 상태 추가
  - ready-state 전환 배너 + history expand 버튼 추가
  - CPU/RAM/Disk bar에 ARIA 속성 추가
- `frontend/src/index.css`
  - `.status-issues-list`, `.status-issue-chip`, `.status-issues-actions` 추가
  - `.status-ready-banner`, `.status-ready-actions` 추가

---

## 2) Mapping 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (before)
  - Desktop: `mapping-desktop-top.png`, `mapping-desktop-mid.png`, `mapping-desktop-mid2.png`, `mapping-desktop-bottom.png`
  - Mobile: `mapping-mobile-top.png`, `mapping-mobile-mid.png`, `mapping-mobile-mid2.png`, `mapping-mobile-bottom.png`
- 스크린샷 (after)
  - Desktop: `mapping-after-desktop-top.png`, `mapping-after-desktop-mid.png`, `mapping-after-desktop-bottom.png`
  - Mobile: `mapping-after-mobile-top.png`, `mapping-after-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `mapping-reaudit-before-desktop-top.png`, `mapping-reaudit-before-desktop-mid.png`, `mapping-reaudit-before-desktop-bottom.png`
  - Before Mobile: `mapping-reaudit-before-mobile-top.png`, `mapping-reaudit-before-mobile-mid.png`, `mapping-reaudit-before-mobile-bottom.png`
  - After Desktop: `mapping-reaudit-after-desktop-top.png`, `mapping-reaudit-after-desktop-mid.png`, `mapping-reaudit-after-desktop-bottom.png`
  - After Mobile: `mapping-reaudit-after-mobile-top.png`, `mapping-reaudit-after-mobile-mid.png`, `mapping-reaudit-after-mobile-bottom.png`
  - After Incomplete-state: `mapping-reaudit-after-incomplete-desktop-top.png`
- 관련 코드
  - `frontend/src/tabs/DeviceSetupTab.tsx` (885줄)
  - `frontend/src/index.css`

### 2-1. 핵심 목적/사용자 과업

- 목적: 물리 디바이스(`/dev/video*`, `/dev/tty*`)를 안정적인 역할명(`top_cam_1`, `follower_arm_1`)으로 고정해서 이후 탭(Teleop/Record)이 환경 변동 없이 동작하게 하는 것.
- 과업 흐름: `udev 설치 상태 확인 → Camera role 매핑 → Arm serial-role 매핑 → 중복/적용 상태 검증 → Teleop/Record 전환`.
- Mapping 탭은 파이프라인의 기반 단계로, 여기서의 명확성이 뒤 탭 실패율을 좌우한다.

### 2-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1440×900)

- **헤더**: `Device Mapping` + `Mapping Ready` verdict + `↺ Refresh` 버튼 — 상단 판단/조치 구조가 명확함.
- **udev Rules 카드**: 설치 경로 표시 + `Current Active Rules` details 패널.
- **Mapping Checklist 카드**: Camera/Arm/Duplicates/Apply status를 한 카드에서 요약, 전이 CTA(`→ Proceed to Teleop`, `→ Proceed to Record`) 포함.
- **Camera Mapping 카드**: 대역폭 제한 안내(144p@5fps) + Preview + role 선택 + 포트/경로 메타.
- **Arm Port Mapping 카드**: Identify Arm 진입점 + arm별 role 매핑 카드.

#### Mobile (390×844)

- 단일 열 스택 전환이 안정적이며 카드 순서(게이트→체크리스트→카메라→암)가 유지됨.
- 헤더에서 verdict + Refresh가 함께 보여 즉시 판단/갱신 가능.
- Camera card와 Identify 버튼 터치 타겟은 충분함.
- 다만 arm 미검출 상태에서 기존 `Loading...` 표시는 오해를 유발할 여지가 있었음.

### 2-3. 실제 Flow 분석 (정밀)

#### Flow A: 설치 게이트(udev)
1. 탭 진입 시 `rules/status`, `udev/rules`, `devices`를 병렬 조회.
2. 설치 여부/권한 요구를 상단에서 안내.
3. 상세 rules는 details 패널로 확장.

평가:
- ✅ 설치 상태를 최상단에 배치한 것은 정확함.
- ✅ 미설치 시 설치 경로/권한 맥락이 충분히 노출됨.
- ✅ 설치 완료 시 기본적으로 요약 중심으로 동작.

#### Flow B: Camera 매핑
1. 카드 클릭으로 preview 활성.
2. role 선택 시 debounce auto-apply (`/api/rules/apply`).
3. 체크리스트 `Camera roles`와 `Apply status`에서 반영 상태 확인.

평가:
- ✅ `Preview + role select + 포트/경로` 조합이 과업과 잘 맞음.
- ✅ apply 상태가 `IDLE/APPLYING/APPLIED/ERROR`로 표시되어 피드백 루프가 명확함.
- ⚠️ 기존엔 현재 카메라의 선택 role을 즉시 읽기 어렵다는 약점이 있었음.

#### Flow C: Arm 매핑
1. 수동 select 또는 `Identify Arm` wizard 진입.
2. role 충돌 시 swap confirm으로 안전하게 재할당.
3. 적용 결과를 checklist와 apply note로 확인.

평가:
- ✅ Identify wizard + swap confirm 플로우는 안전함.
- ✅ 중복 역할 탐지가 checklist에 즉시 반영됨.
- ❌ 기존 arm 0개 상태에서 `Loading...` 텍스트는 상태 의미가 부정확했음.

#### Flow D: 완료 후 전환
1. Mapping complete 판정(`assigned + no duplicates`) 충족.
2. Teleop/Record CTA로 전환.

평가:
- ✅ 전환 CTA 자체는 이미 잘 구성됨.
- ⚠️ 기존엔 불완전 상태에서도 CTA가 보일 수 있어 조기 전환 위험이 있었음.

### 2-4. 컴포넌트 적합성

| 컴포넌트 | 적합 | 비고 |
|---|---|---|
| Header verdict + refresh | ✅ | 즉시 판단/갱신 루프 우수 |
| udev rules card | ✅ | 게이트 역할 명확 |
| Mapping checklist | ✅ | 완료도/오류 상태 한눈에 확인 |
| Camera cards | ✅ | preview + assignment + port 메타 조합 적합 |
| Arm identify wizard | ✅ | 실제 현장 식별 문제 해결에 효과적 |
| Arm empty state | ⚠️ | 기존 `Loading...` 문구 부정확 |
| Proceed CTA visibility | ⚠️ | 완료도와 연동 필요 |

### 2-5. 상태-조치 매핑 결함

| 상태 | 기존 조치 | 결함 |
|---|---|---|
| Arm 0개 | `Loading...` 텍스트 | ❌ 실제론 빈 상태인데 로딩처럼 보임 |
| Mapping incomplete | Proceed CTA 노출 가능 | ⚠️ 조기 전환 위험 |
| Rules detail (mobile) | 2열 고정 그리드 | ⚠️ 좁은 화면에서 압축/가독성 저하 가능 |
| Camera role assigned | select 값만 변경 | ⚠️ 카드 레벨 상태 인지 약함 |

### 2-6. Quick Win 적용 (4개)

1. **QW-1**: Arm empty state 문구 개선 — `Loading...` → `No arms detected. Connect a USB arm and click Refresh.`
2. **QW-2**: Rules panel 반응형 개선 — `mapping-rules-grid` 클래스 도입, 모바일에서 `1fr` 단일 열.
3. **QW-3**: Proceed CTA 가드 — `mappingComplete`일 때만 `→ Proceed to Teleop/Record` 노출.
4. **QW-4**: Camera role 배지 추가 — role 지정 시 카드 내부에 녹색 `✓ <Role Label>` 배지 표시.

#### 중기 개선

5. `P1` Identify wizard 결과를 해당 arm 카드로 자동 스크롤/하이라이트.
6. `P2` 미설치 상태에서 rules details 자동 확장 + 설치 액션 강조.

### 2-7. Quick Win 적용 (Round 2)

1. **QW-1**: Mapping blocker 카드 추가 — `!mappingComplete` 상태에서 blocker chip(`udev rules`, `unassigned roles`, `duplicate roles`, `no arms`) + `→ Open Rules Details`, `→ Open Motor Setup`, `→ Go to Calibration` CTA 제공.
2. **QW-2**: Checklist idle 상태 명확화 — Camera/Arm 역할이 0개 mappable일 때 `badge-warn` 대신 `badge-idle` 사용.
3. **QW-3**: CTA visibility guard 세분화 — `mappingComplete`여도 arm 0개면 Teleop/Record 대신 `→ Open Motor Setup` CTA만 노출.
4. **QW-4**: Arm empty-state 액션 강화 — `No arms detected...` 아래 `→ Open Motor Setup`, `→ Go to Calibration` CTA 추가.

### 2-8. 적용 위치 (Round 2)

- `frontend/src/tabs/DeviceSetupTab.tsx`
  - `cameraRolesReady`, `armRolesReady`, `mappingBlockers` 계산(useMemo) 추가
  - header 아래 `mapping-blocker-card` + CTA 추가
  - checklist badge를 `badge-idle/ok/warn`으로 세분화
  - `mappingComplete` CTA 분기(arm 0개일 때 Motor Setup 전환)
  - Arm empty-state CTA 추가
- `frontend/src/index.css`
  - `.mapping-blocker-card`, `.mapping-blocker-chip-row`, `.mapping-blocker-actions` 추가
  - 모바일 `#tab-device-setup .section-header` wrap 규칙 추가

---

## 3) Motor Setup 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (before)
  - Desktop: `motor-desktop-top.png`, `motor-desktop-bottom.png`
  - Mobile: `motor-mobile-top.png`, `motor-mobile-bottom.png`
- 스크린샷 (after)
  - Desktop: `motor-after-desktop-top.png`, `motor-after-desktop-bottom.png`
  - Mobile: `motor-after-mobile-top.png`, `motor-after-mobile-bottom.png`
- 관련 코드
  - `frontend/src/tabs/MotorSetupTab.tsx` (122줄)
  - `frontend/src/index.css`

### 3-1. 핵심 목적/사용자 과업

- 목적: 각 서보 모터에 고유 ID를 할당하는 `lerobot_setup_motors` 프로세스를 올바른 arm 타입/포트로 시작하고, 대화형 콘솔 입력을 처리하며, 완료 후 캘리브레이션으로 전환하는 것.
- 과업 흐름: `Arm Type 선택 → Port 선택 → Start Setup → 콘솔 대화(global console drawer) → 완료 확인 → Calibration 이동`
- Motor Setup은 하드웨어 초기화의 첫 단계로, 한 번만 실행하면 결과가 펌웨어에 영구 저장됨.

### 3-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1440×900)

- **헤더**: "Motor Setup" 제목만 — **readiness verdict 배지 없음** (다른 8개 탭과 불일치)
- **Quick Guide**: 전폭 카드, 명확한 안내 텍스트 — ✅ 양호
- **2열 그리드**: 좌측 = "Step 1: Connect Arm" (Type dropdown + Port dropdown + Start Setup), 우측 = "Connected Arms" ("—" 대시 하나)
- **하단**: 아무 콘텐츠 없음 — 뷰포트의 ~60%가 빈 공간
- **콘솔 드로어**: 하단에 `motor_setup` 채널 + IDLE 상태 표시 ✅

#### Mobile (390×844)

- 단일 열 스택으로 올바르게 전환됨 ✅
- Quick Guide → Step 1 → Connected Arms 순서로 자연스럽게 스택 ✅
- 드롭다운과 버튼 터치 타겟 적절 ✅
- "—" 대시 하나가 Connected Arms에 — 모바일에서 더 혼란스러움

### 3-3. 실제 Flow 분석 (정밀)

#### Flow A: 최초 실행
1. Arm Role Type 드롭다운에서 타입 선택 (so101_follower/leader, so100_follower/leader).
2. Port 드롭다운: arm이 검출되면 자동 추정 (follower/leader 키워드 매칭), 미검출이면 빈 드롭다운.
3. ▶ Start Setup 클릭.
4. 콘솔 드로어에서 대화형 입력 처리 (모터 ID 할당).

평가:
- ✅ 타입 변경 시 follower/leader 키워드 기반 포트 자동 추정이 onboarding에 효과적.
- ✅ 116줄의 간결한 코드 — 단일 목적 컴포넌트로 적합.
- ❌ **arm 미검출 시에도 Start 버튼이 활성**: 빈 포트로 실행하면 `[ERROR] Port must start with /dev/`가 콘솔에만 표시되고 에러 원인이 불명확.
- ❌ **헤더에 readiness verdict 없음**: 다른 8개 탭은 모두 Ready/Action Needed/Running 3상태 배지가 있는데 Motor Setup만 누락.
- ❌ **Connected Arms 빈 상태가 "—" 대시 하나**: 사용자가 arm을 연결해야 한다는 사실을 전달하지 못함.

#### Flow B: 실행 중 제어
1. running 상태에서 ProcessButtons가 Stop 버튼으로 전환.
2. 콘솔 드로어에서 stdout/stderr 실시간 스트리밍.
3. 필요 시 Stop 요청.

평가:
- ✅ ProcessButtons 패턴이 코드베이스 전반과 일관적.
- ✅ conflictReason 노출이 적절 (다른 프로세스 실행 중일 때 Start 비활성).
- ⚠️ 대화형 콘솔 입력이 필요한데, Quick Guide에서만 언급됨. 실행 시작 시 콘솔 자동 포커스/하이라이트가 없어 사용자가 놓칠 수 있음.

#### Flow C: 후속 전환
1. Setup 종료.
2. → Calibration 탭으로 이동.

평가:
- ❌ **후속 전환 CTA 완전 부재**: Quick Guide 텍스트에 "proceed to Calibration"이라고 써있지만, 클릭 가능한 버튼이 없음. 사용자가 사이드바에서 수동으로 찾아야 함.
- ❌ 다른 7개 탭은 이미 워크플로우 전환 CTA가 구현됨 (Calibrate→Teleop, Teleop→Record, ..., Eval→Record).

### 3-4. 컴포넌트 적합성

| 컴포넌트 | 적합 | 비고 |
|---|---|---|
| Header title | ⚠️ | verdict 배지 누락 — 패턴 위반 |
| Quick Guide | ✅ | 명확한 1-pass 안내 |
| Type dropdown | ✅ | API로 동적 타입 목록 로드 |
| Port dropdown | ✅ | Auto-match + 수동 선택 겸용 |
| ProcessButtons | ✅ | 코드베이스 일관 패턴 |
| Connected Arms list | ⚠️ | 빈 상태 텍스트 부족 |
| Post-setup CTA | ❌ | 완전 부재 |

### 3-5. 상태-조치 매핑 결함

| 상태 | 현재 조치 | 결함 |
|---|---|---|
| Arm 0개 검출 | "—" 표시 + 빈 port dropdown | ❌ 가이드 텍스트 없음, Start 여전히 활성 |
| Port 미선택 | Start 실행 → 콘솔 에러 | ❌ 인라인 경고 없음 |
| 실행 중 | ProcessButtons Stop 전환 | ✅ 양호 |
| 프로세스 충돌 | conflictReason 표시 | ✅ 양호 |
| Setup 완료 | 아무 CTA 없음 | ❌ Calibration 전환 필요 |
| 헤더 | 제목만 | ❌ verdict 배지 없음 |

### 3-6. Quick Win 적용 (4개)

1. **QW-1**: Header Readiness Verdict 추가 — `running ? 'Running' : arms.length > 0 && !conflict ? 'Ready' : 'Action Needed'`. `status-verdict` 클래스 사용.
2. **QW-2**: Connected Arms 빈 상태 텍스트 개선 — "—" → "No arms detected. Connect a USB arm and refresh." (italic, secondary color)
3. **QW-3**: Port 미검출 시 인라인 경고 — 빈 port + arm 0개일 때 "No arm port detected. Connect an arm to begin." (warn color)
4. **QW-4**: Post-setup "→ Proceed to Calibration" CTA — `hasRun && !running` 일 때 하단 카드에 전환 버튼 표시.
#### 중기 개선

5. `P1` 실행 시작 시 콘솔 드로어 자동 확장 + 포커스.
6. `P2` 선택 포트와 일치하는 Connected Arms 항목 하이라이트.

### 3-7. Quick Win 적용 (Round 2)

1. **QW-1**: Setup blocker 카드 추가 — `conflictReason` 존재 시 상단에 경고 카드 노출.
2. **QW-2**: Form 접근성 강화 — `<label>`과 `<select>`를 `htmlFor`/`id`로 명시적 연결.
3. **QW-3**: Connected Arms empty-state CTA — `No arms detected...` 텍스트 아래 `→ Open Mapping` CTA 추가.
4. **QW-4**: Two-column 모바일 반응형 개선 — `max-width: 900px`에서 2열 카드를 1열로 자동 스택되도록 CSS 수정.

### 3-8. 적용 위치 (Round 2)

- `frontend/src/tabs/MotorSetupTab.tsx`
  - `conflictReason` 기반 `motor-setup-blocker-card` 추가
  - `motor-role-type`, `motor-port` id/htmlFor 연결
  - Connected Arms empty state에 `→ Open Mapping` CTA 추가
- `frontend/src/index.css`
  - `#tab-motor-setup .two-col` 클래스 추가 및 900px 미디어쿼리 스택 규칙 적용
5. `P1` 실행 시작 시 콘솔 드로어 자동 확장 + 포커스.
6. `P2` 선택 포트와 일치하는 Connected Arms 항목 하이라이트.

## 4) Calibration 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷
  - Desktop Top: `calibrate-desktop.png`
  - Desktop Bottom: `calibrate-desktop-bottom.png`
  - Mobile Top: `calibrate-mobile.png`
  - Mobile Bottom: `calibrate-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `calibrate-reaudit-before-desktop-top.png`, `calibrate-reaudit-before-desktop-mid.png`, `calibrate-reaudit-before-desktop-bottom.png`
  - Before Mobile: `calibrate-reaudit-before-mobile-top.png`, `calibrate-reaudit-before-mobile-mid.png`, `calibrate-reaudit-before-mobile-bottom.png`
  - After Desktop: `calibrate-reaudit-after-desktop-top.png`, `calibrate-reaudit-after-desktop-mid.png`, `calibrate-reaudit-after-desktop-bottom.png`
  - After Mobile: `calibrate-reaudit-after-mobile-top.png`, `calibrate-reaudit-after-mobile-mid.png`, `calibrate-reaudit-after-mobile-bottom.png`
- 관련 코드
  - `frontend/src/tabs/CalibrateTab.tsx` (539줄)
  - `frontend/src/index.css`

### 4-1. 핵심 목적/사용자 과업

- 목적은 정확한 `Arm Type + Arm ID + Port` 조합으로 calibration 파일을 생성/갱신하고, 기존 파일을 관리하며, 실시간 모터 범위를 모니터링하는 것.
- 사용자 과업은 `타입/ID/포트 선택 → 파일 상태 확인 → 캘리브레이션 실행 → 라이브 모터 범위 관찰 → 파일 저장 확인 → Teleop 이동`으로 닫혀야 한다.

### 4-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1280×900)

- **2열 그리드**: 좌측 = "Step 1: Arm Selection" 카드, 우측 = "Connected Arms" + "Existing Files" 두 카드 스택
- **하단**: "Live Motor Ranges" 카드가 2열 아래에 별도 배치 (`maxWidth: 480px`)
- **헤더**: "Calibration" 제목만 있고 **readiness verdict 배지 없음** → 다른 탭(Teleop/Train/Eval)과 불일치

#### Mobile (375×812)

- 단일 열 스택으로 올바르게 전환됨
- 하단 sticky "▶ Start Calibration" 바 동작 확인 — 양호
- Identify Wizard 패널이 열려있으면 화면 상당 부분을 차지

### 4-3. 실제 Flow 분석 (정밀)

#### Flow A: 파일 기반 시작 판단

1. Arm Role Type 드롭다운에서 타입 선택 (auto-match로 Port도 변경됨).
2. Arm ID 드롭다운에서 ID 선택 (기존 파일이 있으면 optgroup으로 그룹화).
3. Calibration File 상태 박스에서 Found/Missing + 경로 확인.
4. Start Calibration 실행.

평가:
- ✅ Found/Missing 배지 + 경로 요약이 실행 버튼 바로 위에 있어 의사결정 문맥이 좋다.
- ✅ 타입 변경 시 follower/leader 키워드 기반 포트 자동 추정이 효과적.
- ⚠️ **Arm ID와 Port의 조합 유효성 검증 없음**: `my_so101_follower_3` + `/dev/follower_arm_1` 같은 불일치 조합에 경고 없음.
- ⚠️ **파일 상태가 "Missing"이어도 Start가 활성화**: 이건 의도된 것(새 파일 생성)이지만, 사용자에게 "덮어쓰기 vs 신규 생성" 의미가 시각적으로 구분되지 않음.

#### Flow B: 장치 식별 보조 (Identify Wizard)

1. "Open Identify Wizard" CTA 클릭 (또는 자동 오픈 — 팔이 1개 초과이거나 0개일 때).
2. 우측 "Connected Arms" 카드 내 Identify 패널로 포커스.
3. 기존 팔 스냅샷 → 재연결 감지 → 결과 표시.
4. 사용자가 결과를 보고 **좌측 칼럼의 Port 드롭다운을 수동 변경**.

평가:
- ⚠️ **크로스-칼럼 워크플로우**: Identify 결과는 우측 칼럼에 나오지만, 그 결과를 반영할 Port 드롭다운은 좌측 칼럼. 사용자가 양쪽을 왔다갔다해야 함.
- ⚠️ **결과 반영이 수동**: Identify로 팔을 찾아도 Port를 자동 채우지 않음. "Use this port" 버튼이 없음.
- ✅ 자동 오픈 조건(팔이 0개 or 2개+)은 적절한 판단.
- ⚠️ **Connected Arms "—" 표시**: 팔이 0개일 때 대시 하나만 표시됨. "No arms detected. Connect a USB arm to see it here." 같은 안내 텍스트가 필요.

#### Flow C: 기존 파일 관리

1. Existing Files 카드에서 타입별 필터링 (All Types / 개별 타입).
2. 파일 행 클릭 → 좌측 칼럼의 Type/ID 자동 변경 (코드 확인: `.selected` 클래스 적용).
3. Delete 버튼 → confirm dialog → refresh + checkFile.

평가:
- ✅ 삭제 confirm이 충분한 정보를 포함 (파일명, 타입, 최종 수정일).
- ✅ 삭제 후 즉시 리프레시 + 파일 상태 재확인으로 일관성 보장.
- ✅ 타입별 그룹화(SO101_LEADER / SO101_FOLLOWER)가 스캔성을 높임.
- ⚠️ **선택된 파일의 시각적 구분이 약함**: `.selected` 클래스가 존재하지만 배경색 차이가 미묘.

#### Flow D: 캘리브레이션 실행 중 모니터링

1. Start 후 Live Motor Ranges 테이블에 실시간 데이터 표시.
2. 모터별 MIN/POS/MAX 값과 범위 바 시각화.
3. Stop 후 파일 저장 확인.

평가:
- ✅ 모터 범위 시각화는 캘리브레이션 품질 판단에 매우 유효.
- ⚠️ **maxWidth: 480px 제약**: 1280px 데스크탑에서 카드가 전체 폭의 ~38%만 차지. 실행 중 가장 중요한 피드백인데 너무 작음.
- ⚠️ 빈 상태 메시지("Waiting for calibration...")는 적절하지만, 카드가 화면 하단에 밀려 스크롤 없이는 안 보임.

#### Flow E: 후속 전환 (캘리브레이션 완료 후)

1. 파일 생성 확인.
2. **→ 다음 단계(Teleop)로 이동.**

평가:
- ❌ **후속 전환 CTA 완전 부재**: 캘리브레이션 완료 후 "Proceed to Teleop" 같은 안내가 없음. 사용자가 워크플로우를 스스로 기억해야 함.

### 4-4. 컴포넌트 적합성

- **적합한 점**
  - 설정 form (3개 드롭다운) + 파일 상태 박스 + 파일 목록 + 라이브 ranges의 4요소는 calibration 태스크에 잘 맞음.
  - ProcessButtons 패턴이 코드베이스 전반과 일관적.
  - Arm ID optgroup은 follower/leader 분류를 시각적으로 보강.
  - Mobile sticky bar가 긴 폼에서 실행 접근성을 보장.

- **부적합/부족한 점**
  - "Step 1"이라는 레이블은 Step 2가 있을 것을 암시하지만 **Step 2가 없음**. 혼란 유발.
  - 좌측 카드의 하단 빈 공간이 과도함 (우측 카드 2개 스택 높이에 맞춰 늘어남).
  - Live Motor Ranges의 maxWidth 480px는 데스크탑에서 시각적으로 고아(orphaned) 느낌.

### 4-5. 헤더 일관성 결함

| 탭 | Readiness Verdict 배지 | 비고 |
| --- | --- | --- |
| Status | ✅ Ready / Action Needed | — |
| Teleop | ✅ Ready to Start / Action Needed | — |
| Train | ✅ Running / Ready to Start / Action Needed | — |
| Eval | ✅ Running / Ready to Start / Action Needed | — |
| **Calibrate** | ❌ **없음** | **패턴 위반** |

Calibrate에도 동일한 verdict 배지를 추가해야 크로스-탭 일관성이 유지됨.

### 4-6. 상태-조치 매핑 결함

| 상태 | 현재 조치 | 결함 |
| --- | --- | --- |
| Arm 0개 검출 | "—" 표시 + Identify 자동 오픈 | 텍스트가 "—"만으로 모호함 |
| Arm 2개+ (어떤게 어떤건지 모름) | Identify Wizard | 결과 → Port 수동 반영 필요 |
| 파일 Missing | Start 활성화 | 의도적이지만 "새 파일 생성됨" 안내 부족 |
| 캘리브레이션 완료 | 파일 리스트 갱신 | **다음 단계 CTA 없음** |
| 프로세스 충돌 | conflictReason 표시 | 적절함 (우수) |

### 4-7. 개선 우선순위 (Quick Wins 포함)

#### Quick Wins (즉시 적용 가능)

1. **`P0` Header Readiness Verdict 추가**: arms 연결 + port 유효 + 충돌 없음 → "Ready" / 그 외 → "Action Needed". 다른 탭과 동일 패턴.
2. **`P0` Live Motor Ranges maxWidth 제거**: `#cal-live-table { maxWidth: 480px }` → 삭제하여 전체 폭 사용.
3. **`P1` Connected Arms 빈 상태 텍스트 개선**: "—" → "No arms detected. Connect a USB arm to see it here."
4. **`P1` 캘리브레이션 완료 후 Next Step CTA**: 파일 상태가 Found로 변경되면 "→ Proceed to Teleop" 링크 표시.

#### 중기 개선

5. `P1` Identify 결과에서 "Use this port" 원클릭 반영 버튼 추가.
6. `P1` "Step 1" 레이블 변경 — "Arm Selection"으로 단순화 (Step 넘버링 제거).
7. `P2` 선택된 파일의 시각적 하이라이트 강화 (배경색 대비 증가).

### 4-8. Quick Win 적용 (Round 2)

1. **QW-1**: Calibrate blocker 카드 추가 — `!running && blockers` 상태에서 chip(`No arms detected`, `conflict process`) + `→ Open Mapping`, `→ Open Motor Setup` CTA 제공.
2. **QW-2**: Identify 자동 오픈 조건 축소 — `arms.length !== 1`에서 `arms.length > 1`로 조정해 arm 0개 상태의 과도한 auto-open 제거.
3. **QW-3**: Connected Arms empty-state 액션 추가 — `No arms detected` 문구 아래 `→ Open Mapping` CTA 추가.
4. **QW-4**: Live Motor Ranges idle compact — placeholder를 중앙 정렬 대형 블록에서 compact 안내형(`padding 14px`)으로 축소.

### 4-9. 적용 위치 (Round 2)

- `frontend/src/tabs/CalibrateTab.tsx`
  - `calibrateBlockers` 계산(useMemo) 추가
  - header 아래 `calibrate-blocker-card` + CTA 추가
  - Identify auto-open 조건 변경 (`> 1`)
  - Connected Arms empty-state CTA 추가
  - Motor placeholder compact 렌더링 적용
- `frontend/src/index.css`
  - `.calibrate-blocker-card`, `.calibrate-blocker-chip-row`, `.calibrate-blocker-actions` 추가
  - 모바일 `#tab-calibrate .section-header` wrap 규칙 추가
---

## 5) Teleop 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (6장)
  - Desktop Top: `teleop-desktop-top.png`
  - Desktop Mid: `teleop-desktop-mid.png`
  - Desktop Bottom: `teleop-desktop-bottom.png`
  - Mobile Top: `teleop-mobile-top.png`
  - Mobile Mid: `teleop-mobile-mid.png`
  - Mobile Bottom: `teleop-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `teleop-reaudit-before-desktop-top.png`, `teleop-reaudit-before-desktop-mid.png`, `teleop-reaudit-before-desktop-bottom.png`
  - Before Mobile: `teleop-reaudit-before-mobile-top.png`, `teleop-reaudit-before-mobile-mid.png`, `teleop-reaudit-before-mobile-bottom.png`
  - After Desktop: `teleop-reaudit-after-desktop-top.png`, `teleop-reaudit-after-desktop-mid.png`, `teleop-reaudit-after-desktop-bottom.png`
  - After Mobile: `teleop-reaudit-after-mobile-top.png`, `teleop-reaudit-after-mobile-mid.png`, `teleop-reaudit-after-mobile-bottom.png`
- 관련 코드
  - `frontend/src/tabs/TeleopTab.tsx` (637줄)
  - `frontend/src/index.css`

### 5-1. 핵심 목적/사용자 과업

- 목적: Arm 연결 + 카메라 확인 → 안전 경고 인지 → Teleop 실행 → 모션/피드 검증 → Record 이동.
- Teleop은 하드웨어 통합 검증 단계로, 이전 단계(Calibration)의 결과를 확인하고 다음 단계(Record)로 진행하는 게이트웨이 역할.
- 실행 중 핵심 관심사: **카메라 피드 실시간 확인 + 팔 동작 안전성 + 루프 퍼포먼스(Hz)**.

### 5-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1280×900)

- **2열 그리드**: 좌측 = Step 1 (Arm Connections, `<details>` 접이식), 우측 = Step 2 (Camera Feeds)
- **하단 전폭 카드**: "TELEOP CONTROL" — readiness 체크리스트 + 피드 그리드 + 안전 배너 + Speed + Start 버튼
- **헤더**: "Teleoperation" + "Action Needed" verdict + "Control Mode: Single Arm / Bi-Arm" 토글 + 루프 퍼포먼스 pill (실행 시)

#### Mobile (375×812)

- 단일 열 스택 전환 양호
- Step 1 `<details>` 확장 시 스크롤 비용 높음 (Robot Type, Teleop Type, RobotCapabilitiesCard, 4개 port/id 드롭다운)
- 안전 배너 + Speed + Start Teleop 버튼이 최하단에 위치 — 스크롤 없이는 접근 불가
- **Bi-Arm 토글이 viewport overflow로 잘림** (mobile-top 스크린샷에서 Bi-Arm 버튼 미표시)

### 5-3. 실제 Flow 분석 (정밀)

#### Flow A: 준비 단계 (Arm + Camera 설정)

1. Step 1에서 Robot Type, Teleop Type 선택 → 호환 teleop 자동 필터링.
2. Follower/Leader Port + ID 설정 (calibration 파일 기반 suggestion).
3. Step 2에서 카메라 매핑/피드 상태 확인.
4. Teleop Control 체크리스트에서 readiness 확인.

평가:
- ✅ Step 1 접이식 패널: 데스크탑 ≥1100px에서 자동 펼침, 이후 접으면 compact summary로 전환 — 우수한 정보 밀도 제어.
- ✅ RobotCapabilitiesCard가 compatible_teleops 표시 — 타입 불일치 예방.
- ✅ Teleop Control 체크리스트(Arms connected / Camera feeds / Process conflicts) 3항목이 실행 전 readiness를 명확히 표시.
- ⚠️ **"→ Go to Mapping" CTA 중복**: Step 2 카드(line 492)와 Teleop Control 카드(line 558) 양쪽에 동일 버튼. 화면에 동시 표시됨.
- ⚠️ **Missing ports 텍스트가 device-item 바깥에 배치되어 시각적 위계가 불균형.**

#### Flow B: 실행 단계

1. Speed 선택 (0.1x ~ 1.0x).
2. ▶ Start Teleop 클릭.
3. 카메라 피드 LIVE 확인, 루프 퍼포먼스 pill 관찰.
4. 이상 시 ■ Stop 즉시 실행.

평가:
- ✅ Speed 드롭다운이 Start 버튼 바로 옆에 위치 — 실행 직전 조정 가능.
- ✅ 루프 퍼포먼스 pill (ms + Hz)이 헤더에 표시 — 시선 고정 영역에서 관찰 가능.
- ❌ **안전 배너가 idle 상태에서도 항상 표시**: "Unexpected movement → press Stop immediately"는 실행 중에만 의미가 있음. Idle 시 불필요한 시각적 노이즈.
- ❌ **헤더 verdict에 "Running" 상태 없음**: `teleopReady ? 'Ready to Start' : 'Action Needed'`만 있고, 실행 중일 때 'Teleop Active' 같은 상태를 표시하지 않음. Record 탭은 이미 3-state (Recording/Ready/Action Needed).

#### Flow C: 런타임 관찰

1. 피드 그리드에서 LIVE 배지 + fps 배지 확인.
2. 개별 카메라 pause/resume.
3. 루프 퍼포먼스 pill 색상 (good: ≥58Hz, warn: 54-57Hz, bad: <54Hz).

평가:
- ✅ Pause/Resume per-camera는 대역폭 절약에 효과적.
- ✅ 피드 카드 레이아웃(LIVE dot + fps + close btn + paused overlay)이 Record 탭과 일관적.
- ⚠️ 카메라가 0개일 때 "No cameras detected. Connect a camera and refresh." 표시되지만 Refresh 버튼이 없음 (텍스트만).

#### Flow D: 후속 전환 (Teleop 완료 후)

1. Stop 후 실행 결과 확인.
2. **→ 다음 단계(Record)로 이동.**

평가:
- ❌ **후속 전환 CTA 완전 부재**: Teleop 완료 후 "Proceed to Record" 같은 안내가 없음. Calibrate 탭에서 "→ Proceed to Teleop"을 추가한 것처럼, 여기에도 동일 패턴 필요.

### 5-4. 컴포넌트 적합성

- **적합한 점**
  - Step 1의 `<details>` 접이식 + compact summary 패턴은 반복 사용자의 설정 확인 속도를 높임.
  - ProcessButtons 공유 컴포넌트 사용으로 Start/Stop UX가 코드베이스 전반과 일관적.
  - Teleop Control 카드의 readiness 체크리스트(Arms/Cameras/Conflicts)가 Record 탭의 run-summary와 구조적으로 대응.

- **부적합/부족한 점**
  - 안전 배너가 항상 표시되어 "경고 피로(alarm fatigue)" 유발 위험. 실행 중에만 보여야 경고의 무게가 유지됨.
  - 동일한 "→ Go to Mapping" CTA가 두 곳에 있어 시선이 분산됨.

### 5-5. 상태-조치 매핑 결함

| 상태 | 현재 조치 | 개선 필요 |
| --- | --- | --- |
| Arms missing | "Missing ports: ..." 텍스트 | ✅ 정보 충분 |
| Cameras 0 | "→ Go to Mapping" CTA 2개 | ❌ 중복 제거 필요 |
| 실행 중 | 루프 pill + LIVE 피드 | ✅ 양호 |
| Idle 상태 | 안전 배너 항상 표시 | ❌ 실행 시에만 표시 |
| 실행 완료 후 | 아무 CTA 없음 | ❌ "→ Proceed to Record" 필요 |
| 헤더 | Ready/Action Needed만 | ❌ Running 상태 추가 필요 |

### 5-6. 개선 우선순위 (Quick Wins)

1. `P0` **헤더 verdict에 Running 상태 추가**: `running ? 'Teleop Active' : teleopReady ? 'Ready to Start' : 'Action Needed'` — Record 탭과 일관성 확보.
2. `P0` **"→ Go to Mapping" CTA 중복 제거**: Teleop Control 카드의 CTA 삭제 (Step 2에 이미 있음).
3. `P1` **안전 배너 → running 시에만 표시**: idle 시 경고 피로 방지.
4. `P1` **후속 전환 CTA 추가**: Teleop 실행 이력이 있고 idle이면 "→ Proceed to Record" 표시.

### 5-7. Quick Win 적용 (Round 2)

1. **QW-1**: Start blocker 카드 추가 — Teleop 시작 불가 원인을 badge로 즉시 노출(`Missing arm ports`, `No mapped cameras`, `conflict process`) + `→ Fix Mapping`, `→ Review Step 1` CTA.
2. **QW-2**: Step 1 compact summary 강화 — `Ports ready x/y`와 `Missing: ...`를 요약 카드에 바로 표시해 details를 열지 않아도 원인 파악 가능.
3. **QW-3**: Camera readiness 안내 강화 — Step 2 상단에 `Mapped cameras: n · Available now: m` 표시 + no-feed empty state에 `→ Open Mapping` CTA 추가.
4. **QW-4**: 모바일 모드 토글 레이아웃 수정 — `Control Mode` 영역 wrap 처리로 `Bi-Arm` 버튼 잘림 제거.

### 5-8. 적용 위치 (Round 2)

- `frontend/src/tabs/TeleopTab.tsx`
  - `teleopBlockers` 계산(useMemo) 추가
  - Step 1 compact summary에 readiness/누락 포트 수치 추가
  - Step 2 camera status 라인 + empty-state CTA 추가
  - Teleop Control에 blocker 카드(문제 badge + 액션 버튼) 추가
- `frontend/src/index.css`
  - `#tab-teleop .section-header`, `#tab-teleop .mode-toggle` 모바일 wrap 규칙 추가
  - `.teleop-guard-card` 스타일 추가
  - `.no-cameras-empty .link-btn` 간격 조정
---

## 6) Record 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (6장)
  - Desktop Top: `record-desktop-top.png`
  - Desktop Mid: `record-desktop-mid.png`
  - Desktop Bottom: `record-desktop-bottom.png`
  - Mobile Top: `record-mobile-top.png`
  - Mobile Mid: `record-mobile-mid.png`
  - Mobile Bottom: `record-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `record-reaudit-before-desktop-top.png`, `record-reaudit-before-desktop-mid.png`, `record-reaudit-before-desktop-bottom.png`
  - Before Mobile: `record-reaudit-before-mobile-top.png`, `record-reaudit-before-mobile-mid.png`, `record-reaudit-before-mobile-bottom.png`
  - After Desktop: `record-reaudit-after-desktop-top.png`, `record-reaudit-after-desktop-mid.png`, `record-reaudit-after-desktop-bottom.png`
  - After Mobile: `record-reaudit-after-mobile-top.png`, `record-reaudit-after-mobile-mid.png`, `record-reaudit-after-mobile-bottom.png`
- 관련 코드
  - `frontend/src/tabs/RecordTab.tsx` (707줄)
  - `frontend/src/index.css`

### 6-1. 핵심 목적/사용자 과업

- 목적: `계획(task/episodes/repo) → 디바이스 설정 → 카메라 확인 → 녹화 세션(Save/Discard/End 반복) → 데이터셋 확인`의 반복 가능한 데이터 수집.
- 녹화 탭은 사용자가 **가장 오래 머무르는 탭**이므로 조작 효율과 상태 인지 속도가 다른 탭보다 중요.

### 6-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1280×900)

- **헤더**: "Record Dataset" + "Action Needed" 배지 + "Recording Mode: Single / Bi-Arm" 토글 — 우수
- **2열 그리드 Row 1**: 좌측 = "Step 1: Recording Plan", 우측 = "Step 2: Device Setup"
- **2열 그리드 Row 2**: 좌측 = "Step 3: Camera Feeds", 우측 = "Episode Progress"
- **하단 고정**: `record-sticky-controls` — BLOCKED/READY 배지 + Start + Save/Discard/End
- **문제**: Step 1 좌측 카드 하단에 대규모 빈 공간 (우측 Step 2의 높이에 맞춰 늘어남)

#### Mobile (375×812)

- 단일 열 스택으로 올바르게 전환됨
- **Sticky 바가 3줄 차지**: BLOCKED 텍스트 + Start 버튼 + guard hint + Save/Discard/End → 약 120px+, 뷰포트의 ~15%
- 헤더의 "Action Needed" + "Single/Bi-Arm" 토글이 좌우로 빨듯하게 나열되나 읽혀지긴 함

### 6-3. 실제 Flow 분석 (정밀)

#### Flow A: 계획 수립 (Step 1)

1. Task Description 입력 (optional).
2. Number of Episodes 설정.
3. Dataset Repo ID 입력 + 실시간 검증.
4. Resume 체크박스 토글.

평가:
- ✅ Repo validation이 즈각 수행되어 실패 비용을 낮춤 (red border + inline error).
- ✅ Episode target/Repo ID readiness 배지가 카드 상단에 있어 즉시 판단 가능.
- ⚠️ **필드 우선순위 역전**: Task Description(optional)이 가장 위에, 필수 필드(Episodes, Repo ID)가 아래. 초보자는 optional 필드에서 멈촤서 핵심 결정을 늦춘다.
- ⚠️ **Resume 체크박스 설명이 복잡**: "Prevents crash when the target dataset folder already exists" — 사용자 입장에서는 "이전 녹화를 이어서 계속함"이 더 명확.

#### Flow B: 디바이스 설정 (Step 2)

1. Robot Type / Teleoperator Type 선택.
2. Arm Port / Arm ID 설정 (Single 4개, Bi-Arm 8개 필드).

평가:
- ✅ Teleop과 구조 일관성이 높아 학습 전이가 좋다.
- ✅ 코드 기반 확인: Zustand store를 공유하므로 Teleop에서 설정한 값이 자동 반영됨.
- ⚠️ **RobotCapabilitiesCard가 상당한 수직 공간 차지**: 쪼 스크린샷에서 Capabilities 카드가 arm port 필드들을 화면 밖으로 밀어냄. collapsible로 만들 여지.

#### Flow C: 카메라 확인 (Step 3)

1. 매핑된 카메라 확인 or "→ Go to Mapping" CTA.
2. Advanced Stream Settings 조정.

평가:
- ✅ "→ Go to Mapping" CTA가 막힘 해소 경로를 명확히 제공.
- ✅ Advanced Settings가 collapsible로 되어있어 필수가 아닌 설정을 숨김.

#### Flow D: 녹화 세션 운영

1. Sticky bar에서 Start Recording 클릭.
2. Save(→)/Discard(←)/End(Esc) 반복.
3. Episode progress bar에서 진행 확인.

평가:
- ✅ Sticky controls는 긴 폼에서 항상 접근 가능하여 매우 유효.
- ✅ 키보드 힌트가 버튼에 포함되어("✓ Save →", "✗ Discard ←", "⏹ End (Esc)") 고급 사용자 효율 우수.
- ❌ **Guard hint가 중복 표시됨**: `record-run-summary` 영역과 `ep-controls-row` 영역 양쪽에 동일한 guardHint가 노출. 특히 데스크탑에서 동시에 보임.
- ⚠️ **Save/Discard/End 버튼이 항상 표시**: 녹화 중이 아닐 때도 disabled 상태로 노출되어 시각적 노이즈 유발. idle일 때 숨기는 것이 낫다.
- ⚠️ **Mobile sticky가 3줄로 높음**: idle일 때 Save/Discard/End를 숨기면 2줄로 줄일 수 있음.

#### Flow E: 후속 전환 (녹화 완료 후)

1. Episode이 모두 완료되거나 사용자가 End를 누름.
2. **→ Dataset 탭으로 이동하여 데이터 확인.**

평가:
- ❌ **후속 전환 CTA 완전 부재**: 녹화 완료 후 "→ Go to Dataset" 안내가 없음. 사용자가 워크플로우를 스스로 기억해야 함.

### 6-4. 컴포넌트 적합성

- **적합한 점**
  - 3단계 카드 구조(Plan → Device → Camera)가 선형적 워크플로우와 일치.
  - Episode target + Repo ID readiness 배지는 at-a-glance 판단에 효과적.
  - ProcessButtons + sticky bar 패턴은 코드베이스 전반과 일관적.
  - Repo ID 실시간 검증(red border + inline error)은 모범적.

- **부적합/부족한 점**
  - 필수 필드가 optional 필드 아래에 위치 (Task Description → Episodes → Repo ID 순서가 역전).
  - Step 2 RobotCapabilitiesCard가 arm port 필드를 스크롤 밖으로 밀어냄.
  - idle 상태에서 Save/Discard/End 버튼이 disabled로 노출되어 시각적 노이즈.

### 6-5. 상태-조치 매핑 결함

| 상태 | 현재 조치 | 결함 |
| --- | --- | --- |
| 카메라 미매핑 | "→ Go to Mapping" CTA | ✅ 우수 |
| Repo 형식 오류 | Red border + inline error | ✅ 우수 |
| 프로세스 충돌 | conflictReason in sticky | ✅ 우수 |
| Arm 미연결 | Guard text in sticky | ⚠️ "→ Calibrate" 링크 없음 |
| 녹화 완료 | Progress 표시만 | ❌ "→ Go to Dataset" CTA 없음 |
| 녹화 중 오류 | Console만 | ⚠️ 인라인 요약 부족 |
| Guard hint | sticky에 표시 | ❌ 동일 텍스트 2회 중복 |

### 6-6. 개선 우선순위 (Quick Wins 포함)

#### Quick Wins (즉시 적용 가능)

1. **`P0` Guard hint 중복 제거**: `ep-controls-row` 내 `ep-guard-hint`를 삭제. `record-run-summary`에서 이미 표시 중.
2. **`P0` Idle 시 Save/Discard/End 숨기기**: `!running`일 때 3개 버튼을 렌더링에서 제외. Sticky 바 높이 감소 + 모바일 UX 개선.
3. **`P1` Step 1 필드 순서 변경**: Episodes → Repo ID → Task Description(optional) 순서로 재배치.
4. **`P1` 녹화 완료 후 "→ Go to Dataset" CTA**: episodesDone > 0 && !running일 때 record-run-summary에 표시.

#### 중기 개선

5. `P1` RobotCapabilitiesCard를 collapsible details로 변경.
6. `P2` Arm 미연결 시 guard에 "→ Go to Calibrate" 링크 추가.
7. `P2` Resume 체크박스 설명 단순화: "이전 녹화를 이어서 계속합니다".

### 6-7. Quick Win 적용 (Round 2)

1. **QW-1**: Record blocker chip + CTA 추가 — sticky bar에 `No mapped cameras`, `Missing arm ports`를 badge로 노출하고 `→ Fix Mapping` 바로가기 제공.
2. **QW-2**: Step 3 camera 상태 수치화 — `Mapped cameras: n · Feeds: m` 표시로 현재 상태를 즉시 판단 가능하게 개선.
3. **QW-3**: no-feed empty state 액션 강화 — Episode Progress empty 상태에 `→ Open Mapping` CTA 추가.
4. **QW-4**: Idle progress compact — 녹화 전에는 `—/—` 진행바 대신 `No episodes yet...` 한 줄 안내로 노이즈 축소.

### 6-8. 적용 위치 (Round 2)

- `frontend/src/tabs/RecordTab.tsx`
  - `recordBlockers` 계산(useMemo) 추가
  - Step 3 상단 camera status 라인 + empty-state CTA 추가
  - Episode Progress idle compact 조건 렌더링 추가
  - Sticky summary에 blocker badge + `→ Fix Mapping` CTA 추가
- `frontend/src/index.css`
  - `#tab-record .two-col > .card` align-self 시작점 고정(불필요한 카드 하단 빈 공간 완화)
  - `.record-blockers-row` 스타일 추가
  - 모바일 `#tab-record .mode-toggle` wrap 규칙 추가

---

## 7) Dataset 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (5장)
  - Desktop Top: `dataset-desktop-top.png`
  - Desktop Mid: `dataset-desktop-mid.png`
  - Desktop Bottom: `dataset-desktop-bottom.png`
  - Mobile Top: `dataset-mobile-top.png`
  - Mobile Bottom: `dataset-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `dataset-reaudit-before-desktop-top.png`, `dataset-reaudit-before-desktop-mid.png`, `dataset-reaudit-before-desktop-bottom.png`
  - Before Mobile: `dataset-reaudit-before-mobile-top.png`, `dataset-reaudit-before-mobile-mid.png`, `dataset-reaudit-before-mobile-bottom.png`
  - After Desktop: `dataset-reaudit-after-desktop-top.png`, `dataset-reaudit-after-desktop-mid.png`, `dataset-reaudit-after-desktop-bottom.png`
  - After Mobile: `dataset-reaudit-after-mobile-top.png`, `dataset-reaudit-after-mobile-mid.png`, `dataset-reaudit-after-mobile-bottom.png`
  - After Selected-state: `dataset-reaudit-after-selected-desktop-top.png`, `dataset-reaudit-after-selected-mobile-mid.png`
- 관련 코드
  - `frontend/src/tabs/DatasetTab.tsx` (960줄)
  - `frontend/src/index.css`

### 7-1. 핵심 목적/사용자 과업

- 목적: `데이터셋 탐색(Local/Hub) → 선택 → 에피소드 검토 → 품질검사 → 태깅 → Hub Push/Train 전환`.
- Record 탭 다음으로 가장 많이 방문하는 탭. 데이터 품질 확인 → Train 이동의 게이트웨이 역할.
- 다기능(Hub Search/Download, Quality Check, Push, Episode Replay, Curation)이 한 탭에 집중되어 정보 밀도가 높음.

### 7-2. 레이아웃 구조 분석 (스크린샷 기반)

#### Desktop (1280×900)

- **전폭 Hub 카드** → **2열 그리드** (좌: Local Datasets 리스트, 우: Detail/Replayer)
- Hub 카드는 헤더 바로 아래에 배치 — 로컬 데이터셋보다 위에 있어 시각적 위계가 Hub 우선
- Local Datasets 카드: maxHeight 800px, 스크롤 가능. 각 행에 dataset name + episodes/frames/size/modified + Actions ▾ 드롭다운
- Detail 카드: 선택 전 empty state (파일 아이콘 + "Select Latest Dataset" / "Go to Record"), 선택 후 title + stats + push panel + quality panel + episode selector + video grid + playback controls + tag buttons

#### Mobile (375×812)

- 단일 열 스택. Hub 카드 → Local list → Detail 순서로 스크롤됨
- dataset 이름이 길 경우 word-break: break-all로 처리되어 레이아웃 유지
- Empty state의 "Select Latest Dataset" / "Go to Record" 버튼이 세로 스택으로 전환되어 터치 타겟 양호

### 7-3. 실제 Flow 분석 (정밀)

#### Flow A: 로컬 데이터셋 탐색/선택

1. 탭 진입 → refreshList().
2. Local Datasets 카드에서 항목 스캔.
3. 원하는 dataset 클릭 → loadDataset() → Detail view 표시.

평가:
- ✅ 리스트 항목에 episodes/frames/size/modified가 즉시 보여 선택 판단에 충분한 정보.
- ✅ selected 상태의 시각적 구분 (`.selected` 클래스).
- ✅ Empty state의 "Select Latest Dataset" 버튼이 좌우 컨텍스트 전환 없이 한 번에 제공.
- ⚠️ **헤더 verdict가 단순 선택 여부만 표시**: `Dataset Selected` vs `Select Dataset`. 데이터셋 개수나 에피소드 정보가 없어 맥락이 부족.

#### Flow B: Hub 검색/다운로드

1. Hub 카드에서 query + tag 입력 → Search.
2. 결과 목록에서 Download 버튼 클릭.
3. 다운로드 progress polling → 성공 시 refreshList().

평가:
- ✅ 비동기 job polling + progress bar + 성공/실패 toast가 일관적.
- ✅ 실패 시 Retry Download 버튼 제공.
- ❌ **Hub 초기 상태 배지가 "Ready"**: 다른 탭의 readiness verdict와 혼동 유발. 검색 전에는 배지를 숨기거나 중립적 텍스트 사용 필요.

#### Flow C: 품질검사/태깅/Push

1. Actions ▾ → Inspect Quality → 점수 + 체크리스트 표시.
2. 에피소드 선택 → 비디오 리플레이 → Tag 버튼으로 태깅.
3. Actions ▾ → Push to Hub → progress polling.

평가:
- ✅ Quality Inspector의 score + check 목록이 상세하고 실행 가능.
- ✅ Tag 필터링 (All/Good/Bad/Review/Untagged)이 에피소드 선택기와 연결되어 큐레이션 효율적.
- ❌ **현재 에피소드의 태그 상태가 선택기 근처에 표시되지 않음**: Tag 버튼들(Good/Bad/Review/Clear)은 있지만 현재 에피소드에 어떤 태그가 지정되어 있는지 보여주지 않음.
- ❌ **품질검사 후 워크플로우 전환 CTA 없음**: 품질 OK 후 "→ Proceed to Train" 같은 다음 단계 안내 부재.

#### Flow D: 에피소드 리플레이

1. 에피소드 선택 → 비디오 그리드 로드.
2. Play/Pause + scrubber + speed 조절.
3. ⏮⏭ 에피소드 탐색.

평가:
- ✅ 다중 카메라 동기화 재생이 우수.
- ✅ 에피소드 경계(from/to timestamp) 클램핑이 정확.
- ✅ speed 선택기(0.25x~2x)가 검토 용도에 적합.

### 7-4. 컴포넌트 적합성

- **적합한 점**
  - list + detail pane 2칸 패턴이 dataset 관리에 최적.
  - Actions ▾ dropdown으로 액션 밀도 제어 (Delete 같은 위험 액션 숨김).
  - Video replayer의 primary sync + 보조 비디오 동기화 구현이 견고.
  - Hub Search/Download/Push의 비동기 job 폴링 패턴이 일관적.

- **부적합/부족한 점**
  - Hub 카드가 로컬 데이터셋보다 위에 위치 — 대부분 사용자는 로컬 데이터 우선 (P2 개선 가능).
  - Tag 버튼들이 현재 태그 상태를 시각적으로 반영하지 않음.

### 7-5. 상태-조치 매핑 결함

| 상태 | 현재 조치 | 개선 필요 |
| --- | --- | --- |
| 선택 없음 | Empty state + "Select Latest" / "Go to Record" | ✅ 양호 |
| 헤더 verdict | "Dataset Selected" / "Select Dataset" | ❌ 데이터셋 개수/에피소드 정보 표시 필요 |
| Hub 초기 상태 | "Ready" 배지 | ❌ 검색 전에는 배지 숨기기 |
| 품질검사 후 | Score + checks 표시 | ❌ "→ Proceed to Train" CTA 필요 |
| 에피소드 태그 | Tag 버튼만 (현재 태그 미표시) | ❌ 현재 태그 배지 표시 필요 |

### 7-6. 개선 우선순위 (Quick Wins)

1. `P0` **헤더 verdict에 데이터셋 개수 표시**: `selected ? `${episodes}개 에피소드` : `${count}개 데이터셋`` — 맥락 정보 증대.
2. `P0` **Hub 카드 초기 상태 "Ready" 배지 숨기기**: 검색 전에는 렌더링하지 않거나 중립적 텍스트로 교체.
3. `P1` **품질검사 후 "→ Proceed to Train" CTA**: quality.score ≥ 60일 때 표시.
4. `P1` **현재 에피소드 태그 배지 표시**: Episode 선택기 옆에 현재 tag 상태 배지.

### 7-7. Quick Win 적용 (Round 2)

1. **QW-1**: Local Datasets 로딩 상태 추가 — 초기/갱신 시 `Loading datasets...`를 명시적으로 표시해 empty-state 오해를 방지.
2. **QW-2**: Dataset row 키보드 접근성 보강 — row에 `role=button`, `tabIndex=0`, `Enter/Space` 핸들링 추가.
3. **QW-3**: Detail 빠른 액션 strip 추가 — `Inspect Quality`, `Push to Hub`, `Delete`를 상단 고정 액션으로 노출해 탐색 비용 감소.
4. **QW-4**: 품질 워크플로우 배너 추가 — quality 미실행 상태에서 `→ Inspect Quality Now` CTA를 강조해 Train 전 검증 루프를 명확화.

### 7-8. 적용 위치 (Round 2)

- `frontend/src/tabs/DatasetTab.tsx`
  - `loadingDatasets` 상태 + `refreshList` finally 로딩 종료 처리 추가
  - dataset row keyboard 접근성(`role`, `tabIndex`, `onKeyDown`) 추가
  - detail 상단 `dataset-quick-actions` 버튼 라인 추가
  - quality 미실행 시 `dataset-workflow-banner` + `→ Inspect Quality Now` CTA 추가
- `frontend/src/index.css`
  - `.dataset-quick-actions`, `.dataset-workflow-banner` 스타일 추가
  - 모바일 `#tab-dataset .section-header` wrap 규칙 추가
---

## 8) Train 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (before)
  - Desktop: `train-desktop-top.png`, `train-desktop-mid.png`, `train-desktop-bottom.png`, `train-desktop-end.png`
  - Mobile: `train-mobile-top.png`, `train-mobile-mid.png`, `train-mobile-bottom.png`, `train-mobile-end.png`
- 관련 코드
  - `frontend/src/tabs/TrainTab.tsx` (682줄)
  - `frontend/src/index.css` (.train-device-warning)

### 8-1. 핵심 목적/사용자 과업

- 목적: `환경 preflight 통과 → 데이터/하이퍼파라미터 설정 → 학습 시작 → 진행/손실 모니터링 → 체크포인트 → Eval 전이`
- 전체 파이프라인의 가장 시간 소모적 단계이므로 모니터링 신뢰성과 에러 복구가 핵심.

### 8-2. 실제 Flow 분석 (정밀, 스크린샷 기반)

#### Flow A: 시작 전 게이트 (Preflight)
1. device preflight 자동 실행 (tab 진입 시)
2. 실패 시 `train-device-warning` 에서 원인 표시 + `Install CUDA PyTorch (Nightly)` 또는 `Run Fix` 버튼 제공
3. 5초 간격 자동 재체크로 설치 완료 즉시 해제
4. `Training Progress` 상태 뱃지가 `BLOCKED` → `IDLE` → `RUNNING` 3단계 전이

**스크린샷 관찰 (desktop-top)**:
- Header verdict "Action Needed" 정상 표시 ✅
- CUDA 에러 메시지가 card 내부 `train-device-warning`에 명확히 표시 ✅
- 하단 recovery-action 패널에 "Install CUDA PyTorch (Nightly)" 버튼 ✅

**문제 발견**: 페이지 하단 `ep-guard-hint`에 동일한 preflight 에러 메시지가 **중복 표시**됨. card 내부에서 이미 충분히 표시되고 있으므로 불필요한 반복.

#### Flow B: 학습 설정
1. Policy Type 선택 (ACT/Diffusion/TD-MPC2)
2. Dataset Source 토글 (Local/Hugging Face)
3. Local dataset 선택 (또는 HF repo ID 입력)
4. Training Steps + preset 버튼 (Quick 1K / Standard 50K / Full 100K)
5. Advanced Params 접기 (Batch Size, Learning Rate)
6. Compute Device (CUDA/CPU/MPS)

**스크린샷 관찰**:
- preset 버튼이 Training Steps 라벨과 같은 줄에 잘 배치됨 ✅
- Advanced Params가 `<details>` 접기로 기본 숨김 — 복잡도 관리 우수 ✅
- local dataset 없을 때 warn 배너 + 3개 CTA (Go to Record / Open Dataset / Use Hugging Face) 잘 구현됨 ✅

#### Flow C: 런타임 모니터링
1. Training Progress 바 (step / total, loss, ETA)
2. Loss Trend 캔버스 차트
3. OOM 감지 → 자동 batch size 반감 + retry 제안
4. GPU Status (utilization + VRAM 실시간)
5. Checkpoints 리스트

**스크린샷 관찰 (desktop-mid, desktop-bottom)**:
- Training Progress 섹션이 idle/blocked에서도 "Step: -- / --", "Loss: --", "ETA: --" + 빈 Loss Trend 차트(200px)로 넓은 공간 차지. 학습 전에는 불필요한 정보 과다 노출.
- Checkpoints/GPU 2-column grid는 데스크톱에서 잘 분할됨 ✅
- GPU Status에 utilization + VRAM bar 모두 표시 ✅

**모바일 관찰 (mobile-bottom)**:
- `gridTemplateColumns: '1fr 1fr'` 하드코딩으로 인해 390px에서 GPU Status 칼럼이 심하게 찌그러짐
- "GPU Utilization"이 2줄 줄바꿈, "VRAM Usage / 8151MB"도 줄바꿈 — 가독성 심각 훼손
- Loss Trend 차트 height=200px가 모바일에서도 동일 — 상대적으로 과대

#### Flow D: 완료 후 전이
- 학습 완료 후 체크포인트가 생성되지만, Eval 탭으로의 전이 CTA가 없음
- 사용자는 사이드바에서 수동으로 Eval을 찾아야 함
- 다른 탭(Calibrate→Teleop, Teleop→Record, Record→Dataset, Dataset→Train)에서는 전이 CTA 패턴이 확립됨

### 8-3. 컴포넌트 적합성

| 컴포넌트 | 적합 | 비고 |
|---|---|---|
| Training Guide banner | ✅ | 시간 소요/종료 주의사항 명확 |
| Configuration card | ✅ | policy + dataset + steps + device 한 카드에 논리적 그룹 |
| Preset 버튼 | ✅ | 속도-정확도 트레이드오프 빠른 결정 지원 |
| Advanced Params details | ✅ | 복잡도 숨김 잘 됨 |
| Preflight gate | ✅ | 에러→액션→자동재체크 루프 탄탄 |
| Training Progress | ⚠️ | idle/blocked에서 빈 차트 노출 불필요 |
| Checkpoints/GPU grid | ⚠️ | 모바일 반응형 미적용 |
| ProcessButtons | ✅ | disabled 조건 명확 |
| OOM recovery | ✅ | 자동 batch halving 잘 설계 |

### 8-4. 상태-조치 매핑 결함

| 상태 | 조치 | 평가 |
|---|---|---|
| Preflight fail | Install/Fix 버튼 | ✅ 강점 |
| Local dataset 없음 | warn 배너 + 3 CTA | ✅ 강점 (이전 개선 반영) |
| OOM | reduce & retry | ✅ 강점 |
| Training 완료 | Eval CTA 없음 | ❌ 전이 단절 |
| idle/blocked | 빈 progress+chart 노출 | ⚠️ 정보 과다 |
| Preflight fail + 하단 hint | 동일 텍스트 중복 | ❌ 중복 |

### 8-5. Quick Win 적용 (4개)

1. **QW-1**: Guard hint 중복 제거 — `ep-guard-hint` div (line 678) 삭제. preflight 에러가 이미 card 내부 `train-device-warning`에 표시됨.
2. **QW-2**: Training Progress 섹션 idle 축소 — running이 아닐 때 Loss Trend 차트를 숨기고, progress 바만 compact 표시.
3. **QW-3**: Checkpoints/GPU grid 모바일 반응형 — CSS 클래스 `train-info-grid` 추가, 모바일에서 `grid-template-columns: 1fr`.
4. **QW-4**: Post-training "→ Proceed to Eval" CTA — `checkpoints.length > 0 && !running` 일 때 Eval 전이 버튼.

### 8-6. Quick Win 적용 (Round 2)

1. **QW-1**: Train blocker 카드 추가 — `!running && !trainReady` 상태에서 blocker chip(`preflight/device/dataset/conflict`) + `→ Switch to CPU`, `→ Open Dataset`, `→ Go to Record` CTA 제공.
2. **QW-2**: Training Steps 구역 가독성 개선 — presets를 `train-step-presets` 래퍼로 분리해 줄바꿈 시에도 정렬이 유지되도록 개선.
3. **QW-3**: Advanced Params 반응형 grid — `train-advanced-grid` 클래스로 2열→모바일 1열 자동 전환.
4. **QW-4**: idle progress compact + 접근성 보강 — running 전에는 `No training signal yet...` 한 줄 안내만 표시하고, progress fill에 `role=progressbar`/`aria-*` 추가.

### 8-7. 적용 위치 (Round 2)

- `frontend/src/tabs/TrainTab.tsx`
  - `trainBlockers` 계산(useMemo) 추가
  - header 아래 `train-blocker-card` + CTA 추가
  - `train-steps-row`, `train-step-presets` 구조로 presets 영역 정리
  - `train-advanced-grid` 클래스 적용
  - progress bar ARIA 속성 추가 + idle metrics compact 렌더링 추가
- `frontend/src/index.css`
  - `.train-blocker-card`, `.train-blocker-chip-row`, `.train-blocker-actions` 추가
  - `.train-steps-row`, `.train-step-presets`, `.train-advanced-grid` 추가
  - 모바일 `#tab-train .section-header`, `#tab-train .mode-toggle` wrap 규칙 추가

---

## 9) Eval 탭 (심층 재점검 — 2026-02-25 스크린샷 기반)

- 스크린샷 (before)
  - Desktop: `eval-desktop-top.png`, `eval-desktop-mid.png`, `eval-desktop-bottom.png`
  - Mobile: `eval-mobile-top.png`, `eval-mobile-mid.png`, `eval-mobile-bottom.png`
- 스크린샷 (round 2)
  - Before Desktop: `eval-desktop-top.png`, `eval-desktop-mid.png`
  - Before Mobile: `eval-mobile-top.png`, `eval-mobile-mid.png`
  - After Desktop: `eval-reaudit-after-desktop-top.png`, `eval-reaudit-after-desktop-mid.png`
  - After Mobile: `eval-reaudit-after-mobile-top.png`, `eval-reaudit-after-mobile-mid.png`
- 관련 코드
  - `frontend/src/tabs/EvalTab.tsx` (510줄)

### 9-1. 핵심 목적/사용자 과업

- 목적: `checkpoint 선택 → config 확정 → 실행 → 진행/결과 요약 해석 → 재학습 또는 배포 결정`
- 파이프라인 최종 단계 — Train→Eval CTA로 진입, 여기서 루프 닫힘

### 9-2. 실제 Flow 분석 (정밀, 스크린샷 기반)

#### Flow A: 시작 전 준비
1. Checkpoint 선택 (dropdown) 또는 수동 Policy Path 입력
2. Dataset Repo ID 입력 (validation: username/dataset 형식)
3. Episodes 수 설정 (default: 10)
4. Compute Device 선택 + preflight 확인

**스크린샷 관찰 (desktop-top)**:
- Header verdict "Action Needed" ✅
- Evaluation Guide 배너 명확 ✅
- Checkpoint selector + Policy Path 자동채움 ✅
- Preflight 경고 + Install CUDA PyTorch 버튼 ✅ (Train과 동일 패턴)

#### Flow B: 실행 및 모니터링
1. 6-state progress badge (IDLE/STARTING/RUNNING/STOPPED/COMPLETED/ERROR)
2. Episodes / Reward / Success 실시간 표시
3. Evaluation Summary: Final Reward, Final Success, Best/Worst Episode
4. Start/Elapsed/End/Update 시간 표시

**스크린샷 관찰 (desktop-mid)**:
- Progress 섹션이 idle에서도 "Episodes: -- / --", "Reward: --", "Success: --" 모두 표시 — 빈 정보 과다
- Evaluation Summary가 idle에서도 "Start -- · Elapsed -- · End -- · Update --" + 4개 대시 — 불필요한 섹션 노출
- Guard hint에 CUDA 에러가 중복 표시 (card 내부 + 하단 모두)
- "Re-run 3 Episodes" + "Go to Train" CTA가 Summary 내부에 있음 ✅

#### Flow C: 결과 해석 및 다음 액션
- Eval 완료 후 "Go to Train" 으로 파라미터 조정 루프 가능
- "Re-run 3 Episodes" 로 빠른 재검증
- 파이프라인 종료점으로서 "새 사이클 시작" CTA가 없음

### 9-3. 컴포넌트 적합성

| 컴포넌트 | 적합 | 비고 |
|---|---|---|
| Header verdict | ✅ | 3상태 (Running/Ready/Action Needed) |
| Evaluation Guide | ✅ | 핵심 설정 요약 명확 |
| Config card | ✅ | Checkpoint selector + Policy Path 연동 우수 |
| Preflight gate | ✅ | Train과 동일 패턴 일관성 |
| 6-state progress badge | ✅ | 상태 머신 탄탄 |
| Eval Summary (idle) | ⚠️ | 실행 전에 빈 대시 섹션 노출 |
| Guard hint | ❌ | Preflight 에러 중복 |
| Re-run + Go to Train | ✅ | 다음 액션 연결 |

### 9-4. 상태-조치 매핑 결함

| 상태 | 조치 | 평가 |
|---|---|---|
| Preflight fail | Install/Fix 버튼 | ✅ 강점 |
| Repo ID 오류 | 인라인 guard hint | ✅ (line 410) |
| Eval 완료 | Re-run + Go to Train | ✅ |
| Guard hint 중복 | card내부 + 하단 모두 표시 | ❌ |
| idle 상태 | Summary 전체 노출 | ⚠️ 불필요 |

### 9-5. Quick Win 적용 (4개)

1. **QW-1**: Guard hint 중복 제거 — `ep-guard-hint` (line 506) 삭제 + `startGuardReason` 미사용 변수 제거
2. **QW-2**: Evaluation Summary idle 숨김 — `progressStatus !== 'idle'` 일 때만 Summary 섹션 표시
3. **QW-3**: Evaluation Progress idle compact — idle에서 진행률 상세(Episodes/Reward/Success) 숨김
4. **QW-4**: 파이프라인 루프 CTA — Eval 완료/중단 시 "↻ Record New Data" 버튼 추가

### 9-6. Quick Win 적용 (Round 2)

1. **QW-1**: Eval blocker 카드 추가 — `!running && !evalReady` 상태에서 blocker chip(`preflight/repo/conflict`) + `→ Switch to CPU`, `→ Open Dataset`, `→ Go to Train` CTA 제공.
2. **QW-2**: Progress idle compact 개선 — idle에서 Episodes/Reward/Success 상세 대신 `Start evaluation to populate...` 안내만 노출.
3. **QW-3**: Progress 접근성 보강 — progress fill에 `role=progressbar` 및 `aria-*` 속성 추가.
4. **QW-4**: Summary 시간/지표 반응형 개선 — `eval-summary-time` wrap, `eval-summary-grid` 모바일 1열 전환.

### 9-7. 적용 위치 (Round 2)

- `frontend/src/tabs/EvalTab.tsx`
  - `evalBlockers` 계산(useMemo) 추가
  - header 아래 `eval-blocker-card` + CTA 추가
  - `showProgressDetails` 조건으로 idle progress compact 렌더링 적용
  - progress fill ARIA 속성 추가
  - summary 영역에 `eval-summary-time`, `eval-summary-grid` 클래스 적용
- `frontend/src/index.css`
  - `.eval-blocker-card`, `.eval-blocker-chip-row`, `.eval-blocker-actions` 추가
  - `.eval-summary-time`, `.eval-summary-grid` 추가
  - 모바일 `#tab-eval .section-header` wrap 규칙 추가

---

## 진행 상태

- Status~Eval **9개 탭 전체**를 동일 템플릿(목적/Flow/컴포넌트/상태-조치/Quick Win)으로 심층 재작성 완료.
- Round 2 재점검 완료: Status, Teleop, Record, Dataset, Train, Eval (각 4개 Quick Win 추가 적용).
- 최종 워크플로우 전이 체인 확인: Mapping → Motor Setup → Calibrate → Teleop → Record → Dataset → Train → Eval → Record(루프).
