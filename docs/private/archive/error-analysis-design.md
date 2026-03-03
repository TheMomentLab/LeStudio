# Error Analysis 설계서 — 2-Layer Error Translation

최종 갱신: 2026-02-24

## 1. 배경 및 문제

### 현재 에러 처리 파이프라인

```
subprocess stdout/stderr
  → ProcessManager._reader() 스레드
    → _translate_error_line() : 5개 regex 매칭
      → 매칭 시: [GUIDE] 메시지 push (kind="translation")
      → 미매칭: raw text만 push (kind="stdout")
  → out_q (공유 큐)
    → WebSocket /ws → 프론트엔드
      → LogConsole: className="line-{kind}" 로 렌더링
```

### 현재 커버되는 에러 (5개)

| 패턴 | GUIDE 메시지 |
|---|---|
| Permission denied `/dev/*` | udev rule 안내 |
| Calibration file missing | Calibration 탭 안내 |
| Camera open failed | USB/매핑 확인 안내 |
| CUDA OOM | batch/device 전환 안내 |
| CUDA unavailable | PyTorch CUDA 설치 안내 |

### 핵심 문제

Train/Eval은 PyTorch + HuggingFace + Hydra + 하드웨어 조합으로 에러 종류가 극도로 다양하다. 현재 5개 regex로는 전체 에러의 **10~15%만 커버**되며, 나머지 85%+는 raw traceback이 콘솔에 출력될 뿐 유저에게 actionable guidance가 없다.

### Train 크래시 시나리오

| 원인 | 발생 가능성 | 현재 방어 |
|---|---|---|
| 데이터셋 경로 없음 / 형식 불일치 | **높음** | ❌ 없음 |
| Policy-Dataset 구조 불일치 (카메라 키 등) | **높음** | ❌ 없음 |
| GPU OOM (batch_size 과다) | 중간 | ⚠️ 런타임 regex만 |
| 디스크 풀 (체크포인트 저장 실패) | 중간 | ❌ 없음 |
| wandb/tensorboard import 실패 | 낮음 | ❌ 없음 |
| 잘못된 lr 값 (문자열 등) | 낮음 | ❌ command_builder에서 `float()` 크래시 |
| lerobot 버전 불일치 (CLI 인자 변경) | 중간 | ❌ 없음 |

### Eval 크래시 시나리오

| 원인 | 발생 가능성 | 현재 방어 |
|---|---|---|
| 체크포인트 경로 없음 | **높음** | ❌ 프론트 수동입력뿐 |
| Policy-Dataset 불일치 | **높음** | ❌ 없음 |
| 환경/태스크 설정 오류 | 높음 | ❌ 없음 |
| 로봇 미연결 (real-world eval) | 높음 | ❌ 없음 |
| device 불일치 | 중간 | ⚠️ preflight만 |

---

## 2. 설계: 2-Layer Error Translation

```
                    ┌─────────────────────────┐
                    │   subprocess crashes     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Layer 1: Regex Engine   │
                    │  (즉시, 오프라인, 비용 0)  │
                    │  _translate_error_line() │
                    │  기존 5개 → 25~30개 확장  │
                    └────────────┬────────────┘
                          ┌──────┴──────┐
                       매칭 O         매칭 X
                          │              │
                    [GUIDE] push    ┌────▼────────────┐
                                   │ Layer 2: LLM     │
                                   │ (프로세스 종료 시)  │
                                   │ 마지막 N줄 수집    │
                                   │ → LLM API 1회 호출 │
                                   └────────┬────────┘
                                            │
                                     [AI GUIDE] push
```

**Layer 1** — 고빈도 에러 25~30개를 regex로 즉시 번역. 오프라인 동작, 비용 없음.
**Layer 2** — regex 미매칭 에러에 한해 프로세스 종료 시 1회 LLM 호출. Free-tier LLM API 활용.

---

### LLM Provider 선정 기준

Layer 2에서 사용할 LLM API는 **무료(free-tier)** 를 기본으로 한다. 로그인/API 키 발급 없이 사용 가능한 legitimate LLM API는 현재 존재하지 않으므로, 유저가 API 키를 직접 발급받아 입력하는 구조를 채택한다.

#### Provider 비교

