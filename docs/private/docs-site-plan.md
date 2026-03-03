# LeStudio — Public Docs Site 제안 (LeRobot 생태계 접점 확대)

최종 갱신: 2026-02-25
상태: 제안 (Proposal)

## 0. 결론

LeRobot 생태계와의 접점을 늘리려면 **공개 문서 페이지(Docs Site)** 를 두는 게 유효하다.

- GitHub의 `README.md`/`docs/`만으로도 가능하지만, 커뮤니티 확장을 목표로 하면 검색/탐색/링킹이 쉬운 Docs Site가 효율이 좋다.
- 단, 본 repo는 아직 문구/기능이 변동 중이라 "대규모 문서"보다 **최소 문서(핵심 경로)** 로 시작하는 전략이 안전하다.

## 1. 배경: 왜 Docs Site가 접점을 늘리는가

LeRobot 커뮤니티 관점에서 접점은 보통 아래 경로로 발생한다.

1) LeRobot 문서/README에서 링크 → 2) 설치/Quickstart → 3) 특정 문제 해결(udev/teleop/record/train) → 4) 커뮤니티 공유(Discord/Forum)

Docs Site는 위 경로에서 특히 강점이 있다.

- 검색 최적화: "LeRobot teleop GUI", "lerobot record episode", "udev camera symlink" 같은 쿼리에서 발견 가능
- 링크 공유: 특정 탭/에러/가이드 문단을 URL로 바로 공유 가능
- 정보 구조: 튜토리얼/레시피/FAQ/트러블슈팅을 체계적으로 분리
- Upstream 접점: `huggingface/lerobot` 문서/포럼/Discord에 레퍼런스로 걸기 쉬움

## 2. 현재 상태 (Fact)

- 공개용 Docs Site 인프라가 없음 (mkdocs/docusaurus/sphinx/gh-pages 구성 없음)
- repo 내부 설계 문서(`docs/`, `docs/private/`)는 존재하지만 "외부 사용자 관점"의 Quickstart/FAQ/문제 해결 루트가 약함

## 3. 추천 접근: 최소 Docs Site로 시작

### 3.1 문서 언어

- 기본: English (LeRobot의 주 사용자층/공식 커뮤니케이션 채널과 정합)
- 보조: Korean은 "추가"로 (초기에는 핵심 페이지 몇 개만)

UI의 런타임 i18n(언어 선택)과는 별개로, 문서는 먼저 다국어가 가능하다.

참고: UI의 언어 선택/i18n은 별도 메모로 관리한다: `docs/private/language-selection-i18n.md`

### 3.2 추천 도구

- 1안(권장): MkDocs + Material
  - Python 프로젝트와 궁합이 좋고, 설정/빌드/배포가 단순하다.
- 2안: Docusaurus
  - React 생태계 친화적이지만, 본 repo는 Python 중심이어서 초기 세팅 부담이 더 클 수 있다.

### 3.3 최소 콘텐츠 맵 (v0)

"LeRobot 사용자가 LeStudio를 발견하고 바로 쓸 수 있게"만 목표로 한다.

- Home
  - LeStudio가 무엇을 해결하는지(LeRobot CLI workflow 대체), 핵심 기능 5줄
- Install
  - `pip install -e .` / requirements / Linux 권한(udev) / GPU optional
- Quickstart
  - Status → Mapping → Calibration → Teleop → Record → Train → Eval (짧은 체크리스트)
- Guides
  - Mapping(udev rules) 가이드
  - Teleop/Record preflight 해석 + 자주 막히는 지점
  - Dataset push/download (HF login 포함)
- Troubleshooting
  - 권한/카메라 인식/포트/캘리브레이션 경로/CUDA preflight
- Contributing
  - 개발 환경, frontend build, 아키텍처 개요, PR 가이드 (추후 `CONTRIBUTING.md`와 중복 최소화)

### 3.4 LeRobot 생태계 접점 강화용 페이지 (v0.1~v0.2)

