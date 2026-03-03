# LeStudio vs lerobot-studio — 프론트엔드 아키텍처 비교

최종 갱신: 2026-02-25

---

## 1. 기술 스택 비교

| 항목 | lerobot-studio (Old) | LeStudio (New) |
|------|----------------------|----------------|
| **프레임워크** | Vanilla JS (No framework) | React 19 |
| **타입 시스템** | 없음 | TypeScript |
| **빌드 도구** | 없음 (정적 서빙) | Vite 7 |
| **상태 관리** | Global JS 변수 + DOM 직접 조작 | Zustand 스토어 |
| **번들러** | 없음 | Vite (ESBuild + Rollup) |
| **CSS** | 인라인 + style.css | CSS 변수 기반 일반 CSS |
| **파일 구조** | 단일 index.html + workbench_*.js | 컴포넌트 기반 SPA |

---

## 2. 파일 구조 비교

### lerobot-studio (Old) — Vanilla JS

```
lerobot-studio/
├── src/lerobot_studio/
│   ├── server.py                     # FastAPI 서버 (~1500줄)
│   ├── static/
│   │   ├── index.html                # 단일 HTML (모든 탭 포함)
│   │   ├── style.css                 # 전역 스타일
│   │   ├── main.js                   # 엔트리포인트 + 탭 라우팅
│   │   ├── workbench_status.js       # Status 탭
│   │   ├── workbench_device_setup.js # Mapping 탭
│   │   ├── workbench_motor_setup.js  # Motor Setup 탭
│   │   ├── workbench_calibrate.js    # Calibration 탭
│   │   ├── workbench_teleop.js       # Teleop 탭
│   │   ├── workbench_record.js       # Record 탭
│   │   ├── workbench_dataset.js      # Dataset 탭
│   │   ├── workbench_train.js        # Train 탭
│   │   └── workbench_eval.js         # Eval 탭
│   └── ...
```

- **패턴**: 각 `workbench_*.js`가 DOM을 직접 생성/조작
- **상태**: 전역 변수로 관리
- **이벤트**: `addEventListener` 직접 바인딩
- **장점**: 빌드 불필요, 즉시 수정 가능
- **단점**: 타입 안전 없음, 상태 추적 어려움, 테스트 불가

### LeStudio (New) — React + TypeScript

```
LeStudio/
├── frontend/
│   └── src/
│       ├── App.tsx                    # 루트 컴포넌트 (탭 라우팅, 테마, 단축키)
│       ├── main.tsx                   # React 엔트리포인트
│       ├── store/index.ts             # Zustand 전역 스토어
│       ├── lib/
│       │   ├── api.ts                 # REST API 클라이언트
│       │   └── types.ts              # TypeScript 타입 정의
│       ├── tabs/                      # 9개 탭 컴포넌트
│       │   ├── StatusTab.tsx          # 442줄
│       │   ├── DeviceSetupTab.tsx     # 980줄 (Mapping)
│       │   ├── MotorSetupTab.tsx      # 142줄
│       │   ├── CalibrateTab.tsx       # 893줄
│       │   ├── TeleopTab.tsx          # 714줄
│       │   ├── RecordTab.tsx          # 787줄
│       │   ├── DatasetTab.tsx         # 1004줄 (최대)
│       │   ├── TrainTab.tsx           # 786줄
│       │   └── EvalTab.tsx            # 631줄
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx       # 앱 셸 (헤더 + 사이드바 + 메인)
│       │   │   └── Sidebar.tsx        # 사이드바 네비게이션
│       │   └── shared/
│       │       ├── LogConsole.tsx      # 로그 콘솔
│       │       ├── ConsoleDrawer.tsx   # 콘솔 서랍
│       │       ├── ProcessButtons.tsx  # 프로세스 제어 버튼
│       │       ├── MappedCameraRows.tsx # 카메라 매핑 행
│       │       ├── ProfileSelector.tsx # 프로필 선택기
│       │       └── Toast.tsx          # 토스트 알림
│       └── hooks/
│           ├── useConfig.ts           # 설정 로딩/관리
│           ├── useProcess.ts          # 프로세스 실행 상태
│           ├── useWebSocket.ts        # WebSocket 연결
│           └── useMappedCameras.ts    # 카메라 디바이스 탐색/매핑
├── src/lestudio/
│   ├── server.py                      # FastAPI 서버 (~2770줄)
│   ├── device_registry.py             # LeRobot 3-Registry (~540줄)
│   ├── command_builders.py            # CLI 명령 빌더
│   ├── process_manager.py             # subprocess 관리
│   ├── teleop_bridge.py               # LeRobot teleop 래퍼
│   ├── record_bridge.py               # LeRobot record 래퍼
│   ├── camera_patch.py                # OpenCVCamera SHM 패치
│   └── static/                        # Vite 빌드 결과물
```