| Provider | 무료 여부 | 가입 절차 | 신용카드 | 무료 한도 | 기본 모델 | 비고 |
|---|---|---|---|---|---|---|
| **Gemini** (Google AI Studio) | ✅ 완전 무료 | Google 계정 → AI Studio에서 키 발급 (60초) | ❌ 불필요 | 15 RPM, 100만 토큰/일 | `gemini-2.0-flash` | **기본값 추천.** 한도 넉넉, 한국어 우수 |
| **Groq** | ✅ 완전 무료 | 이메일 가입 → 키 발급 | ❌ 불필요 | 30 RPM, 6K tokens/min | `llama-3.3-70b-versatile` | 응답 속도 최고 |
| **OpenRouter** (free 모델) | ✅ 완전 무료 | 이메일/GitHub/Google 가입 → 키 발급 | ❌ 불필요 | 50 req/day (무료 모델) | `google/gemini-2.0-flash-exp:free` | 모델 선택지 다양, 일일 한도 낮음 |
| **DeepSeek** | ⚠️ 크레딧 소진 후 유료 | 이메일/전화 가입 → 키 발급 | 크레딧 소진 후 필요 | 초기 ~500만 토큰 | `deepseek-chat` | 매우 저렴 ($0.28/M input), 완전 무료는 아님 |

#### 선정 결론

- **기본값: Gemini** — 대부분 Google 계정 보유, 무료 한도 충분, 신용카드 불필요
- **대안 1: Groq** — 속도 중시 유저용
- **대안 2: OpenRouter** — 다양한 무료 모델 실험용 (일일 50회 제한 주의)
- **대안 3: DeepSeek** — 품질 중시 유저용 (크레딧 소진 후 유료 전환 필요)

> 참고: Puter.js 등 "API 키 불필요" 서비스도 존재하나, 브라우저 전용(Python 백엔드 호출 불가)이거나 "User-Pays" 모델(결국 유저 로그인 필요)이므로 채택하지 않는다.

## 3. 백엔드 변경

### 3-1. `process_manager.py` — 프로세스별 최근 로그 버퍼

**목적:** LLM에 보낼 최근 에러 컨텍스트 수집.

현재 `out_q`는 공유 큐로 한 번 소비되면 사라진다. 프로세스별 최근 라인을 보존하기 위해 ring buffer를 추가한다.

```python
from collections import deque

class ProcessManager:
    def __init__(self, ...):
        # 기존
        self.procs: dict[str, subprocess.Popen] = {}
        self.out_q: queue.Queue = queue.Queue(maxsize=1000)
        # 추가
        self._recent_lines: dict[str, deque[str]] = {}   # per-process, maxlen=80
        self._tail_had_translation: dict[str, bool] = {} # 최근 20줄 내 regex 매칭 여부
```

`_reader()`에서:
- 모든 텍스트를 `_recent_lines[name]`에 append
- `_translate_error_line()` 매칭 시 해당 라인 인덱스를 기록

프로세스 시작 시:
- `_recent_lines[name]` 초기화, `_tail_had_translation[name] = False`

프로세스 종료 시 (`_reader()` 말미):
- `_recent_lines`의 **마지막 20줄** 내에 regex 매칭이 있었는지 계산하여 `_tail_had_translation[name]` 갱신
- 이렇게 하면 초반 경고성 매칭(예: Camera open)이 있어도, 말미에 다른 치명적 에러가 있으면 LLM fallback이 작동함

새 public 메서드:
- `get_recent_lines(name: str) -> list[str]`
- `had_tail_translation(name: str) -> bool` — 마지막 20줄 내 regex 매칭 여부

### 3-2. `_translate_error_line()` — Layer 1 regex 확장

기존 5개에 ~25개 패턴 추가. 카테고리별 정리:

#### Dataset 관련

| regex | GUIDE 메시지 |
|---|---|
| `FileNotFoundError.*dataset\|repo_id` | 데이터셋을 찾을 수 없습니다. repo_id를 확인하세요. |
| `KeyError.*(observation\|action\|image)` | 데이터셋 키가 정책과 불일치합니다. 동일 로봇/카메라 구성으로 녹화한 데이터셋을 사용하세요. |
| `ValueError.*(shape\|mismatch\|dimension)` | 데이터 shape이 정책과 맞지 않습니다. 정책 타입과 데이터셋 호환성을 확인하세요. |
| `EmptyDatasetError\|no episodes found\|dataset is empty` | 데이터셋이 비어있습니다. Record 탭에서 에피소드를 먼저 녹화하세요. |

