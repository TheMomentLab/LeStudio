# LeStudio 품질 개선 사항 정리

최종 갱신: 2026-02-28

## 1) 요약

- 현재 빌드 체인(`frontend` lint/build, backend compileall)은 정상 동작한다.
- 다만 릴리스 품질에 직접 영향을 주는 핵심 리스크가 확인되었다.
- 특히 **프로세스 명령 실행 경로**, **기본 네트워크 노출 설정**, **테스트 부재**를 최우선으로 개선해야 한다.
- 현재 단계 판단은 `2.5 완료, 3단계(OSS 준비) 직전`이며, 실무상 `3.0 안정화 게이트` 선행이 필요하다.

## 2) 검증된 사실 (근거 포함)

### 보안/아키텍처

1. `/api/process/{name}/command`는 `name` allowlist 검증 없이 `proc_mgr.start(name, args)`를 호출한다.
   - 근거: `src/lestudio/server.py:1565`, `src/lestudio/server.py:1577`
2. 명령 문자열은 `_normalize_console_command`로 파싱되지만 실행 제한 allowlist는 없다.
   - 근거: `src/lestudio/server.py:922`
3. 실제 실행은 `subprocess.Popen(args)`로 수행되며 `shell=True`는 아니다.
   - 근거: `src/lestudio/process_manager.py:133`, `src/lestudio/process_manager.py:144`
   - 해석: 쉘 인젝션 형태는 아니지만, API 호출자가 실행 바이너리를 고를 수 있어 임의 프로그램 실행 리스크가 남는다.
4. 기본 바인딩은 `0.0.0.0`, CORS는 `*`로 설정되어 네트워크 노출면이 넓다.
   - 근거: `src/lestudio/cli.py:222`, `src/lestudio/server.py:971`
5. AGENTS 경계(lerobot import 4파일 제한) 기준으로 `cli.py`가 예외를 가진다.
   - 근거: `src/lestudio/cli.py:26`

### 품질/유지보수

1. 테스트가 사실상 없다 (`pytest` 0건).
2. 백엔드 핵심 파일 단일 비대화.
   - 근거: `src/lestudio/server.py` (2774 LOC, 다수 엔드포인트)
3. 프론트 전역 config 타입이 `Record<string, unknown>`이라 탭에서 캐스팅이 반복된다.
   - 근거: `frontend/src/store/index.ts:6`, `frontend/src/tabs/TeleopTab.tsx:288`

## 3) 우선순위별 개선 항목

## P0 (즉시, 1-3일)

1. **명령 실행 엔드포인트 제한**
   - `api_proc_command`에 `name in PROCESS_NAMES` 검증 추가
   - 명령 allowlist 도입 (예: `pip`, `python -m pip`, `conda/mamba install`만 허용)
   - 필요 시 endpoint 자체를 기본 비활성(설정 플래그)로 전환

2. **기본 노출 설정 축소**
   - CLI 기본 host를 `127.0.0.1`로 변경
   - CORS `allow_origins=["*"]` 제거, 명시적 origin 리스트 사용

3. **최소 인증 레이어 추가**
   - 민감 API(`process/*`, train/eval/record start/stop 등)에 토큰 기반 가드 추가

## P1 (단기, 1-2주)

1. **AGENTS 경계 정합성 복구**
   - `cli.py`의 `import lerobot` 제거
   - `importlib.util.find_spec("lerobot")` 기반 경로 탐지로 대체

2. **API 에러/입력 검증 표준화**
   - 핵심 엔드포인트부터 Pydantic request/response 모델 도입
   - 일관된 에러 포맷 + HTTP status 코드 정렬

3. **프론트 config 타입화**
   - `LeStudioConfig` 타입 정의
   - 탭별 반복 `as string` 캐스팅 축소

## P2 (중기, 2-4주)

1. **테스트 베이스라인 구축**
   - Backend: process command guard, command parser, process manager 단위 테스트
   - Frontend: store/hook 핵심 동작 테스트
   - 최소 smoke/integration 테스트 3-5개

2. **단일 파일 분해 착수**
   - `server.py`를 도메인 라우터(예: process/train/dataset/system)로 점진 분리
   - 단, P0/P1 안정화 이후 수행

## 4) 실행 체크리스트

- [x] `src/lestudio/server.py`: `api_proc_command`에 process allowlist 검증 추가
- [x] `src/lestudio/server.py`: command allowlist/denylist 정책 반영 (`_normalize_console_command`에 pip/conda allowlist 구현)
- [x] `src/lestudio/cli.py`: `--host` 기본값 `127.0.0.1`로 변경
- [x] `src/lestudio/server.py`: CORS origin 제한값으로 변경
- [ ] `src/lestudio/server.py`: 민감 endpoint 토큰 인증 도입 (P0로 격하 — OSS 단계에서 재검토)
- [x] `src/lestudio/cli.py`: `import lerobot` 제거 (경계 규칙 정합)
- [x] `frontend/src/store/index.ts` / `lib/types.ts`: `LeStudioConfig` 타입화 + `as string` 캐스팅 제거
- [x] `tests/` (신규): backend 103개 테스트 + frontend 47개 테스트 — 회귀 커버리지 확보

## 5) 3.0 안정화 게이트 (Definition of Done)

- 명령 실행 경로가 allowlist + 인증 없이 동작하지 않는다.
- 기본 실행 시 외부 네트워크 노출이 최소화된다 (`127.0.0.1`, 제한 CORS).
- `pytest`가 0건이 아닌 상태로 최소 핵심 회귀 테스트를 통과한다.
- AGENTS 경계 규칙(lerobot import 4파일 제한)을 만족한다.

## 6) 권장 실행 순서

1. 보안 핫픽스: 명령 실행 경로 제한 + 기본 노출 축소
2. 경계 복구: `cli.py`의 `import lerobot` 제거
3. 테스트/CI 구축: 최소 회귀 테스트 + 자동 검증 파이프라인
4. 문서 정합화: 로드맵/운영 문서와 코드 상태 일치화
5. OSS 준비: 기여 가이드/템플릿/릴리즈 기준 확정

## 7) 문서 통합 메모

- `phase3-stabilization-task-list-2026-02-25.md`의 우선순위/게이트 항목을 본 문서에 통합했다.