---

## 3. 탭별 코드 매핑

| 탭 | Old (Vanilla JS) | New (React/TS) | New 줄 수 |
|----|-------------------|----------------|-----------|
| Status | `workbench_status.js` | `StatusTab.tsx` | 442 |
| Mapping | `workbench_device_setup.js` | `DeviceSetupTab.tsx` | 980 |
| Motor Setup | `workbench_motor_setup.js` | `MotorSetupTab.tsx` | 142 |
| Calibration | `workbench_calibrate.js` | `CalibrateTab.tsx` | 893 |
| Teleop | `workbench_teleop.js` | `TeleopTab.tsx` | 714 |
| Record | `workbench_record.js` | `RecordTab.tsx` | 787 |
| Dataset | `workbench_dataset.js` | `DatasetTab.tsx` | 1004 |
| Train | `workbench_train.js` | `TrainTab.tsx` | 786 |
| Eval | `workbench_eval.js` | `EvalTab.tsx` | 631 |

---

## 4. 상태 관리 비교

### Old: 전역 변수 패턴
```javascript
// main.js
let currentTab = 'status';
let wsConnection = null;
let processStates = {};

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.hidden = true);
    document.getElementById(`tab-${tabName}`).hidden = false;
    currentTab = tabName;
}
```

### New: Zustand 스토어
```typescript
// store/index.ts
interface LeStudioState {
    activeTab: string;
    config: Record<string, unknown>;
    procStatus: Record<string, boolean>;
    wsReady: boolean;
    logLines: Record<string, LogLine[]>;
    toasts: Toast[];
    setActiveTab: (tab: string) => void;
    setProcStatus: (status: Record<string, boolean>) => void;
}

const useLeStudioStore = create<LeStudioState>((set) => ({
    // ... implementation
}));
```

---

## 5. 통신 패턴 비교

### REST API (동일)
- 두 버전 모두 `/api/*` 엔드포인트 사용
- GET: 상태 조회, POST: 프로세스 시작/중지

### WebSocket (동일)
- 두 버전 모두 `/ws` 엔드포인트로 stdout/stderr 스트리밍
- Old: `new WebSocket()` 직접 사용
- New: `useWebSocket.ts` 훅으로 캡슐화 + Zustand 디스패치

---

## 6. 마이그레이션 영향 분석

### 긍정적 변화
1. **타입 안전성**: TypeScript로 런타임 에러 사전 방지
2. **컴포넌트 재사용**: `shared/` 컴포넌트로 중복 코드 제거
3. **상태 예측성**: Zustand 단일 스토어로 상태 흐름 명확
4. **커스텀 훅**: `useProcess`, `useMappedCameras` 등 로직 캡슐화
5. **빌드 최적화**: Vite tree-shaking, 코드 스플릿

### 부정적 변화 / 주의점
1. **빌드 스텝 추가**: `npm run build` 필요 (Old는 파일 수정 즉시 반영)
2. **러닝 커브**: React/TS 숙련도 필요 (로봇 커뮤니티는 Python 중심)
3. **UI 퇴보 항목**: Install Needed 배지, 접근성 라벨 등 마이그레이션 과정에서 누락
4. **node_modules**: 프론트엔드 의존성 ~200MB 추가

---

## 7. 참고: LeRobot 결합 경계 (AGENTS.md 규칙)

원칙상 `lerobot.*` import는 아래 4개 파일에만 허용한다:
1. `teleop_bridge.py` — teleop 실행
2. `record_bridge.py` — 녹화 실행
3. `camera_patch.py` — SHM 프레임 공유
4. `device_registry.py` — Registry 동적 탐색

현재 코드에는 `cli.py`의 `find_lerobot_src()`에 `import lerobot` 예외가 1건 있으며, 이는 정리 대상이다.