#### PyTorch / CUDA 관련

| regex | GUIDE 메시지 |
|---|---|
| `RuntimeError.*out of memory` (non-GPU) | 시스템 메모리 부족. batch_size를 줄이거나 다른 프로세스를 종료하세요. |
| `NCCL\|distributed.*error` | 분산 학습 설정 오류. 단일 GPU 모드를 사용하세요. |
| `cuDNN\|cudnn.*error` | cuDNN 오류. PyTorch와 CUDA 버전 호환성을 확인하세요. |
| `Segmentation fault\|SIGSEGV` | 메모리 접근 오류(Segfault). 드라이버/PyTorch 재설치가 필요할 수 있습니다. |

#### Checkpoint / Eval 관련

| regex | GUIDE 메시지 |
|---|---|
| `FileNotFoundError.*(pretrained_model\|checkpoint)` | 체크포인트를 찾을 수 없습니다. 경로를 확인하거나 Train 탭에서 학습을 먼저 완료하세요. |
| `KeyError.*(policy\|state_dict)` | 체크포인트가 선택한 정책과 호환되지 않습니다. |
| `safetensors\|\.bin.*(corrupt\|invalid)` | 모델 파일이 손상되었습니다. 체크포인트를 다시 생성하세요. |

#### Config / Hydra 관련

| regex | GUIDE 메시지 |
|---|---|
| `hydra.*error\|omegaconf.*error\|Could not override` | 설정 파라미터 오류. LeRobot 버전과 CLI 인자 호환성을 확인하세요. |
| `InterpolationError\|MissingMandatoryValue` | 필수 설정 값이 누락되었습니다. |

#### Import / 의존성 관련

| regex | GUIDE 메시지 |
|---|---|
| `ModuleNotFoundError\|ImportError` | 필요한 패키지가 설치되지 않았습니다. (모듈명 추출하여 안내) |
| `wandb.*(error\|failed)` | Weights & Biases 연동 오류. 무시하거나 `wandb offline`으로 전환하세요. |

#### 하드웨어 / 시스템 관련

| regex | GUIDE 메시지 |
|---|---|
| `USB.*error\|device.*disconnect` | USB 장치 연결이 끊어졌습니다. 케이블과 연결 상태를 확인하세요. |
| `No space left\|OSError.*28\|disk.*full` | 디스크 공간이 부족합니다. 불필요한 체크포인트나 데이터셋을 정리하세요. |
| `Timeout\|timed out\|deadline exceeded` | 작업 시간 초과. 네트워크 상태를 확인하거나 재시도하세요. |
| `PermissionError(?!.*/dev/)` | 파일 접근 권한 오류. 해당 디렉토리의 권한을 확인하세요. |

> 참고: 기존 `/dev/*` Permission 패턴은 그대로 유지. 새 패턴은 non-device PermissionError용.

> **과매칭 방어 가이드라인:** 신규 패턴 구현 시 아래 원칙을 따른다.
> - `KeyError`, `ModuleNotFoundError` 등 범용 예외 패턴은 반드시 **에러 컨텍스트 키워드**를 함께 매칭한다 (예: `KeyError` 단독이 아닌 `KeyError.*(observation|action|image)`처럼).
> - `Timeout|timed out`은 `(?i)(?:error|fatal|crash).*(?:timeout|timed out)|(?:timeout|timed out).*(?:error|fatal|crash)` 형태로 에러 문맥과 결합한다.
> - 새 패턴 추가 시 반드시 정상 로그(non-error)에서 false positive가 발생하지 않는지 단위 테스트로 검증한다.

### 3-3. 새 모듈: `src/lestudio/error_analyzer.py`

**역할:** Layer 2 LLM 호출 전담.
**제약:** `lerobot.*` import 금지 (결합 경계 준수).

