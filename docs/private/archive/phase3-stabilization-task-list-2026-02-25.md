# LeStudio — 3단계 진입 전 안정화 작업 리스트

최종 갱신: 2026-02-25  
상태: 실행안 (Execution Plan)

## 0. 목적

현재 상태(2.5 완료, 3단계 직전)에서 OSS 공개 전 필수 품질 게이트를 통과하기 위한 작업 목록을 정리한다.

## 1. 현재 단계 판단

- 공식 로드맵 표기: `2.5단계 완료`, `3단계(OSS 준비) 다음`
- 운영 관점 판단: `3.0 안정화 단계 필요` (보안/경계/테스트/CI 선행)

## 2. 우선순위 작업 리스트

1. `P0 보안` `/api/process/{name}/command`에 `PROCESS_NAMES` 화이트리스트 검증 추가
2. `P0 보안` 기본 `host`/CORS 정책 재점검 (`0.0.0.0`, `*` 완화)
3. `P0 아키텍처` `cli.py`의 `import lerobot` 제거 (4접점 원칙 복구)
4. `P0 품질` 최소 테스트 추가: `ProcessManager`, `/api/process/*`, `/api/config`, preflight 핵심 경로
5. `P0 품질` CI 구성: `frontend lint/build` + `python pytest` + `compileall`
6. `P1 문서` 로드맵에 `3.0 안정화 단계` 명시, 완료 조건 수치화
7. `P1 문서` 폐기 문서 정책 확정: 근거 없는 증적/유실 링크 즉시 archive 또는 삭제
8. `P1 OSS 준비` `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, 이슈/PR 템플릿 추가
9. `P1 OSS 준비` 지원 범위 명시: OS, Python 버전, 하드웨어/카메라 호환 범위
10. `P1 배포` `v0.1.0-alpha` 릴리즈 기준 정의 (필수 테스트 통과, known issues 문서화)
11. `P2 확장` 3.5 기능 확장은 3.0/3단계 완료 후 착수
12. `P2 확장` 4단계 생태계 통합은 OSS 사용자 피드백 기반으로 재정렬

## 3. 3.0 안정화 완료 조건 (Gate)

- 보안:
  - `/api/process/{name}/command`에서 허용 프로세스 외 요청 차단
  - 공개 기본 설정에서 불필요한 원격 접근 경로 최소화
- 경계:
  - `lerobot.*` import가 bridge 3파일 + `device_registry.py`만 남음
- 품질:
  - 최소 핵심 테스트가 CI에서 자동 실행
  - `frontend lint/build` + 백엔드 테스트 파이프라인 모두 통과
- 문서:
  - 로드맵/운영 문서가 현재 코드 기준과 일치
  - 증적 유실 링크 제거 또는 보관 경로 표준화 완료

## 4. 실행 순서 권장

1. 보안 핫픽스(1, 2)
2. 경계 복구(3)
3. 테스트/CI 구축(4, 5)
4. 문서 정합화(6, 7)
5. OSS 공개 준비(8, 9, 10)
6. 확장 작업 재개(11, 12)

## 5. 관련 문서

- `docs/private/roadmap.md`
- `docs/private/ecosystem-integration-plan.md`
- `docs/private/strategy-competitive-analysis.md`
