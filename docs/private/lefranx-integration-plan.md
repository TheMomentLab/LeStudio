# LeStudio — LeFranX 통합 계획서

최종 갱신: 2026-02-27
상태: 초안 (Draft) — v1

---

## 1. 개요

### 1.1 LeFranX란

[LeFranX](https://github.com/wengmister/LeFranX)는 **Franka FER(Franka Emika Research) 로봇팔 + XHand 덱스터러스 핸드**를 HuggingFace LeRobot 프레임워크에 통합한 확장 패키지다.
[LeVR 논문](https://arxiv.org/abs/2509.14349) (Northwestern University, 2025)의 실제 구현체이며, VR 기반 모방학습 데이터 수집을 위한 완전한 텔레옵 파이프라인을 제공한다.

### 1.2 세 가지 컴포넌트

```
LeFranX
├── franka_server/           # C++ 실시간 서버 (RTPC에서 실행, libfranka + ruckig)
├── franka_xhand_teleoperator/  # Python 패키지 (VR 메시지 라우터 pybind11 C++ 모듈 포함)
└── src/lerobot/             # LeRobot 표준 클래스 구현체 (복사 설치 방식)
    ├── robots/franka_fer/
    ├── robots/xhand/
    ├── robots/franka_fer_xhand/
    └── teleoperators/franka_fer_vr/, xhand_vr/, franka_fer_xhand_vr/
```

### 1.3 통합 목표

LeStudio에서 **Franka FER + XHand + VR 텔레옵** 전체 파이프라인을 GUI로 제어한다:
- franka_server 프로세스 시작/중지/모니터링
- Meta Quest VR 헤드셋 ADB 연결 상태 관리
- FrankaFER 로봇 + XHand 텔레옵 선택 및 실행
- VR 텔레옵 → 데이터 녹화까지 기존 Teleop/Record 탭 재사용

---

## 2. 라이선스 분석

### 2.1 컴포넌트별 라이선스 매트릭스

| 컴포넌트 | 라이선스 | 상업적 사용 | 재배포 | 카피레프트 | 비고 |
|---------|---------|-----------|-------|----------|------|
| **LeFranX** | Apache-2.0 | ✅ | ✅ (저작권 고지 유지) | ❌ | 핵심 Python 클래스 |
| **HuggingFace LeRobot** | Apache-2.0 | ✅ | ✅ (저작권 고지 유지) | ❌ | 기반 프레임워크 |
| **LeStudio** | Apache-2.0 | ✅ | ✅ | ❌ | 본 프로젝트 |
| **libfranka** | Apache-2.0 | ✅ | ✅ (저작권 고지 유지) | ❌ | C++ 로봇 제어 라이브러리 |
| **ruckig** | MIT | ✅ | ✅ | ❌ | C++ 궤적 생성 라이브러리 |
| **dex-retargeting** | MIT | ✅ | ✅ | ❌ | Python 핸드 리타게팅 |
| **franka_xhand_teleoperator** | Apache-2.0 (LeFranX 동일) | ✅ | ✅ | ❌ | VR 라우터 pybind11 모듈 포함 |
| **RobotEra XHand wheel** | **독점 소유권 (Proprietary)** | ❓ | ❌ | N/A | ⚠️ 재배포 불가 |

### 2.2 호환성 판정

**전체 스택은 Apache-2.0 / MIT 기반으로 라이선스 충돌 없음.**

모든 오픈소스 컴포넌트(LeFranX, libfranka, ruckig, dex-retargeting)는 Apache-2.0 또는 MIT 라이선스로, LeStudio(Apache-2.0)와 완전히 호환된다. 상업적 사용, 수정, 재배포 모두 허용되며 저작권 고지만 유지하면 된다.

### 2.3 레드플래그: RobotEra XHand 독점 패키지

```
⚠️  xhand_controller-1.1.7-cp312-cp312-linux_x86_64.whl
    출처: RobotEra 기업 내부 배포 (https://di6kz6gamrw.feishu.cn/...)
    라이선스: 명시 없음 (사실상 독점)
    재배포: 불가
```

**LeStudio가 취해야 할 조치:**
1. XHand wheel을 LeStudio 코드베이스나 배포물에 포함하지 않는다.
2. 사용자가 직접 RobotEra에서 다운로드 + 설치하도록 문서화한다.
3. XHand 관련 기능은 `franka_xhand_teleoperator` 설치 여부를 런타임에 감지하여 조건부 활성화한다.

### 2.4 `franka_server` 바이너리 재배포 시 고려사항

`franka_server`는 컴파일된 C++ 바이너리다. LeStudio가 이를 직접 배포(빌드된 바이너리 포함)할 경우:
- libfranka(Apache-2.0) NOTICE 파일 포함 필요
- ruckig(MIT) 저작권 고지 포함 필요

단, LeStudio는 franka_server를 소스 빌드 + 별도 설치 방식으로만 안내하면 위 의무가 경감된다. 현재 계획상 LeStudio가 바이너리를 직접 배포하지 않으므로 문제 없음.

### 2.5 Apache-2.0 필수 의무사항 (실행 체크리스트)

LeFranX 코드를 LeStudio에 통합할 때:

- [ ] LeFranX 원본 LICENSE 파일 참조 유지 (복사 파일에 출처 주석 추가)
- [ ] LeFranX 저작자 (Zhengyang Kris Weng, Northwestern) 크레딧 — NOTICE 파일 또는 About 페이지
- [ ] 수정된 파일에 "수정됨" 명시 (파일 상단 주석)
- [ ] franka_server의 libfranka/ruckig 라이선스 고지 — 설치 가이드 문서에 포함

---

## 3. 기술 아키텍처 분석

### 3.1 FrankaFER 로봇 클래스 인터페이스

`src/lerobot/robots/franka_fer/franka_fer.py` — 표준 LeRobot `Robot` 서브클래스

**통신 방식**: TCP 소켓 → `franka_server` (기본: `192.168.18.1:5000`)

**텍스트 기반 프로토콜:**
```
GET_STATE        → "STATE pos0..pos6 vel0..vel6 ee00..ee15"
SET_POSITION p0..p6 → "OK" | (오류 시 무응답)
MOVE_TO_START p0..p6 → "OK"
DISCONNECT       → (소켓 종료)
STOP             → "OK"
```

**주요 메서드:**
| 메서드 | 설명 |
|-------|------|
| `connect(calibrate=True)` | franka_server 헬스체크 후 TCP 소켓 연결 |
| `disconnect()` | DISCONNECT 명령 전송 + 소켓 종료 |
| `get_observation()` | 7 관절 위치/속도 + EE pose(4×4 행렬) + 카메라 프레임 반환 |
| `send_action(action)` | 7 관절 목표 위치 전송 (선택적 안전 제한 적용) |
| `reset_to_home()` | MOVE_TO_START + VR 초기 포즈 리셋 |
| `stop()` | 비상 정지 (STOP 명령) |
| `is_calibrated` | 항상 True (Franka는 공장 캘리브레이션) |

**LeRobot 레지스트리 등록 방식:**
```python
@RobotConfig.register_subclass("franka_fer")
@dataclass
class FrankaFERConfig(RobotConfig):
    server_ip: str = "192.168.18.1"
    server_port: int = 5000
    home_position: list[float] = [0, -0.785, 0, -2.356, 0, 1.571, -0.9]
    max_relative_target: float | None = None
    cameras: dict[str, CameraConfig] = {}
```

`device_registry.py`가 `RobotConfig._subclass_registry`를 쿼리할 때 `"franka_fer"` 타입이 자동 포함됨.

### 3.2 Teleoperator 클래스 목록

| 타입 등록명 | 목적 | 입력 |
|------------|------|-----|
| `franka_fer_vr` | Franka 팔만 VR 제어 | Meta Quest 손목 포즈 |
| `xhand_vr` | XHand만 VR 제어 | Meta Quest 핸드 랜드마크 |
| `franka_fer_xhand_vr` | 팔 + 손 동시 VR 제어 | 손목 포즈 + 랜드마크 |

### 3.3 VR 연결 아키텍처

```
Meta Quest (안드로이드 앱)
        │
        │ USB ADB 연결
        │ adb reverse tcp:8000 tcp:8000
        ↓
PC (LeStudio 실행 중)
        │
        │ TCP:8000
        ↓
VRRouterManager (싱글톤)
    → vr_message_router (pybind11 C++ 모듈)
        ├── wrist_data  → franka_fer_vr teleoperator → FrankaFER.send_action()
        └── landmarks_data → xhand_vr teleoperator → XHand.send_action()
```

**VRRouterManager 상태 API:**
```python
{
    "manager_initialized": bool,
    "router_started": bool,
    "reference_count": int,      # 현재 연결된 teleoperator 수
    "adb_setup": bool,           # ADB reverse 설정 완료 여부
    "tcp_port": int,             # 기본 8000
    "tcp_connected": bool        # Meta Quest 실제 연결 여부
}
```

### 3.4 franka_server IPC 구조

```
franka_server [YOUR_FRANKA_ROBOT_IP]
    │
    │ 이더넷/WiFi (libfranka 프로토콜)
    ↓
Franka FER 로봇 (실시간 제어)

franka_server
    │
    │ TCP:5000 (텍스트 프로토콜)
    ↓
FrankaFER Python 클래스 (LeRobot)
```

`franka_server`는 별도 프로세스로 실행되어야 하며, LeStudio의 `ProcessManager`로 관리 가능하다.

### 3.5 LeStudio 자동 인식 확인

LeFranX `src/lerobot/` 파일들을 lerobot 환경에 copy-merge하면:

| 자동 인식 항목 | 경로 | 상태 |
|-------------|------|-----|
| `franka_fer` 로봇 타입 | DeviceSetup 탭 Robot 드롭다운 | ✅ 즉시 |
| `franka_fer_vr` 텔레오퍼레이터 | DeviceSetup 탭 Teleop 드롭다운 | ✅ 즉시 |
| `xhand_vr` 텔레오퍼레이터 | 동상 | ✅ (XHand wheel 설치 시) |
| `franka_fer_xhand_vr` 텔레오퍼레이터 | 동상 | ✅ (XHand wheel 설치 시) |
| 캘리브레이션 | CalibrateTab | ✅ (`is_calibrated` = True → 건너뜀) |
| Teleop 실행 | TeleopTab | ✅ (franka_server 실행 중 시) |
| Record 실행 | RecordTab | ✅ |

**단, franka_server가 실행 중이지 않으면 FrankaFER.connect()가 ConnectionError를 발생시킨다.**
이것이 새 UI가 필요한 핵심 이유다.

---

## 4. 통합 설계

### 4.1 전체 아키텍처 (통합 후)

```
LeStudio UI
├── Setup 그룹
│   ├── StatusTab (기존) — franka_server 프로세스 상태 표시 추가
│   ├── DeviceSetupTab (기존) — FrankaFER + XHand 자동 인식
│   ├── [NEW] FrankaSetupTab — franka_server 관리 + VR 연결 설정
│   └── CalibrateTab (기존) — FrankaFER는 캘리브레이션 스킵
│
├── Operate 그룹
│   ├── TeleopTab (기존) — franka_fer_vr / xhand_vr / franka_fer_xhand_vr 선택
│   └── RecordTab (기존) — 기존과 동일
│
└── Data / ML 그룹 (변경 없음)

Backend 변경
├── franka_bridge.py (신규) — franka_server subprocess 관리
├── server.py — /api/franka/* 엔드포인트 추가
└── (device_registry.py 변경 없음 — 자동 탐색)
```

### 4.2 신규 백엔드: `franka_bridge.py`

LeRobot 결합 경계 원칙에 따라 **lerobot.* import 없이** franka_server 프로세스만 관리한다.

```python
# src/lestudio/franka_bridge.py
# lerobot.* import 없음 — franka_server는 별도 바이너리

class FrankaServerManager:
    """franka_server C++ 바이너리의 생명주기 관리"""
    
    def start(self, robot_ip: str, server_binary_path: str) -> int:
        """franka_server를 subprocess로 시작, PID 반환"""
        # ProcessManager.start() 패턴 재사용
    
    def stop(self) -> bool:
        """franka_server 종료 (SIGTERM)"""
    
    def health_check(self, host: str = "192.168.18.1", port: int = 5000) -> bool:
        """TCP 소켓 연결 가능 여부 확인 (2초 타임아웃)"""
        # socket.connect_ex() — FrankaFER._health_check()와 동일 로직
    
    def get_status(self) -> dict:
        """{"running": bool, "pid": int | None, "reachable": bool}"""

class VRConnectionManager:
    """ADB + VR 라우터 연결 상태 관리"""
    
    def check_adb_device(self) -> dict:
        """adb devices 실행 → Meta Quest 연결 여부 반환"""
        # {"connected": bool, "device_id": str | None}
    
    def setup_adb_reverse(self, tcp_port: int = 8000) -> bool:
        """adb reverse tcp:8000 tcp:8000 실행"""
    
    def cleanup_adb_reverse(self, tcp_port: int = 8000) -> None:
        """adb reverse --remove tcp:8000"""
    
    def check_vr_router_status(self) -> dict:
        """VRRouterManager.get_status() 결과를 REST로 노출"""
        # lerobot.* 직접 import 없이 별도 subprocess로 조회하거나,
        # teleop 프로세스가 실행 중일 때 stdin/stdout 통해 상태 조회
```

> **아키텍처 결정**: VRRouterManager는 teleop 프로세스 내부에서 실행된다.
> LeStudio 서버에서 직접 import하면 lerobot 결합 경계 위반이다.
> 따라서 VR 상태 조회는 teleop 프로세스의 stdout 파싱 또는 별도 헬스체크 엔드포인트를 통해 처리한다.

### 4.3 신규 API 엔드포인트 (`server.py`)

```
GET  /api/franka/server/status
     → {"running": bool, "pid": int|null, "reachable": bool, "robot_ip": str, "port": int}

POST /api/franka/server/start
     body: {"robot_ip": str, "server_binary_path": str}
     → {"success": bool, "pid": int|null, "error": str|null}

POST /api/franka/server/stop
     → {"success": bool}

GET  /api/franka/vr/status
     → {"adb_connected": bool, "device_id": str|null, "vr_app_connected": bool, "tcp_port": int}

POST /api/franka/vr/setup-adb
     body: {"tcp_port": int = 8000}
     → {"success": bool, "message": str}

POST /api/franka/vr/cleanup-adb
     → {"success": bool}
```

### 4.4 신규 프론트엔드 탭: `FrankaSetupTab.tsx`

**탭 위치**: Setup 그룹, CalibrateTab 다음 (또는 DeviceSetupTab 내 Franka 섹션으로 통합)

**UI 구성:**

```
┌─── Franka Setup ────────────────────────────────────┐
│                                                      │
│  ▼ franka_server                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │  Robot IP  [192.168.18.1    ]  Port [5000]     │  │
│  │  Binary    [/path/to/franka_server      ] [..] │  │
│  │                                                │  │
│  │  Status: ● RUNNING (PID: 12345)               │  │
│  │          ● reachable at 192.168.18.1:5000      │  │
│  │                                                │  │
│  │         [▶ Start Server]  [■ Stop Server]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ▼ Meta Quest VR (for VR Teleoperation)              │
│  ┌────────────────────────────────────────────────┐  │
│  │  ADB: ● Quest 3 연결됨 (1WMHH9XXXX)           │  │
│  │  VR App: ○ 연결 대기중 (TCP:8000)              │  │
│  │                                                │  │
│  │         [Setup ADB Reverse]                    │  │
│  │                                                │  │
│  │  ℹ️  VR 앱 연결 방법:                         │  │
│  │     1. Quest에서 franka-vr-teleop 앱 실행      │  │
│  │     2. ADB Reverse 설정 (위 버튼)              │  │
│  │     3. 앱에서 Connect 탭                       │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**상태 폴링**: 기존 LeStudio preflight 체크 패턴과 동일하게 2초 간격 폴링.

---

## 5. 구현 로드맵

### Phase A — 기반 통합 (copy-merge + franka_server 관리)

**목표**: franka_server를 LeStudio에서 관리하고, FrankaFER로 기본 Teleop/Record 실행 가능하게 한다.

| 작업 | 파일 | 설명 |
|------|------|------|
| LeFranX 클래스 copy-merge | lerobot 환경 | `src/lerobot/robots/franka_fer/` + `src/lerobot/teleoperators/franka_fer_vr/` 복사 |
| `franka_xhand_teleoperator` 설치 | lerobot 환경 | `pip install -e /path/to/franka_xhand_teleoperator` |
| device_registry 자동 인식 검증 | — | FrankaFER, franka_fer_vr가 드롭다운에 표시되는지 확인 |
| FrankaServerManager 구현 | `franka_bridge.py` (신규) | subprocess start/stop + health_check |
| `/api/franka/server/*` 엔드포인트 | `server.py` | status / start / stop |
| FrankaSetupTab 구현 | `FrankaSetupTab.tsx` | franka_server 제어 패널만 (VR 섹션 미포함) |
| Preflight 통합 | `server.py`, `TeleopTab.tsx` | Teleop 시작 전 franka_server 실행 여부 확인 |

**완료 기준 (DoD)**:
- franka_server를 LeStudio UI에서 시작/중지 가능
- FrankaFER를 DeviceSetup에서 선택 가능
- Teleop 탭에서 franka_fer_vr 선택 후 실행 가능 (franka_server가 실행 중인 경우)
- Record 탭에서 에피소드 녹화 가능

### Phase B — VR 연결 관리

**목표**: Meta Quest ADB 연결 상태를 LeStudio UI에서 확인하고 설정한다.

| 작업 | 파일 | 설명 |
|------|------|------|
| VRConnectionManager 구현 | `franka_bridge.py` | ADB 상태 확인 + setup_adb_reverse |
| `/api/franka/vr/*` 엔드포인트 | `server.py` | VR 상태 조회 / ADB 설정 |
| FrankaSetupTab VR 섹션 추가 | `FrankaSetupTab.tsx` | ADB 상태 표시 + Setup ADB 버튼 |
| VR Teleop Preflight | `server.py`, `TeleopTab.tsx` | franka_fer_vr 선택 시 ADB 연결 여부 추가 확인 |

**완료 기준 (DoD)**:
- LeStudio에서 Meta Quest ADB 연결 상태 실시간 표시
- "Setup ADB Reverse" 버튼 원클릭 동작
- VR Teleop Preflight 체크에 ADB + VR 앱 연결 여부 포함

### Phase C — XHand 통합

**전제조건**: 사용자가 RobotEra wheel + dex-retargeting을 직접 설치 완료

**목표**: XHand 텔레오퍼레이터를 LeStudio에서 사용 가능하게 한다.

| 작업 | 파일 | 설명 |
|------|------|------|
| vr-dex-retargeting 설치 지원 | docs (설치 가이드) | 설치 절차 문서화 |
| XHand 클래스 copy-merge | lerobot 환경 | `src/lerobot/robots/xhand/`, `src/lerobot/teleoperators/xhand_vr/` |
| `franka_fer_xhand_vr` 클래스 포함 | lerobot 환경 | 조합형 Robot + Teleoperator 클래스 |
| Optional dependency 감지 | `device_registry.py` | XHand wheel 미설치 시 해당 타입을 회색 처리 + 설치 안내 |
| XHand 설정 UI | `FrankaSetupTab.tsx` | 리타게팅 설정 (캘리브레이션 파일 경로 등) |

**완료 기준 (DoD)**:
- XHand wheel 설치된 환경에서 xhand_vr, franka_fer_xhand_vr 자동 인식
- 미설치 환경에서 명확한 설치 안내 표시 (에러 크래시 없음)

---

## 6. 주요 기술적 고려사항

### 6.1 LeRobot 결합 경계 유지

`franka_bridge.py`는 `lerobot.*`를 import하지 않는다.
- `franka_server`는 단순 subprocess (바이너리 실행)
- ADB 설정은 `adb` CLI 도구 호출 (`subprocess.run`)
- VR 라우터 상태 조회는 teleop 프로세스 stdout 파싱으로 처리

기존 4접점 원칙 유지:
```
teleop_bridge.py     → lerobot.* 허용 (기존)
record_bridge.py     → lerobot.* 허용 (기존)
camera_patch.py      → lerobot.* 허용 (기존)
device_registry.py   → lerobot.* 허용 (기존)
franka_bridge.py     → lerobot.* 금지 (신규)
```

### 6.2 franka_server 실행 환경 요구사항

`franka_server`는 C++ 빌드가 필요하다:
```bash
cd franka_server
bash build.sh  # CMake + libfranka + ruckig
```

LeStudio UI에서 "빌드가 필요합니다" 상태와 "실행 가능" 상태를 구분해야 한다:
- `server_binary_path`가 존재하지 않음 → "빌드 필요" 상태 배지
- 존재하지만 실행 안 됨 → "중지됨" 상태 배지
- 실행 중 + TCP 응답 있음 → "실행 중" 상태 배지

### 6.3 Franka 로봇 캘리브레이션 처리

`FrankaFER.is_calibrated`는 항상 `True`를 반환한다 (공장 캘리브레이션).
LeStudio Calibrate 탭에서 FrankaFER 선택 시 "이 로봇은 캘리브레이션이 필요 없습니다" 메시지를 표시해야 한다.

기존 캘리브레이션 preflight 로직:
```python
# server.py — check_calibration()
# franka_fer 타입에 대해 calibration 경로 체크 스킵 처리 필요
```

### 6.4 VR 상태 폴링 설계

Teleop 프로세스가 실행 중이지 않을 때도 ADB + VR 앱 연결 상태를 보여야 한다.
FrankaSetupTab에서 독립적으로 `/api/franka/vr/status`를 2초 폴링하는 방식이 적합하다.
기존 camera preflight 폴링 패턴과 동일.

---

## 7. 리스크 및 제약사항

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| franka_server 빌드 실패 | Phase A 진행 불가 | 사전 빌드 + 바이너리 경로만 LeStudio에 등록 |
| libfranka 버전 ↔ 로봇 펌웨어 불일치 | 연결 실패 | 로봇 펌웨어 버전 확인 절차를 FrankaSetupTab에 안내 |
| ADB 미설치 환경 | VR Phase 진행 불가 | ADB 설치 여부 런타임 감지 + 설치 안내 링크 |
| Meta Quest USB 디버깅 비활성화 | ADB 감지 실패 | 설정 방법 UI 내 안내 |
| RobotEra wheel 버전 변경 | XHand Phase 진행 불가 | 테스트된 버전 고정 (1.1.7-cp312) 문서화 |
| Draccus circular import (LeFranX README 경고) | franka_fer_xhand 조합 로봇 사용 시 오류 | 조합 로봇은 스크립트 직접 실행 방식 안내, LeStudio GUI 경로는 franka_fer + franka_fer_xhand_vr 분리 방식 사용 |

---

## 8. 설치 절차 요약 (통합 후 사용자 가이드)

```bash
# 1. lerobot 환경 활성화
conda activate lerobot

# 2. LeFranX 클래스 설치 (copy-merge)
cp -r /path/to/LeFranX/src/lerobot/* /path/to/lerobot/src/lerobot/

# 3. VR 텔레오퍼레이터 패키지 설치
pip install -e /path/to/LeFranX/franka_xhand_teleoperator

# 4. (XHand 사용 시) dex-retargeting 설치
cd /path/to/LeFranX/vr-dex-retargeting
pip install -e .

# 5. (XHand 사용 시) RobotEra wheel 설치 (별도 다운로드 필요)
pip install xhand_controller-1.1.7-cp312-cp312-linux_x86_64.whl

# 6. franka_server 빌드
cd /path/to/LeFranX/franka_server
bash build.sh
# → 빌드된 바이너리 경로를 LeStudio FrankaSetup 탭에 등록

# 7. LeStudio 실행 후 FrankaSetup 탭에서:
#    - franka_server 시작 (Robot IP 입력)
#    - Meta Quest ADB 연결 확인
#    - DeviceSetup에서 FrankaFER 로봇 + franka_fer_vr 텔레오퍼레이터 선택
```

---

## 9. 의사결정 기록

- [x] **Q1**: franka_bridge.py가 lerobot.*를 import해야 하는가?
  - **→ 금지. franka_server는 독립 바이너리, ADB는 CLI 도구.**
  - 근거: LeRobot 결합 경계 원칙(4접점) 유지. franka_bridge.py는 subprocess + socket + subprocess.run만 사용.

- [x] **Q2**: FrankaSetupTab을 별도 탭으로 만들 것인가, DeviceSetupTab 내 섹션으로 통합할 것인가?
  - **→ 별도 탭 (FrankaSetupTab).** DeviceSetupTab 내 섹션으로 하면 Franka 미사용 사용자에게 노출됨.
  - 단, 탭 활성화는 FrankaFER 로봇이 device_registry에서 감지될 때만 표시하는 방식도 고려 가능.

- [x] **Q3**: VR 라우터 상태를 LeStudio 서버에서 직접 import하여 조회할 것인가?
  - **→ 금지. teleop 프로세스 stdout 파싱 또는 ADB 상태만 독립 조회.**
  - 근거: `VRRouterManager`는 `vr_message_router` pybind11 모듈에 의존. LeStudio 서버에서 직접 import 시 lerobot 결합 경계 위반 + import 실패 시 서버 크래시 리스크.

- [x] **Q4**: LeFranX 클래스를 LeStudio 저장소에 직접 포함할 것인가, 별도 설치 지시할 것인가?
  - **→ 별도 설치 (copy-merge 방식 문서화). 직접 포함 안 함.**
  - 근거: LeFranX는 독립 저장소로 유지 중인 연구 프로젝트. LeStudio가 포함 시 버전 충돌, 유지보수 부담. 사용자가 직접 clone + copy-merge 하는 방식이 유연.

---

## 10. 참고 자료

| 항목 | 경로 / URL |
|------|-----------|
| LeFranX 저장소 | `/home/jinhyuk2me/dev_ws/lerobot_ws/LeFranX/` |
| LeFranX GitHub | https://github.com/wengmister/LeFranX |
| LeVR 논문 | https://arxiv.org/abs/2509.14349 |
| libfranka GitHub | https://github.com/frankarobotics/libfranka |
| ruckig GitHub | https://github.com/pantor/ruckig |
| dex-retargeting GitHub | https://github.com/dexsuite/dex-retargeting |
| franka-vr-teleop (Meta Quest 앱) | https://github.com/wengmister/franka-vr-teleop |
| FrankaFER 클래스 | `/home/jinhyuk2me/dev_ws/lerobot_ws/LeFranX/src/lerobot/robots/franka_fer/franka_fer.py` |
| VRRouterManager | `/home/jinhyuk2me/dev_ws/lerobot_ws/LeFranX/src/lerobot/teleoperators/vr_router_manager.py` |
| ecosystem-integration-plan.md | `docs/private/ecosystem-integration-plan.md` |
| roadmap.md | `docs/private/roadmap.md` |