```python
"""error_analyzer.py — LLM 기반 에러 분석 모듈.

subprocess 에러 로그를 Free LLM API로 분석하여
사용자 친화적 가이드를 생성한다.
lerobot 의존성 없음.
"""

import httpx
import json
import re
import logging

logger = logging.getLogger(__name__)

PROVIDERS = {
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "default_model": "gemini-2.0-flash",
        "auth": "query_param",   # ?key=API_KEY
        "free": True,
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "default_model": "llama-3.3-70b-versatile",
        "auth": "bearer",        # Authorization: Bearer API_KEY
        "free": True,
    },
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "default_model": "google/gemini-2.0-flash-exp:free",
        "auth": "bearer",
        "free": True,
    },
    "deepseek": {
        "url": "https://api.deepseek.com/chat/completions",
        "default_model": "deepseek-chat",
        "auth": "bearer",        # OpenAI-compatible format
        "free": False,            # 초기 크레딧 후 유료
    },
}

SYSTEM_PROMPT = """You are an error analyst for LeRobot Studio, a GUI for robotic manipulation training.
Given a process log that ended with an error, provide:
1. Root cause (1 sentence)
2. How to fix it (1-3 actionable steps)

Be concise. The user is not a CLI expert.
Reply in the same language the log context suggests, defaulting to Korean if ambiguous.
Do NOT include code blocks or markdown formatting."""

TIMEOUT_SECONDS = 15
MAX_RESPONSE_CHARS = 500
MAX_INPUT_LINES = 50
```

핵심 함수:

```python
def _mask_private_info(text: str) -> str:
    """경로의 유저명, API 키 등을 마스킹."""
    text = re.sub(r'/home/[^/\s]+', '/home/<user>', text)
    text = re.sub(r'/Users/[^/\s]+', '/Users/<user>', text)
    text = re.sub(r'hf_[A-Za-z0-9]{10,}', 'hf_***', text)
    text = re.sub(r'(key|token|secret)\s*[:=]\s*\S+', r'\1=***', text, flags=re.IGNORECASE)
    return text


async def analyze_error(
    provider: str,
    api_key: str,
    recent_lines: list[str],
    process_name: str,
    model: str | None = None,
) -> str | None:
    """LLM API를 호출하여 에러 분석 결과를 반환. 실패 시 None."""
    if not api_key or not recent_lines:
        return None

    masked = _mask_private_info("\n".join(recent_lines[-MAX_INPUT_LINES:]))
    user_msg = f"Process '{process_name}' crashed. Last {len(recent_lines)} lines:\n\n{masked}"

    try:
        # provider별 요청 구성 (Gemini vs OpenAI-compatible)
        ...
        # httpx.AsyncClient 로 호출
        ...
        # 응답 파싱 → 텍스트 추출 → MAX_RESPONSE_CHARS 로 자르기
        ...
    except Exception as e:
        logger.warning("Error analysis failed: %s", e)
        return None


async def test_connection(provider: str, api_key: str, model: str | None = None) -> dict:
    """API 키 유효성 테스트. {"ok": bool, "error"?: str}"""
    ...
```

**설계 원칙:**
- `httpx.AsyncClient`로 비동기 호출 (FastAPI 이벤트 루프 활용)
- 타임아웃: 15초 hard limit
- 실패 시 None 반환 (graceful degradation, 예외 전파 없음)
- 프로세스당 1회만 호출 (중복 방지)
- 입력 마스킹: 유저 경로, HF 토큰, API 키 등 제거 후 전송
- 응답 길이 제한: 500자

### 3-4. `server.py` — 프로세스 종료 시 LLM 호출 연결

기존 `_on_process_exit(name)` 콜백을 확장한다.

```python
import asyncio
from lestudio.error_analyzer import analyze_error

# _on_process_exit 내부 또는 별도 함수
async def _maybe_analyze_error(name: str):
    """프로세스 종료 시 LLM 에러 분석 (조건부)."""
    # 1. train, eval에서만 작동
    if name not in ("train", "eval"):
        return

    # 2. 설정 확인
    cfg = load_config()
    if not cfg.get("error_analysis_enabled"):
        return

    # 3. 최근 20줄 내에서 regex가 이미 번역했으면 스킵
    #    (초반 매칭은 무시 — 말미 크래시에 대한 LLM 분석이 더 유용)
    if proc_mgr.had_tail_translation(name):
        return

    # 4. 최근 라인에 에러 시그널이 있는지 확인
    recent = proc_mgr.get_recent_lines(name)
    has_error = any(
        re.search(r'Traceback|Error|Exception|failed|\[ERROR\]', line, re.I)
        for line in recent
    )
    if not has_error:
        return

    # 5. LLM 호출
    provider = cfg.get("error_analysis_provider", "gemini")
    api_key = cfg.get("error_analysis_api_key", "")
    model = cfg.get("error_analysis_model") or None
    if not api_key:
        return

    result = await analyze_error(provider, api_key, recent, name, model)
    if result:
        proc_mgr._push(name, f"[AI GUIDE] {result}", "ai_guide")
```

