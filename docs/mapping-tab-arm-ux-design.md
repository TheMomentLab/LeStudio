# Mapping 탭 Arm Port UX 재설계안 (초안)

## 배경

`mt_lerobot`의 터미널 기반 arm 매핑은 아래 순서로 진행됩니다.

1. 물리 포트 식별 (`lerobot-find-port` 또는 분리/재연결 diff)
2. udev 속성 확인 (`udevadm info -a -n /dev/ttyACM*`)
3. 규칙 작성/적용 (`ATTRS{serial} -> SYMLINK`)
4. 심볼릭 링크 검증 (`ls -l /dev/leader_arm_1 /dev/follower_arm_1`)

현재 `lerobot-studio`의 Mapping 탭도 역할 지정은 가능하지만, 위 작업 흐름을 UI에서 완전하게 재현하지는 못하고 있습니다.

## 참고 문서 및 코드

- 매뉴얼:
  - `/home/jinhyuk2me/dev_ws/mt_lerobot/docs/01_getting_started/04_usb_port_management_ko.md`
  - `/home/jinhyuk2me/dev_ws/mt_lerobot/docs/system_mapping.md`
  - `/home/jinhyuk2me/dev_ws/mt_lerobot/docs/01_getting_started/02_so-101_setup_ko.md`
- 현재 구현:
  - `src/lerobot_studio/static/main.js` (`DeviceSetupTab`)
  - `src/lerobot_studio/server.py` (`_build_rules`, `/api/rules/*`)

## 현재 문제점

1. arm 매핑이 serial 기반 드롭다운 중심이라, "이 물리 장치가 누구인지"를 찾는 단계가 약함
2. 변경 후 자동(silent) 적용되어, 사용자가 적용 시점을 명확히 인지하기 어려움
3. 터미널의 `ls -l`에 해당하는 검증 단계가 UI에 없음
4. serial 없는 장치는 매핑이 사실상 막힘(대안 부족)
5. role 목록이 고정(`leader/follower 1~2`)이라 확장성 낮음

## 설계 목표

1. 터미널 흐름을 UI에서 그대로 제공: **식별 -> 할당 -> 적용 -> 검증**
2. 상태 전이를 명확하게 보여주기
3. 다중 arm 환경에서 오매핑 감소
4. serial 미노출 장치에 대한 fallback 경로 제공
5. 기존 API/설정과의 하위 호환 유지

## 제안 UX 플로우

### A. 식별(Identify Wizard)

- Mapping 탭에 "Arm 식별" 모드 추가
- 사용자에게 arm 하나를 분리/재연결하도록 안내
- `/api/devices` 폴링으로 변경된 arm 자동 탐지
- 탐지 결과에 핵심 정보 표시:
  - `/dev/tty*`
  - serial
  - 현재 symlink(있다면)
- "이 arm을 어떤 role로 할당" 버튼 제공

### B. 할당(Assign)

- 수동 선택은 fallback으로 유지
- 중복 role 즉시 경고
- role 점유 현황(예: `leader_arm_1`, `follower_arm_1`) 요약 표시

### C. 미리보기 -> 적용(명시적)

- 자동 적용 제거, 버튼 기반으로 변경:
  - `Preview Rules`
  - `Apply Rules`
- 적용 시 실행 로그 표시:
  - `/etc/udev/rules.d/99-lerobot.rules` 복사
  - `udevadm control --reload-rules`
  - `udevadm trigger`

### D. 검증(Verify)

- 검증 패널에서 다음을 표시:
  - 기대 symlink (`/dev/follower_arm_1`)
  - 실제 연결 대상 (`ttyACM*`)
  - 상태 (`OK` / `Missing` / `Mismatch`)
- 터미널 검증 과정을 UI 한 화면에서 대체

## 백엔드/API 변경안

### 1) 규칙 입력 모델 확장

- 현재는 `serial -> role`만 지원
- serial이 없는 경우를 위해 fallback 매칭 허용:
  - `match_type: serial | kernels`
  - `match_value: <serial-or-kernels>`

예시:

```rules
SUBSYSTEM=="tty", ATTRS{serial}=="5AF7120761", SYMLINK+="follower_arm_1", MODE="0666"
SUBSYSTEM=="tty", KERNELS=="1-1.2", SYMLINK+="leader_arm_1", MODE="0666"
```

### 2) 검증 엔드포인트 추가

- 신규 제안: `GET /api/rules/verify`
- 응답 항목:
  - `role`
  - `exists`
  - `resolved_target`
  - `status`

## 프론트엔드 변경안

### `src/lerobot_studio/static/index.html`

- arm 카드 상단에 Identify Wizard 패널 추가
- `Preview/Apply/Verify` 버튼 분리
- Verify 결과 테이블 영역 추가

### `src/lerobot_studio/static/main.js`

- `DeviceSetupTab`에 다음 메서드 추가:
  - `startArmIdentify()`
  - `stopArmIdentify()`
  - `detectArmDiff()`
  - `verifyRules()`
- arm 경로 자동 silent apply 제거
- 기존 중복 검증/룰 표시 기능은 유지

### `src/lerobot_studio/server.py`

- `_build_rules(...)`가 fallback matcher를 처리하도록 확장
- `/api/rules/verify` 구현

## 호환성/마이그레이션

- 기존 `arm_assignments` payload는 그대로 지원
- 구 포맷 입력은 `serial` 매칭으로 간주
- 기존 `renderReadableRules` 파싱 로직은 유지

## 완료 기준 (Acceptance Criteria)

1. 일반 상황에서 터미널 없이 UI만으로 매핑 완료 가능
2. 적용/검증 상태가 명시적으로 표시됨
3. 중복 role은 적용 전에 차단됨
4. serial 없는 arm에 대한 fallback 경로가 제공됨
5. 기존 단일 arm 워크플로우에 회귀 없음

## 구현 단계 제안

### Phase 1 (낮은 리스크)

- 명시적 `Preview/Apply/Verify` 동작
- verify endpoint + verify UI
- serial 매칭 방식 유지

### Phase 2 (중간 리스크)

- Identify Wizard (device diff 폴링)

### Phase 3 (중간 리스크)

- serial 미노출 장치용 `KERNELS` fallback 지원
- role 모델 확장(고정 1~2 구조 탈피)

---

상태: 설계 초안 (이 문서는 구현 코드가 아님)
