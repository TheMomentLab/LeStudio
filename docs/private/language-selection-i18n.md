# LeStudio — 언어 선택 / i18n 도입 메모

최종 갱신: 2026-02-25
상태: 제안 (Proposal)

## 0. 목적

LeStudio에 "언어 선택"을 넣을지(그리고 i18n을 언제/어떻게 도입할지) 결정하기 위한 기술/제품 메모.

## 1. 현재 상태 (Fact)

프론트엔드에 i18n 인프라가 없다.

- i18n 라이브러리 없음: `frontend/package.json` dependencies는 `react`, `react-dom`, `zustand`만 존재
- Provider/Context 없음: `frontend/src/App.tsx`에 i18n provider 래핑이 없음
- locale 상태 없음: `frontend/src/store/index.ts`에 language/locale 필드가 없음
- UI 문자열 하드코딩: 예) `frontend/src/tabs/StatusTab.tsx`, `frontend/src/tabs/TeleopTab.tsx`에 영어 텍스트가 직접 포함

즉, "언어 선택"을 넣으려면 UI 문자열 추출 + 번역 리소스 관리 + 런타임 언어 변경까지 전부 새로 도입해야 한다.

## 2. 왜 지금은 비용이 큰가

- 문자열 변동성이 큼: OSS 준비/기능 확장 단계에서 텍스트가 자주 바뀌면 번역 동기화 비용이 매번 발생
- 범위가 넓음: 9개 탭 + 공유 컴포넌트 + 토스트/에러 번역 레이어까지 번역 키 전환 작업이 누적됨
- 품질 리스크: 부분 번역(일부만 한국어/영어 혼용)은 UX가 오히려 악화될 수 있음

## 3. 선택지

### Option A — 당장 i18n 도입 안 함 (현 상태 유지)

- 장점: 개발/유지비용 0
- 단점: 비영어권 사용자의 진입 장벽, 커뮤니티 확장 속도 저하 가능

### Option B — "언어 선택"만 뼈대 먼저 깔기 (추천: 점진적)

UI 전면 번역은 미루되, 나중에 i18n 도입이 쉬워지도록 최소한의 구조만 만든다.

- 예: (1) locale 상태 + localStorage 저장, (2) AppShell에 언어 드롭다운 자리, (3) 공통 UI 몇 개만 키 기반으로 전환
- 장점: 미래의 전면 i18n 전환 비용을 낮춤, 사용자/커뮤니티 반응을 먼저 측정 가능
- 단점: 일부 문자열만 전환하면 혼용 위험 → "공통 영역"에 한정해서만 적용해야 함

### Option C — 풀 i18n 즉시 도입 (예: `react-i18next`)

- 장점: 글로벌/커뮤니티 확장 즉시 유리
- 단점: 초기 마이그레이션 비용 + 번역 자산 관리 부담이 큼

## 4. 추천 결론

기본 추천은 Option B (점진적)이다.

기준:
- UI 문구가 안정화(기능 추가 속도 둔화)되면 Option C로 확장
- 비영어권(예: 한국어) 사용자 비중/요구가 명확해지면 Option C를 앞당김

## 5. 구현 스케치 (Option B → C로 확장 가능한 형태)

### 5.1 상태/영속화

- Zustand에 `locale: 'en' | 'ko'` 필드 추가
- localStorage 키는 테마 패턴을 따라 예: `lestudio-locale`

### 5.2 i18n 라이브러리 (Option C로 갈 때)

권장 후보: `i18next` + `react-i18next`

- 초기화 파일: `frontend/src/i18n.ts`
- 리소스: `frontend/src/locales/en/translation.json`, `frontend/src/locales/ko/translation.json`
- 연결 위치: `frontend/src/main.tsx` 또는 `frontend/src/App.tsx`에서 init + provider

### 5.3 UI 적용 범위 (혼용 방지)

Option B에서는 "공통 영역"만 먼저 키 기반으로 전환한다.

- AppShell 네비게이션 그룹 라벨/탭 명칭
- 전역 토스트/공통 버튼 텍스트
- Status 탭의 빈 상태 메시지처럼 사용자 진입 초기에 자주 보이는 문구

탭 내부의 긴 설명/가이드 문구는 전체 전환(Option C) 단계로 미루는 편이 안정적이다.

### 5.4 키 설계 가이드

- 안정적인 키를 먼저 만든다: `nav.status`, `nav.teleop`, `common.refresh`, `empty.noCameras`
- 번역 리소스는 한 곳에 모은다(초기에는 단일 namespace)
- 문자열 조합은 최소화하고, 변수는 interpolation으로 처리한다

## 6. Roadmap 연결

이 문서는 "기능 확장(3.5단계) / 인프라" 항목에 연결해서 관리한다.