`_on_process_exit`는 동기 콜백이므로, `asyncio.run_coroutine_threadsafe()`로 이벤트 루프에 전달한다.

**이벤트 루프 참조 획득:** `create_app()` 스코프 내에서 startup 이벤트로 루프를 캡처한다.

```python
_event_loop: asyncio.AbstractEventLoop | None = None

@app.on_event("startup")
async def _capture_event_loop():
    nonlocal _event_loop
    _event_loop = asyncio.get_running_loop()

def _on_process_exit(name: str):
    # 기존 로직
    if name in {"record", "teleop"}:
        unlock_cameras()
    append_history(f"{name}_end")
    # LLM 에러 분석 (비동기 → 이벤트 루프로 전달)
    if _event_loop is not None:
        asyncio.run_coroutine_threadsafe(_maybe_analyze_error(name), _event_loop)
```

### 3-5. `server.py` — API 키 테스트 엔드포인트

```python
@app.post("/api/error-analysis/test")
async def api_error_analysis_test(data: dict):
    provider = str(data.get("provider", "gemini"))
    api_key = str(data.get("api_key", ""))
    model = data.get("model") or None
    if not api_key:
        return {"ok": False, "error": "API key is required."}
    result = await test_connection(provider, api_key, model)
    return result
```

### 3-6. Config 키

기존 `/api/config` POST로 통합. 별도 엔드포인트 불필요.

```json
{
  "error_analysis_enabled": false,
  "error_analysis_provider": "gemini",
  "error_analysis_api_key": "",
  "error_analysis_model": ""
}
```

- `error_analysis_enabled`: 기본 OFF (명시적 opt-in)
- `error_analysis_provider`: `"gemini"` | `"groq"` | `"openrouter"` | `"deepseek"`
- `error_analysis_api_key`: 유저가 입력한 API 키
- `error_analysis_model`: 빈 문자열이면 provider 기본 모델 사용

---

## 4. 프론트엔드 변경

### 4-1. `index.css` — AI Guide 스타일

기존 `[GUIDE]` (노란색)와 시각적으로 구분되는 보라색 스타일:

```css
.terminal .line-ai_guide {
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.14);
  border: 1px solid rgba(139, 92, 246, 0.30);
  border-radius: 6px;
  padding: 6px 8px;
  margin: 4px 0;
}
.terminal .line-ai_guide::before {
  content: '✦ ';
  opacity: 0.7;
}
```

| kind | 색상 | 용도 |
|---|---|---|
| `stdout` | 회색 (`#c9d1d9`) | 일반 출력 |
| `error` | 빨강 (`var(--red)`) | 에러 라인 |
| `info` | 노랑 (`var(--yellow)`) | 정보 |
| `translation` | 노랑 배경 (`#fef3c7`) | **기존** regex GUIDE |
| `ai_guide` | 보라 배경 (`#c4b5fd`) | **신규** LLM GUIDE |

### 4-2. Settings UI

TrainTab.tsx의 Configuration 카드 하단에 접이식(collapsible) 섹션 추가:

```
┌─────────────────────────────────────────┐
│ Error Analysis (AI)              [▾]    │
│                                         │
│ [Toggle] Enable AI error analysis       │
│                                         │
│ Provider: [Gemini ▾]                    │
│ API Key:  [••••••••••••••]    [Test]    │
│                                         │
│ ⓘ Free-tier API를 사용합니다.             │
│   에러 로그(개인정보 마스킹됨)가            │
│   외부 서버로 전송됩니다.                  │
└─────────────────────────────────────────┘
```