문서가 단순 사용 설명에 그치면 접점이 제한된다. 아래를 넣으면 "생태계"로 연결된다.

- "Supported robots / teleoperators" (레지스트리 기반 동적 지원 설명)
- "How LeStudio uses LeRobot" (subprocess orchestration, registry discovery)
- "Plugin / extension story" (서드파티 `lerobot_robot_*` 패키지와의 관계, 발견 방식)
- "Link-outs"
  - LeRobot 공식 문서의 관련 섹션으로 상호 링크
  - LeRobot Discord/Forum에 공유할 때 참조할 canonical URL 제공

## 4. 배포/운영 스케치 (GitHub Pages 기준)

목표: "PR merge → 자동 배포".

- `mkdocs.yml` 추가
- `docs_site/` 같은 공개 문서 루트(또는 기존 `docs/` 재구성)
- GitHub Actions workflow로 build + publish
- `README.md`에 Docs URL을 명시

주의:
- `docs/private/`는 사이트에서 제외 (내부 설계/로드맵은 private로 유지)
- 버전 정책(태그 기반 버전 문서)을 적용할지 여부는 OSS 릴리즈 이후 결정

## 5. 실행 체크리스트 (작업 단위)

1) 도구 선택 (MkDocs 권장)
2) 최소 콘텐츠 작성 (Install/Quickstart/Troubleshooting)
3) Pages 배포 파이프라인 구성
4) LeRobot 채널(Discord/Forum) 및 `huggingface/lerobot` 문서/README에 링크 추가 PR

## 6. 30/60/90 롤아웃 플랜

### Day 0-30 (MVP)

- Docs Site 오픈: Home, Install, Quickstart, Troubleshooting 4개 페이지만 우선 배포
- `README.md`에 Docs URL을 첫 화면 동선에 배치
- "자주 막히는 5가지"(udev 권한, 카메라 인식, 포트 매핑, HF 로그인, CUDA preflight)를 Troubleshooting에 고정

### Day 31-60 (Ecosystem 연결)

- "How LeStudio uses LeRobot" 및 "Supported robots/teleoperators" 공개
- LeRobot Discord/Forum에 문서 링크를 기준 URL(canonical)로 공유
- 외부 링크 유입이 높은 페이지 기준으로 문서 구조 재정렬

### Day 61-90 (Scale)

- 한국어 보조 문서(핵심 페이지 2~3개) 추가
- FAQ 확장 + 에러 코드/로그 패턴별 해결 레시피 추가
- 버전 문서(릴리즈 태그 기반) 도입 여부 결정

## 7. KPI (접점 확대를 위한 측정 항목)

문서의 목적은 "좋은 글"이 아니라 "LeRobot 사용자 접점 증가"이므로 최소 KPI를 둔다.

- Acquisition: Docs 유입 경로(검색/README/Discord/Forum) 비중
- Activation: Quickstart 페이지에서 실제 설치/실행으로 이어진 비율
- Support deflection: 동일 질문의 Discord 반복 빈도 감소(문서 링크로 대체되는지)
- Ecosystem linkage: LeRobot 관련 외부 문서/게시글에서 LeStudio docs가 참조된 횟수

## 8. Non-goals (초기 범위에서 제외)

- 모든 탭/모든 기능에 대한 완전한 레퍼런스 문서화
- UI i18n 완료 전의 전면 다국어 문서화
- 긴 이론 설명 위주의 문서(초기에는 실행 가능한 절차 중심)

## 9. Definition of Done (MVP)

아래를 만족하면 "공개 docs 기반 접점"이 시작된 것으로 본다.

- GitHub Pages 또는 동등한 공개 URL에서 문서 접근 가능
- Home/Install/Quickstart/Troubleshooting 페이지가 최신 동작과 일치
- README 첫 화면에서 docs 링크로 1-click 이동 가능
- 최소 1개 LeRobot 커뮤니티 채널(Discord 또는 Forum)에 docs 링크 게시 완료
