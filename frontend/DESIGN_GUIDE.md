# LeStudio — 디자인 시스템 가이드

**목적**: LeStudio UI의 시각 토큰, 컴포넌트 패턴, 레이아웃 규칙을 정의합니다.

이 문서는 **강제됩니다.** 규칙 대부분은 `npm run lint`와 `npm run design:audit`이 CI에서 검사합니다
(→ [§12 강제 장치](#12-강제-장치)). 여기 적힌 것과 코드가 어긋나면 **둘 중 하나가 버그**이니 그대로 두지 마세요.

최종 갱신: 2026-08-23

---

## 1. 원칙

**색상은 토큰으로만 씁니다.** `bg-zinc-900`, `text-emerald-400` 같은 원시 팔레트 유틸리티를 직접 쓰지 마세요.
`src/styles/theme.css`가 라이트/다크 값을 모두 정의하므로, 토큰 클래스 하나면 두 테마 모두 올바릅니다.

```tsx
// ✗ 두 테마를 각각 손으로 맞춰야 하고, 하나를 빠뜨리면 대비가 무너진다
<div className="bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400" />

// ✓ 토큰이 테마별로 해석된다. `dark:` 자체가 필요 없다
<div className="bg-surface text-fg-muted" />
```

이 규칙이 지키는 것:

1. **테마 개편이 토큰 값 변경으로 끝납니다.** 컴포넌트를 건드리지 않습니다.
2. **다크 모드 누락이 구조적으로 불가능합니다.** `dark:` 짝을 빠뜨릴 자리가 없습니다.
3. **대비가 토큰에 보장됩니다.** 각 전경 토큰은 자기 배경 위에서 WCAG AA(본문 4.5:1)를 만족합니다.

> `dark:` 접두사는 토큰으로 표현할 수 없는 예외(예: 그림자 세기)에만 씁니다. 색상에는 쓰지 마세요.

---

## 2. 색상 토큰

전체 정의는 `src/styles/theme.css`에 있습니다. 여기 표는 사용법입니다.

### 2.1 표면 (Surface)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `bg-canvas` | zinc-50 | zinc-950 | 페이지 배경 |
| `bg-surface` | white | zinc-900 | 카드 / 패널 |
| `bg-surface-muted` | zinc-50 | zinc-800/30 | 카드 헤더, 옅은 띠 |
| `bg-surface-sunken` | zinc-100 | zinc-800 | 인셋 채움, 탭 트랙 |
| `bg-surface-raised` | zinc-200 | zinc-700 | step 뱃지, 프로그레스 트랙 |
| `bg-surface-elevated` | white | zinc-700 | 트랙 위로 떠오른 활성 탭 |
| `bg-surface-input` | white | zinc-800/50 | 폼 컨트롤 배경 |
| `bg-surface-chrome` | white | zinc-950 | 앱 헤더, StickyControlBar |
| `bg-surface-hover` | zinc-50 | zinc-800 | 행 / 버튼 호버 |
| `bg-surface-selected` | zinc-100 | zinc-800/50 | 선택된 리스트 항목 |
| `bg-surface-overlay` | black/50 | black/60 | 모달 스크림, 비디오 뱃지 |

### 2.2 선 (Line)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `border-line` | zinc-200 | zinc-800 | 기본 테두리 |
| `border-line-subtle` | zinc-100 | zinc-800/50 | 리스트 구분선 (`divide-line-subtle`) |
| `border-line-control` | zinc-200 | zinc-700 | 입력 / 셀렉트 테두리 |
| `border-line-strong` | zinc-300 | zinc-600 | 강조, 선택 상태, 호버 |

### 2.3 전경 (Foreground)

대비는 각자의 표면(`surface`) 기준입니다.

| 토큰 | Light | Dark | 대비 | 용도 |
|---|---|---|---|---|
| `text-fg` | zinc-900 | zinc-50 | 16.1 / 15.6 | 페이지 제목, 최상위 강조 |
| `text-fg-heading` | zinc-800 | zinc-200 | 14.0 / 12.6 | 섹션·카드 제목 |
| `text-fg-body` | zinc-700 | zinc-300 | 10.4 / 10.7 | 본문, 라벨, 입력 값 |
| `text-fg-muted` | zinc-500 | zinc-400 | 4.8 / 6.9 | 2차 정보, 힌트, 단위 |
| `text-fg-disabled` | zinc-400 | zinc-600 | 2.6 / 2.3 | **비활성·장식 전용.** 읽어야 하는 텍스트에 쓰지 마세요 |
| `text-fg-inverted` | zinc-50 | zinc-900 | — | 반전된 채움 버튼 위 텍스트 |

> `text-fg-disabled`는 AA를 만족하지 않습니다. 의도된 값입니다 — 비활성 상태와 순수 장식에만 쓰세요.
> "좀 흐리게" 하고 싶을 때 쓰는 토큰은 `text-fg-muted`입니다.

### 2.4 상태 (Status)

네 가지 상태가 각각 `-fg`(텍스트/아이콘) · `-bg`(틴트) · `-line`(테두리) · `-solid`(점·바 채움)을 갖습니다.

| 의미 | 텍스트 | 배경 | 테두리 | 채움 |
|---|---|---|---|---|
| 성공 / 실행 중 | `text-ok` | `bg-ok-bg` | `border-ok-line` | `bg-ok-solid` |
| 주의 | `text-warn` | `bg-warn-bg` | `border-warn-line` | `bg-warn-solid` |
| 오류 / 위험 | `text-danger` | `bg-danger-bg` | `border-danger-line` | `bg-danger-solid` |
| 정보 / 외부 ID | `text-info` | `bg-info-bg` | `border-info-line` | `bg-info-solid` |

상태 전경색은 **라이트에서 -700/-600, 다크에서 -400**으로 해석됩니다. 이전 가이드가 지정하던
`text-emerald-400`은 흰 배경에서 1.9:1로 사실상 읽히지 않았습니다. 토큰은 양쪽 모두 AA를 만족합니다.

채움 버튼 표면은 `-solid-strong` / `-solid-hover`를 씁니다 ([§5.2](#52-버튼) 참조).
이 값들은 **양쪽 테마에서 동일**합니다 — Start 버튼이 테마를 바꾼다고 색이 변하면 안 되기 때문입니다.

### 2.5 포커스

| 토큰 | 용도 |
|---|---|
| `border-focus-ring` | 포커스된 입력의 테두리 |
| `ring-focus-ring-alpha` | 포커스 링 (`focus:ring-2` 와 함께) |

포커스 표시는 **파란색이며, 이는 의도된 규칙입니다.** 상태색(emerald/amber/red)과 겹치지 않아
"포커스"와 "유효성"이 시각적으로 분리됩니다. `theme.css`의 `*:focus-visible` 전역 아웃라인도 같은 토큰을 씁니다.

### 2.6 범주형 (Categorical)

프로세스 히스토리 점, 범례처럼 **의미 없이 구분만 필요한** 경우에 씁니다.

`bg-category-1` … `bg-category-5` (blue / violet / emerald / amber / zinc)

> 상태를 나타낼 때는 쓰지 마세요. 그건 §2.4입니다. 비텍스트 대비(3:1) 기준으로 맞춰져 있습니다.

### 2.7 차트

Recharts는 색을 **SVG 속성**으로 렌더링하므로 `var(--token)`을 해석하지 못합니다.
따라서 차트는 `useChartTokens()` 훅으로 토큰을 읽습니다.

```tsx
import { useChartTokens } from "../../../hooks/useChartTokens";

export function LossChart() {
  const chart = useChartTokens();
  return (
    <LineChart data={data}>
      <CartesianGrid stroke={chart["chart-grid"]} vertical={false} />
      <XAxis tick={{ fontSize: 10, fill: chart["chart-axis"] }} />
      <Line dataKey="loss" stroke={chart["chart-series-1"]} />
    </LineChart>
  );
}
```

사용 가능한 키: `chart-grid`, `chart-axis`, `chart-series-1`, `chart-series-2`,
`ok-solid`, `warn-solid`, `danger-solid`, `fg-muted`.

**인라인 `style`은 `var()`를 해석합니다.** 훅이 필요 없는 경우 그냥 쓰세요 —
`style={{ color: "var(--ok-fg)" }}`.

### 2.8 원시 팔레트 → 토큰 대응표

기존 코드를 옮길 때 씁니다. lint 메시지가 이 절을 가리킵니다.

| 기존 (light / dark 쌍) | 토큰 |
|---|---|
| `bg-white dark:bg-zinc-900` | `bg-surface` |
| `bg-white dark:bg-zinc-950` | `bg-surface-chrome` |
| `bg-white dark:bg-zinc-800/50` | `bg-surface-input` |
| `bg-zinc-50 dark:bg-zinc-800/30` | `bg-surface-muted` |
| `bg-zinc-100 dark:bg-zinc-800` | `bg-surface-sunken` |
| `bg-zinc-200 dark:bg-zinc-700` | `bg-surface-raised` |
| `border-zinc-200 dark:border-zinc-800` | `border-line` |
| `border-zinc-200 dark:border-zinc-700` | `border-line-control` |
| `border-zinc-100 dark:border-zinc-800/50` | `border-line-subtle` |
| `text-zinc-900 dark:text-zinc-100` | `text-fg` |
| `text-zinc-800 dark:text-zinc-200` | `text-fg-heading` |
| `text-zinc-700 dark:text-zinc-300` | `text-fg-body` |
| `text-zinc-600 dark:text-zinc-300` | `text-fg-body` |
| `text-zinc-500 dark:text-zinc-400` | `text-fg-muted` |
| `text-zinc-400` (다크 짝 없음) | `text-fg-muted` |
| `text-emerald-600 dark:text-emerald-400` | `text-ok` |
| `text-amber-600 dark:text-amber-400` | `text-warn` |
| `text-red-600 dark:text-red-400` | `text-danger` |
| `border-emerald-500/30` | `border-ok-line` |
| `bg-amber-500/10` | `bg-warn-bg` |
| `focus:border-blue-500 focus:ring-blue-500/30` | `focus:border-focus-ring focus:ring-focus-ring-alpha` |

---

## 3. 타이포그래피

### 3.1 크기

| 클래스 | 크기 | 용도 |
|---|---|---|
| `text-3xs` | 10px | 마이크로 뱃지 (ALPHA, 비디오 오버레이, 스텝 번호) |
| `text-2xs` | 11px | 콘솔 로그, 인라인 코드 |
| `text-xs` | 12px | 조밀한 표, 보조 메타데이터 |
| `text-sm` | 14px | **본문 기본값.** 라벨, 입력, 버튼, 카드 제목 |
| `text-base` | 16px | 섹션 제목 (`SectionHeader`), 모달 제목 |
| `text-xl` | 20px | 페이지 제목 (`PageHeader`) |
| `text-2xl` | 24px | 전체 화면 오류 화면 |

> **금지**: `text-[10px]` 같은 임의 크기. `design/no-arbitrary-text-size`가 에러로 잡습니다.
> 맞는 단계가 없으면 `theme.css`의 `@theme` 블록에 단계를 추가하세요 — 컴포넌트에서 즉흥적으로 만들지 마세요.

### 3.2 굵기

| 용도 | 클래스 |
|---|---|
| 기본 | `font-normal` (400) |
| 버튼 라벨, 카드 헤더, 라벨 | `font-medium` (500) |
| 섹션 제목 | `font-semibold` (600) |
| 페이지 제목 | `font-bold` (700) |
| 코드, ID, 수치 | `font-mono` |

---

## 4. 간격

### 4.1 스케일

| 토큰 | 값 | 용도 |
|---|---|---|
| `gap-0.5` | 2px | 네비게이션 항목 |
| `gap-1` | 4px | 아이콘 + 텍스트 |
| `gap-1.5` | 6px | 아이콘 + 라벨 (뱃지, 칩) |
| `gap-2` | 8px | 폼 필드 내부 |
| `gap-3` | 12px | 폼 필드 행 사이, 카드 내부 |
| `gap-4` | 16px | 카드 내 섹션, 그리드 |
| `gap-6` | 24px | **페이지 최상위 섹션 사이 (표준)** |

### 4.2 패딩

```
카드 헤더:   px-4 py-3
카드 바디:   p-4
섹션 헤더:   px-3 py-2
필드 행:     min-h-9 gap-3
```

---

## 5. 인터랙티브 요소

### 5.1 입력 (표준 높이 `h-9`)

**`WireInput` / `WireSelect`를 쓰세요.** 네이티브 `<input>` / `<select>`를 직접 쓰면
포커스 링, 호버, 비활성, readonly 처리를 매번 다시 만들게 됩니다.

```tsx
<WireInput value={value} onChange={setValue} placeholder="Repo ID" />
<WireSelect value={mode} options={["Single", "Bi"]} onChange={setMode} />
<FieldRow label="Task">{/* 라벨 + 컨트롤 정렬 */}</FieldRow>
```

부득이하게 네이티브를 써야 한다면 다음 형태를 지키세요:

```
w-full h-9 px-3 py-2 rounded-lg border border-line-control bg-surface-input
text-fg-heading text-sm outline-none
hover:border-line-strong
focus:border-focus-ring focus:ring-2 focus:ring-focus-ring-alpha transition-all
```

### 5.2 버튼

**`buttonStyles()`를 쓰세요.** 직접 클래스를 조합하지 마세요.

```tsx
import { buttonStyles } from "../components/ui/button";

<button className={buttonStyles({ variant: "primary", tone: "success" })}>Start</button>
<button className={buttonStyles({ variant: "secondary", size: "sm" })}>Refresh</button>
<button className={buttonStyles({ variant: "ghost", tone: "danger" })}>Delete</button>
```

| 축 | 값 |
|---|---|
| `variant` | `primary` (채움) · `secondary` (테두리 + 틴트) · `ghost` (배경 없음) |
| `tone` | `neutral` (기본) · `success` · `warning` · `danger` · `brand` |
| `size` | `sm` = `h-8 px-3` · `md` = `h-10 px-5` (기본) |

`cursor-pointer`, `disabled:cursor-not-allowed`, `disabled:opacity-50`, 포커스 링은
모두 `BASE_STYLES`에 포함되어 있습니다 — 다시 붙이지 마세요.

**톤 규칙 — 초록은 "프로세스 시작"에만.**

| 버튼이 하는 일 | variant / tone | 예 |
|---|---|---|
| 하드웨어·ML 프로세스를 시작한다 (Stop 짝이 있다) | `primary` / `success` | Start Teleop, Start Recording, Start Training, Start Eval, Start Calibration, Identify Arm, Connect (Motor Monitor) |
| 실행 중인 프로세스를 멈춘다 | `secondary` / `danger` (`ProcessButtons`가 처리) | Stop |
| 즉시 위험한 정지 | `primary` / `danger` | E-Stop |
| 그 외 페이지의 주요 액션 | `primary` / `neutral` | Search (Hub), Push to Hub, Save |
| 보조 액션 | `secondary` / `neutral` | Clear All, Disconnect, Refresh |
| 파괴적 보조 액션 | `ghost` 또는 `secondary` / `danger` | Delete |

초록 버튼이 화면에 둘 이상 보이면 규칙을 잘못 적용한 것입니다.

**프로세스 Start/Stop**은 `ProcessButtons`를 씁니다. 내부적으로 `buttonStyles`의
`primary/success`·`primary/danger`를 쓰되 세로 패딩을 키운 형태입니다.

**위치 규칙 — 프로세스 CTA는 하단 `StickyControlBar`에.** 상태 배지 + 한 줄 상태 문구를
왼쪽에, Start/Stop을 오른쪽에 둡니다. Teleop · Record · Train · Eval · Motor Setup(Mapping,
Motor Monitor, Calibration)이 이 형태입니다. 카드 아래에 버튼을 띄우지 마세요. 예외는
Motor Setup의 Setup 위저드처럼 단계별 버튼이 필요한 안내 흐름뿐입니다.

**콘솔 예외**: `RuntimeConsoleDrawer`의 탭·아이콘·로그 유틸 버튼은 이 위계 밖입니다.
콘솔은 로그 가독성과 밀도가 우선이므로 가벼운 스타일을 유지합니다.

### 5.3 토글

`WireToggle` — 트랙 `w-8 h-4`, ON `bg-ok-solid`, OFF `bg-surface-raised`, 썸 `size-3`.

### 5.4 레이블 표기

- **입력 필드 레이블은 문장 케이스**: `Policy Type`, `Number of Episodes`. `text-sm text-fg-muted mb-1.5`.
- **카드 안에서 그룹을 나누는 구분 레이블만 대문자**: `SectionLabel` 컴포넌트를 씁니다
  (`text-xs font-medium uppercase tracking-wide text-fg-muted`). Curation의 "Episode Tags",
  Teleop 디버그 패널의 "Runtime" 같은 것들입니다.
- 사이드바 그룹 헤더(HARDWARE / OPERATE …)는 별도 스타일이며 페이지 안에서 흉내 내지 마세요.

### 5.5 선택 상태

목록 행, 라디오 카드, 탭을 가리지 않고 **선택됨은 한 가지로만** 그립니다.

```
선택:   bg-surface-selected  (테두리가 있는 요소는 + border-line-strong)
호버:   bg-surface-hover     (테두리가 있는 요소는 + hover:border-line-strong)
라디오: 선택 border-fg + 점 bg-fg, 비선택 border-line-strong
```

파란 왼쪽 바, 파란 배경, 초록 테두리 같은 색은 선택에 쓰지 않습니다. 색은 상태
(`ok` / `warn` / `danger`)에만 씁니다 (§2.4).

---

## 6. 아이콘 크기

Lucide React 기준.

| 용도 | 크기 |
|---|---|
| 토글 chevron | `10` |
| 버튼 내부 아이콘 (표준) | `12` |
| 상태 / 프로세스 아이콘 | `12`–`14` |
| 헤더 액션, 네비게이션 | `14`–`15` |
| 큰 상태 아이콘 | `16` |
| 빈 상태 | `28` |
| 전체 화면 로딩 스피너 | `32` |

> `9`, `11`은 쓰지 말고 `10` 또는 `12`로 통일하세요.

---

## 7. 카드 & 패널

### 7.1 표준 카드 — `Card` 컴포넌트

```
외곽: rounded-lg border border-line bg-surface
헤더: px-4 py-3 bg-surface-muted border-b border-line
  → 제목: text-sm font-medium text-fg-body
  → step 뱃지: size-5 rounded bg-surface-raised text-fg-muted font-mono
바디: p-4
```

### 7.1a 빈 상태

"아직 없음"은 어디서나 `EmptyState`로 그립니다. 카드 본문은 기본, 고정 크기 영역
(카메라 프리뷰 상자, 짧은 목록)은 `compact`. 회색 텍스트 한 줄이나 "Waiting..." 같은
임시 마크업을 직접 쓰지 마세요.

### 7.1b 매핑 안 된 장치

장치 목록에서 아직 역할이 없는 장치는 **어느 페이지에서나 같은 강도로 낮춥니다**:
이름·경로 `text-fg-disabled`, 오른쪽에 `unmapped` 칩, 카드 제목은
`Cameras (2 of 3 mapped)`처럼 쓸 수 있는 수를 먼저 보여 줍니다 (Status 페이지 참고).

### 7.2 상태 배너

```
성공: rounded-lg border border-ok-line     bg-ok-bg     p-4
주의: rounded-lg border border-warn-line   bg-warn-bg   p-4
오류: rounded-lg border border-danger-line bg-danger-bg p-4
```

`BlockerCard`(Start 불가 경고)가 `warning` / `error` severity로 이 패턴을 캡슐화합니다.

---

## 8. 칩 & 뱃지

`StatusBadge`는 상태별 아이콘을 렌더링합니다 — `running`은 ping 애니메이션 점,
`ready`는 CheckCircle, `loading`은 스피너, `warning`/`blocked`는 AlertTriangle,
`error`는 AlertCircle, `idle`은 Circle.

**칩에는 아직 공유 컴포넌트가 없습니다.** 페이지마다 아래 형태를 직접 조합하고 있습니다:

```
inline-flex items-center gap-1 px-2 py-0.5 rounded border text-sm
{ 중립: bg-surface-sunken text-fg-muted border-line-control }
{ 상태: bg-{tone}-bg text-{tone} border-{tone}-line }
```

> **알려진 격차**: 이 패턴이 여러 페이지에 중복되어 있고, 일부는 `rounded-full`을,
> 일부는 `rounded`를 씁니다. `Chip` 컴포넌트로 추출하는 것이 다음 정리 대상입니다.
> 새 칩을 만들 때는 위 형태와 `rounded`를 따르세요.

---

## 9. 탭 & 네비게이션

### 9.1 Pill 탭 — `SubTabs` / `ModeToggle`

앱의 세그먼트 컨트롤은 **이 한 가지 모양**뿐입니다. 둘은 같은 스타일을 공유하며
`ModeToggle`은 문자열 옵션용, `SubTabs`는 key + icon용 편의 API입니다.

```
컨테이너: inline-flex gap-1 bg-surface-sunken rounded-lg w-fit  + p-1 (md) / p-0.5 (sm)
비활성:   rounded-md text-sm font-medium text-fg-muted hover:text-fg-body
활성:     rounded-md text-sm font-medium bg-surface-elevated text-fg shadow-sm
md:       px-3.5 py-1.5  — 페이지 하위 탭, 헤더의 모드 전환
sm:       px-3   py-1    — 폼 안에서 h-9 입력 옆에 놓이는 값 선택 (Local/HF, 프리셋)
```

인라인으로 알약 버튼 묶음을 만들지 마세요. 검정 채움 활성 상태, 테두리 그룹 등
변형은 모두 이 컴포넌트로 통합되었습니다.

### 9.2 파이프라인 네비게이션 — `StepperNav`

페이지 상단의 이전/다음 + 진행 바. 8단계 워크플로우
(Status → Motor Setup → Camera Setup → Teleop → Record → Dataset → Train → Eval)를
`PIPELINE_STEPS`로 관리합니다. 탭이 바뀌면 이 배열을 갱신하세요.

---

## 10. 진행률 & 리소스

```
프로그레스 트랙: h-2.5 rounded-full bg-surface-raised overflow-hidden
프로그레스 바:   h-full rounded-full transition-all duration-500
                 bg-fg (일반) 또는 bg-ok-solid (성공/녹화)
```

`ResourceBar` — 트랙 `h-1.5 bg-surface-raised`, 바 색상은 사용률에 따라
`bg-ok-solid` (<70%) → `bg-warn-solid` (≥70%) → `bg-danger-solid` (≥90%).

---

## 11. 레이아웃

### 11.1 앱 쉘

```
루트:   h-screen flex flex-col bg-canvas overflow-hidden
헤더:   h-11 flex-none
메인:   flex flex-1 overflow-hidden
  사이드바: w-52 (펼침) / w-12 (접힘)
  콘텐츠:   flex-1 overflow-y-auto
콘솔:   flex-none (하단 고정)
```

### 11.2 페이지 구조

```tsx
<div className="flex flex-col h-full">
  <StepperNav currentPath="/train" />

  <div className="flex-1 overflow-y-auto">
    <div className="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
      <PageHeader title="Train" subtitle="..." />
      {/* 컨텐츠 */}
    </div>
  </div>

  <StickyControlBar>{/* Start/Stop */}</StickyControlBar>
</div>
```

### 11.3 반응형 그리드

```
1:1 분할:      grid grid-cols-1 lg:grid-cols-2 gap-6
3열:           grid grid-cols-1 md:grid-cols-3 gap-4
사이드바형:    grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6
카메라 그리드: grid grid-cols-1 sm:grid-cols-2 gap-3
```

---

## 12. 강제 장치

### 12.1 ESLint — 위반 0, 즉시 에러

`frontend/eslint-rules/design-system.mjs` (의존성 없는 로컬 플러그인).

| 룰 | 적용 범위 | 잡는 것 |
|---|---|---|
| `design/no-arbitrary-text-size` | `src/**` | `text-[10px]` 같은 임의 크기 |
| `design/no-arbitrary-color` | `src/**` | `bg-[#fff]` 같은 임의 색상 |
| `design/no-unapproved-palette` | `src/**` | 시스템이 정의하지 않은 팔레트 (`purple-400` 등) |
| `design/prefer-design-token` | `components/wireframe/**`, `components/ui/**` | 원시 팔레트 유틸리티 전부 |

`prefer-design-token`이 공유 컴포넌트에만 걸리는 이유: 이 레이어는 **이미 100% 토큰화되어 있고**,
모든 페이지가 여기서 조합되므로 원시 값 하나가 전체로 새어 나갑니다.

### 12.2 래칫 — 페이지 레이어의 잔여 부채

페이지 컴포넌트에는 토큰 도입 이전의 원시 팔레트가 남아 있습니다. 한 번에 옮길 가치는 없지만
**다시 늘어나서는 안 되므로**, 스크립트가 수치를 측정하고 증가하면 CI를 실패시킵니다.

```bash
npm run design:audit              # 기준선 대비 검사
npm run design:audit -- --report  # 파일별 최다 위반 목록
npm run design:audit -- --update  # 현재 수치를 새 기준선으로 확정
```

측정 항목 (`design-baseline.json`):

| 항목 | 의미 |
|---|---|
| `rawPaletteUtilities` | 원시 팔레트 색상 유틸리티 총 개수 |
| `classNamesMissingDark` | 라이트 팔레트 색을 쓰면서 `dark:` 짝이 전혀 없는 className |
| `hexLiterals` | 하드코딩된 hex 색상 (`useChartTokens.ts`의 폴백만 예외) |

**부채를 줄였다면 `--update`로 기준선을 내려 잠그세요.** 그래야 래칫이 앞으로만 조여집니다.

### 12.3 CI

`.github/workflows/ci.yml`의 frontend 잡이 매 푸시마다 실행합니다:

```
npm run lint         # ESLint (디자인 룰 포함), --max-warnings=0
npm run typecheck    # tsc -b (app + node 프로젝트 모두)
npm run design:audit # 래칫
npm test -- --run
npm run test:e2e
npm run build
```

> `typecheck`는 `tsc -b`입니다. 예전의 `tsc --noEmit`은 루트 tsconfig가 `"files": []`에
> 프로젝트 참조만 갖고 있어서 **아무것도 검사하지 않았습니다.** 되돌리지 마세요.

---

## 13. 공유 컴포넌트

`components/wireframe/index.tsx`에서 제공합니다. **공유 컴포넌트가 있으면 네이티브 HTML 대신 쓰세요.**

| 컴포넌트 | 용도 |
|---|---|
| `PageHeader` | 페이지 제목 + 부제 + 액션 |
| `SectionHeader` | 독립 섹션 제목 (step 뱃지 지원) |
| `Card` | 표준 카드 (헤더 + 바디) |
| `StatusBadge` | 상태 아이콘 (running/ready/loading/warning/error/idle/blocked) |
| `BlockerCard` | Start 불가 경고 + 해결 링크 |
| `ProcessButtons` | Start / Stop |
| `StickyControlBar` | 하단 고정 제어 바 |
| `WireInput` | 표준 텍스트 입력 |
| `WireSelect` | 표준 셀렉트 |
| `WireToggle` | 토글 스위치 |
| `FieldRow` | 라벨 + 컨트롤 행 |
| `ModeToggle` | 문자열 옵션 세그먼트 컨트롤 (`size`: md / sm) |
| `SubTabs` | key + icon 세그먼트 컨트롤 (`size`: md / sm) |
| `StepperNav` | 파이프라인 이전/다음 + 진행 바 |
| `RefreshButton` | 아이콘 새로고침 버튼 |
| `ResourceBar` | 사용률 바 (임계값 색상) |
| `WireBox` | 점선 플레이스홀더 |
| `EmptyState` | 빈 상태 메시지 (`compact`: 프리뷰 상자·짧은 목록용) |
| `SectionLabel` | 카드 안 그룹 구분용 대문자 레이블 (§5.4) |

별도 파일: `ArmPairSelector` (`components/wireframe/ArmPairSelector.tsx`).

---

## 14. 체크리스트

새 컴포넌트나 페이지를 만들 때:

- [ ] 색상이 **전부 토큰**인가? (`zinc-`, `emerald-` 등 원시 팔레트 0개)
- [ ] 따라서 색상에 `dark:` 접두사를 쓰지 **않았는가**?
- [ ] 읽어야 하는 텍스트에 `text-fg-disabled`를 쓰지 않았는가?
- [ ] 입력 높이가 `h-9`인가? (`WireInput` / `WireSelect` 사용)
- [ ] 버튼이 `buttonStyles()`를 통하는가?
- [ ] 텍스트 크기가 명명된 단계인가? (`text-[Npx]` 없음)
- [ ] 아이콘 크기가 §6을 따르는가?
- [ ] 차트가 `useChartTokens()`를 쓰는가?
- [ ] 페이지 래퍼가 `p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full`인가?
- [ ] `npm run lint && npm run typecheck && npm run design:audit` 통과하는가?

---

## 15. 유지보수 규칙

- **토큰을 추가하면** `:root`와 `.dark` **양쪽**에 정의하고 `@theme inline`에 노출하세요.
  한쪽만 정의하면 다른 테마에서 조용히 상속됩니다.
- **전경 토큰을 추가하면** 대상 표면 위 대비를 계산해서 표에 적으세요. 본문은 4.5:1이 기준입니다.
- **탭 구조나 핵심 CTA 위계가 바뀌면** `StepperNav`의 `PIPELINE_STEPS`와 사이드바 구성을 함께 갱신하세요.
- **사용자에게 보이는 기능이 바뀌면** `docs_public/feature-spec.md`, `README.md`, `README.ko.md`를
  같은 변경 세트에서 동기화하세요 (`CONTRIBUTING.md` 참조).