- Provider 드롭다운: Gemini (추천) / Groq / OpenRouter / DeepSeek
- API Key: `type="password"` + Test 버튼 (POST `/api/error-analysis/test`)
- Toggle: 기본 OFF
- 프라이버시 안내 문구 필수 표시
- 모든 값은 기존 `buildConfig()`로 config에 저장
- **Train/Eval 공용 안내:** "이 설정은 Train과 Eval 프로세스 모두에 적용됩니다." 문구를 섹션 상단에 표시
### 4-3. `ConsoleDrawer.tsx` — kind 매핑 수정

**현재 문제:** 글로벌 콘솔(`ConsoleDrawer.tsx`)은 `kind`별 className을 하드코딩하고 있어, `translation`과 `ai_guide`가 모두 `line-stdout`(회색)으로 렌더링된다.

```tsx
// 현재 (ConsoleDrawer.tsx L193-199) — translation, ai_guide가 회색으로 떨어짐
className={
  line.kind === 'stderr' || line.kind === 'error'
    ? 'line-error'
    : line.kind === 'info'
      ? 'line-info'
      : 'line-stdout'   // ← translation, ai_guide 모두 여기
}
```

**수정:** `LogConsole.tsx`와 동일한 동적 매핑으로 변경한다.

```tsx
// 수정 후 — 모든 kind가 올바른 CSS 클래스를 받음
className={`line-${
  line.kind === 'stderr' ? 'error' : line.kind
}`}
```

이렇게 하면 `stderr` → `line-error` 매핑은 유지하면서, `translation` → `line-translation`, `ai_guide` → `line-ai_guide` 등 모든 kind가 대응하는 CSS 클래스를 자동으로 받는다.

> 참고: 이 변경은 기존 `translation` kind의 ConsoleDrawer 렌더링도 함께 수정하는 부수 효과가 있다 (기존 버그 해소).

### 4-4. `useWebSocket.ts`

**변경 없음.** `kind: "ai_guide"`는 기존 `appendLog(msg.process, text, kind)` 파이프라인으로 자연스럽게 흐른다. `LogConsole.tsx`와 수정된 `ConsoleDrawer.tsx` 모두에서 CSS 클래스 `line-ai_guide`가 자동 적용됨.
---

## 5. 데이터 플로우 (종합)

### 정상 에러 (regex 매칭)
```
lerobot crash → stderr "CUDA out of memory..."
  → _reader() → _translate_error_line() 매칭!
  → out_q: [GUIDE] "GPU 메모리 부족. batch_size를 줄이세요."
  → _had_translation["train"] = True
  → WebSocket → 프론트엔드: 노란색 GUIDE 박스
  → 프로세스 종료 → _on_process_exit
  → _had_translation = True → LLM 호출 스킵
```

### 미매칭 에러 (LLM fallback)
```
lerobot crash → stderr "KeyError: 'observation.images.laptop'"
  → _reader() → _translate_error_line() 미매칭
  → out_q: raw text (kind="stdout")
  → _had_translation["train"] = False
  → WebSocket → 프론트엔드: 회색 텍스트
  → 프로세스 종료 → _on_process_exit
  → _had_translation = False, 에러 시그널 있음
  → config에서 API key 확인 → LLM 호출
  → 응답: "데이터셋에 'observation.images.laptop' 키가 없습니다.
           카메라 매핑이 학습 시와 다를 수 있습니다.
           Record 시 동일한 카메라 구성을 사용하세요."
  → out_q: [AI GUIDE] (kind="ai_guide")
  → WebSocket → 프론트엔드: 보라색 AI GUIDE 박스
```

### 정상 종료
```
lerobot train 완료 → exit code 0
  → 프로세스 종료 → _on_process_exit
  → 에러 시그널 없음 → LLM 호출 스킵
```

### API 키 미설정
```
에러 발생 → regex 미매칭 → LLM 호출 시도
  → api_key 빈 문자열 → 즉시 return None
  → 아무 것도 push하지 않음 (기존 동작 유지)
```

---

## 6. 구현 순서

### Phase A: Layer 1 Regex 확장 (예상 1일)

| 단계 | 파일 | 작업 |
|---|---|---|
| A-1 | `process_manager.py` | `_translate_error_line()`에 ~25개 패턴 추가 |
| A-2 | `process_manager.py` | `_recent_lines` deque 버퍼 + `_had_translation` 플래그 추가 |
| A-3 | `process_manager.py` | `get_recent_lines()`, `had_translation()` public 메서드 추가 |
| A-4 | — | 단위 테스트: 기존 5개 + 신규 패턴 매칭 검증 |

