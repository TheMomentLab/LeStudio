# OSS 확산 제약 및 해결 방안 (백업)

작성일: 2026-02-22

이 문서는 LeRobot Studio를 오픈소스로 “넓게” 확산시키는 데 걸림돌이 되는 제약과, 이를 완화/해결하기 위한 방안을 대화 내용 기반으로 백업한 것입니다.

## 제약 (현재 코드베이스 기준)

- 지원 하드웨어가 사실상 `so100/so101`에 고정
  - 근거: `src/lerobot_studio/server.py:43`의 `ROBOT_TYPES`
- 매핑(udev rules) 적용이 `NOPASSWD sudo` 없으면 막힘
  - 근거: `src/lerobot_studio/server.py:462`에서 `sudo -n cp ...`
- README가 현재 기능(Train/Eval/Dataset) 반영이 안 됨
  - 근거: `README.md:1`은 6탭 중심 설명(Train/Eval/Dataset 언급 부족)

## 해결 방안

### 1) 하드웨어 고정(so100/so101)

- 빠른 해결(MVP)
  - UI에서 `robot.type` / `teleop.type`를 “고급(advanced) 자유 입력”으로 열어두고, 현재처럼 `port/id`만 연결해 `command_builders.py`가 인자 생성하도록 유지
  - 목표: LeRobot에 새 타입이 추가돼도 Studio는 코드 수정 없이 “일단 실행” 가능
- OSS 친화 개선(구조화)
  - 로봇 타입을 코드 상수(`ROBOT_TYPES`)가 아니라 프로파일/플러그인 파일로 분리
  - 예: `~/.config/lerobot-studio/robots/*.json`에 `robot_type`, `teleop_type`, 필요한 필드(port/id/bi-arm 포트들), 기본 카메라 역할 등을 정의하고 서버가 목록을 읽어 제공
- 보완/리스크
  - 캘리브레이션 파일 경로/규칙이 로봇마다 달라질 수 있으므로 preflight는 “실패해도 실행은 가능”하게 두고, 경고(warn) 중심으로 설계

### 2) udev 매핑이 root 권한에 의존

- 빠른 해결(MVP)
  - `Preview`는 그대로 유지(규칙 텍스트 생성)
  - `Apply`에서 `sudo -n` 실패 시:
    - 규칙을 config dir에 저장(예: `~/.config/lerobot-studio/99-lerobot.rules`)
    - UI에 사용자가 직접 실행할 명령을 안내(`sudo cp ... /etc/udev/rules.d/...` + `udevadm control --reload-rules` 등)
  - 이유: 웹서버에서 비밀번호 프롬프트를 안전하게 처리하기 어렵고, OSS 환경에서는 NOPASSWD를 강제하기 힘듦
- 더 나은 옵션(권한 분리)
  - root 작업은 GUI가 아니라 CLI에서만 수행(예: `lerobot-studio install-udev` 명령 추가)
  - 웹 UI는 “설치 방법/상태”만 안내
- 폴백 지원(권한 없이도 사용)
  - udev 매핑은 “권장(영구 심링크)”로 두고, 권한이 없으면 `/dev/video*`, `/dev/tty*` 직접 선택으로 동작하는 unprivileged mode를 공식 지원

### 3) README 문서 불일치(Train/Eval/Dataset)

- 빠른 해결(MVP)
  - README의 기능/탭 목록을 현재 UI와 맞추고 `Train/Eval/Dataset`을 명시
  - 각 탭이 무엇을 하는지 1줄 요약 추가
- OSS에서 꼭 박아야 하는 “조건/의존성” 명시
  - Dataset 상세/품질 검사: 런타임에서 `pandas`가 필요할 수 있음(파케/parquet 로딩)
  - Hub push: `huggingface-cli` + `HF_TOKEN` 필요
  - GPU 모니터: `nvidia-smi` 있을 때만 동작
  - Mapping Apply: root 권한 필요

