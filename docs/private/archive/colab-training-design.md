# LeStudio — Colab 원격 학습 설계

최종 갱신: 2026-02-25
상태: 설계 초안 (미구현)

---

## 1. 배경

LeStudio는 로컬 GPU에서 학습을 실행한다. 하지만 많은 사용자가 GPU가 없거나 부족하다.
Google Colab은 무료 T4 GPU를 제공하므로, LeStudio에서 Colab 학습을 지원하면:

- GPU 없는 사용자의 진입장벽을 제거
- phosphobot의 유료 클라우드 학습 (€35/월)을 무료로 대체
- "완전 무료" 포지셔닝을 강화

### 1.1 제약 사항

- **Colab에는 프로그래밍 방식의 작업 제출 API가 없다.** "버튼 하나로 Colab에서 학습 시작"은 불가능.
- 따라서 학습 설정을 Colab 노트북에 전달하는 **우회 경로**가 필요함.

---

## 2. 접근법 비교

### 방법 1: HF Hub 경유 (추천)

```
[LeStudio Train 탭에서 학습 설정]
    ↓
[training_config.json을 HF Hub repo에 push]  ← 이미 Hub push 기능 있음
    ↓
[정적 템플릿 Colab 노트북 열기]  ← 템플릿 파일 추가 필요
    ↓
[노트북이 HF Hub에서 config 자동 다운로드 → 학습 실행]
    ↓
[체크포인트를 HF Hub에 push]
    ↓
[LeStudio에서 체크포인트 다운로드 → Eval]
```

**장점:**
- HF Hub push는 LeStudio에 이미 구현됨 (`POST /api/datasets/{user}/{repo}/push`)
- 추가 인증 불필요 (사용자가 이미 `huggingface-cli login` 완료)
- 노트북은 정적 템플릿 하나로 충분 (동적 생성 불필요)
- Colab 링크는 템플릿 추가 후 확정

**단점:**
- 사용자가 Colab에서 "Run All"을 수동으로 눌러야 함
- Colab 무료 런타임 제한 (최대 ~12시간, 유휴 시 90분 타임아웃)

### 방법 2: GitHub Gist 생성

```
[LeStudio에서 학습 설정]
    ↓
[.ipynb JSON을 동적 생성 (config 값이 코드에 하드코딩)]
    ↓
[GitHub Gist API로 업로드]
    ↓
[https://colab.research.google.com/gist/{user}/{id}/train.ipynb 열기]
```

**장점:**
- 사용자는 "Run All"만 누르면 됨 (설정값이 코드에 박혀있음)
- 가장 자동화된 UX

**단점:**
- GitHub 토큰 추가 필요 (HF 토큰과 별개)
- Gist 관리 복잡성 (정리/삭제 필요)

### 방법 3: .ipynb 파일 다운로드

```
[LeStudio에서 학습 설정]
    ↓
[.ipynb 파일 동적 생성 → 브라우저 다운로드]
    ↓
[사용자가 Colab에 드래그앤드롭으로 업로드]
```

**장점:**
- 추가 인증 0
- 구현 가장 단순

**단점:**
- 수동 업로드 단계가 있어 UX 열화

---

## 3. 추천: 방법 1 (HF Hub 경유)

### 3.1 이유

1. **기존 인프라 재활용** — HF Hub push, HF 토큰, 데이터셋 관리가 이미 구현됨
2. **추가 인증 없음** — GitHub 토큰이나 Google OAuth 불필요
3. **정적 노트북** — 동적 .ipynb 생성 로직 불필요, 유지보수 최소
4. **양방향 연결** — config도 Hub, 체크포인트도 Hub → LeStudio가 자연스럽게 수신

### 3.2 사용자 흐름

1. Train 탭에서 학습 설정 완료 (dataset, policy, hyperparams)
2. **"Train on Colab"** 버튼 클릭
3. LeStudio가 `lestudio_train_config.json`을 HF Hub의 dataset repo에 push
4. 브라우저에서 Colab 노트북 자동 열림
5. 사용자가 HF 토큰 입력 + "Run All" 클릭
6. 학습 완료 후 체크포인트가 HF Hub에 자동 push
7. LeStudio Eval 탭에서 Hub 체크포인트 선택 → 평가

### 3.3 구현 범위

#### Backend (server.py, 제안/미구현)

| 엔드포인트 | 역할 |
|---|---|
| `POST /api/train/colab/config` | 학습 설정을 JSON으로 직렬화 → HF Hub에 push |
| `GET /api/train/colab/link` | Colab 노트북 URL 반환 |

#### Frontend (TrainTab.tsx, 제안/미구현)

- "Train on Colab" 버튼 (로컬 GPU 없거나 사용자 선택 시 표시)
- config push 진행률 표시
- Colab 링크 열기 (새 탭)

#### Colab 노트북 템플릿 (예정 경로: `notebooks/train.ipynb`)

현재 저장소에는 `notebooks/` 디렉토리와 템플릿 파일이 없다.

셀 구성:

```
셀 1: 환경 설정
  - pip install lerobot lestudio huggingface_hub
  - huggingface-cli login

셀 2: Config 다운로드
  - hf_hub_download(repo_id, "lestudio_train_config.json")
  - JSON 파싱 → 변수 설정

셀 3: 데이터셋 다운로드
  - LeRobotDataset(repo_id) 또는 huggingface_hub.snapshot_download

셀 4: 학습 실행
  - lerobot CLI 또는 Python API로 학습 시작
  - config에서 policy, steps, batch_size, lr 등 적용

셀 5: 체크포인트 업로드
  - 학습 완료 후 체크포인트를 HF Hub에 push
  - 사용자의 모델 repo에 저장
```

---

## 4. Config JSON 스키마 (초안)

```json
{
  "version": 1,
  "dataset_repo": "user/my-robot-dataset",
  "policy": "act",
  "steps": 50000,
  "batch_size": 8,
  "lr": 1e-5,
  "eval_freq": 5000,
  "save_freq": 10000,
  "output_repo": "user/my-robot-policy",
  "extra_overrides": []
}
```

---

## 구현 상태 메모 (2026-02-25)

- `POST /api/train/colab/config` 미구현
- `GET /api/train/colab/link` 미구현
- `notebooks/train.ipynb` 미존재

---

## 5. 향후 확장

| 단계 | 내용 |
|---|---|
| v1 (MVP) | HF Hub config push + 정적 Colab 템플릿 + 수동 Run All |
| v2 | 학습 상태 폴링 — Colab 노트북이 Hub에 status.json 주기적 push → LeStudio가 폴링 |
| v3 | 클라우드 GPU API 연동 (Modal/RunPod) — API 키 기반 완전 자동 원격 학습 |

---

## 6. 참고

- Colab 무료 런타임: T4 GPU, 최대 ~12시간, 유휴 90분 타임아웃
- Colab Pro: A100/V100, 24시간, 백그라운드 실행 가능
- phosphobot 클라우드 학습: Pro €35/월, 8 GPU 시간/월 제한
- LeStudio + Colab: **무료, 무제한** (Colab 자체 제한만 적용)