**Phase A 완료 시점 체감:** 기존 대비 에러 커버리지 10~15% → 50~60%로 즉시 개선. LLM 없이 동작.

### Phase B: Layer 2 LLM 모듈 (예상 1일)

| 단계 | 파일 | 작업 |
|---|---|---|
| B-1 | `error_analyzer.py` (신규) | 프라이버시 마스킹 함수 |
| B-2 | `error_analyzer.py` | Gemini provider 구현 (기본값) |
| B-3 | `error_analyzer.py` | Groq / OpenRouter / DeepSeek provider 구현 (OpenAI-compatible 공통) |
| B-4 | `error_analyzer.py` | `analyze_error()` 메인 함수, `test_connection()` |
| B-5 | `server.py` | `_on_process_exit` 확장 — LLM 호출 연결 |
| B-6 | `server.py` | `POST /api/error-analysis/test` 엔드포인트 |
| B-7 | — | 실제 lerobot 에러 로그로 각 provider 테스트 |

### Phase C: 프론트엔드 (예상 0.5일)

| 단계 | 파일 | 작업 |
|---|---|---|
| C-1 | `index.css` | `.line-ai_guide` 스타일 추가 |
| C-2 | `ConsoleDrawer.tsx` | kind 매핑을 동적 className으로 수정 |
| C-3 | `TrainTab.tsx` | Error Analysis 설정 UI (접이식 섹션) |
| C-4 | — | buildConfig 연동 확인 (기존 패턴 그대로) |

### Phase D: 통합 테스트 (예상 0.5일)

- [ ] Train 크래시 — 잘못된 dataset → regex 매칭 확인
- [ ] Eval 크래시 — 없는 checkpoint → regex 매칭 확인
- [ ] regex 미매칭 에러 → LLM fallback 호출 확인
- [ ] API 키 미설정 → graceful skip 확인
- [ ] API 호출 실패 / 타임아웃 → graceful degradation 확인
- [ ] 프라이버시 마스킹 검증 (경로, 토큰)
- [ ] 프로세스 정상 종료 → LLM 미호출 확인
- [ ] 동일 프로세스 중복 호출 방지 확인

---

## 7. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| Free API rate limit 초과 | 프로세스당 1회 호출 + 1분 쿨다운 |
| API 응답 지연 (>15s) | httpx hard timeout → 분석 없이 종료 |
| 잘못된/무관한 LLM 응답 | 응답 길이 제한 (500자) + `[AI GUIDE]` 배지로 AI 생성임 명시 |
| 프라이버시 우려 | 마스킹 + 기본 OFF + 명시적 opt-in + UI 안내 문구 |
| lerobot 결합 경계 위반 | `error_analyzer.py`에 lerobot import 없음 — 순수 HTTP 클라이언트 |
| httpx 의존성 추가 | `pyproject.toml`에 `httpx>=0.25.0` 명시 추가. FastAPI 프로젝트 표준 HTTP 클라이언트 |

---

## 8. 파일 변경 요약

| 파일 | 변경 유형 | 설명 |
|---|---|---|
| `src/lestudio/process_manager.py` | **수정** | regex 확장, ring buffer, had_tail_translation 플래그 |
| `src/lestudio/error_analyzer.py` | **신규** | LLM 호출 모듈 (Gemini/Groq/OpenRouter/DeepSeek) |
| `src/lestudio/server.py` | **수정** | on_process_exit 연동, 이벤트 루프 캡처, /api/error-analysis/test |
| `pyproject.toml` | **수정** | `httpx>=0.25.0` 의존성 추가 |
| `frontend/src/index.css` | **수정** | .line-ai_guide 스타일 |
| `frontend/src/components/shared/ConsoleDrawer.tsx` | **수정** | kind → className 동적 매핑 (기존 translation 버그도 해소) |
| `frontend/src/tabs/TrainTab.tsx` | **수정** | Error Analysis 설정 UI |

**수정 파일 6개, 신규 파일 1개.** 기존 아키텍처 패턴(config 저장, WebSocket push, CSS kind 클래스)을 그대로 활용하므로 새로운 패러다임 도입 없음.
