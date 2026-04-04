# afd v2.0.0 토큰 절약 시각화 데모 — OBS 녹화 시나리오

## 목표
`afd_read`로 대형 파일(~31KB)을 읽을 때 대시보드에서 97% 압축이 실시간으로 반영되는 모습을 30초 클립으로 녹화한다.

---

## 1. 녹화 전 체크리스트

```
[ ] afd stop  →  afd start  (깨끗한 상태로 초기화)
[ ] 대시보드 토큰 카운터가 0 또는 낮은 값인지 확인
[ ] 터미널 폰트 크기 확대 (16-18pt 권장)
[ ] 불필요한 창(Slack, 브라우저 탭 등) 최소화
[ ] 다크 테마 적용 (터미널 + VS Code 모두)
[ ] 화면 분할 준비: 왼쪽 60% 터미널/Claude Code, 오른쪽 40% 대시보드
[ ] OBS Scene 준비 완료, 오디오 음소거 확인
[ ] 리허설 1회 (실제 녹화 전 전체 플로우 빠르게 연습)
```

---

## 2. 30초 타임라인 (초 단위)

### 0-5초 — 환경 시작

| 시각 | 행동 | 터미널 명령 |
|------|------|------------|
| 0s   | OBS 녹화 시작 버튼 클릭 | — |
| 1s   | 터미널 포커스, 커서 대기 1초 (자연스러운 시작감) | — |
| 2s   | `afd start` 입력 + Enter | `afd start` |
| 3s   | 데몬 기동 확인 메시지 대기 | — |
| 4s   | `afd web` 입력 + Enter | `afd web` |
| 5s   | 브라우저에서 대시보드(http://localhost:7700) 열림 확인 | — |

**포인트:** 대시보드 Overview 탭이 기본으로 열려 있는지 확인. 토큰 절약 위젯이 0 상태여야 한다.

---

### 5-15초 — afd_read로 대형 파일 읽기

| 시각 | 행동 | 상세 |
|------|------|------|
| 5s   | Claude Code 창 포커스 | — |
| 6s   | MCP 도구 호출 준비 | Claude Code에서 MCP 도구 입력창 열기 |
| 7s   | `afd_read` 호출 | path: `src/daemon/server.ts` |
| 8-12s | afd_read 처리 중 (약 4초) | 대시보드에서 처리 애니메이션 확인 |
| 12s  | 응답 도착: 홀로그램(스켈레톤) 반환 | 원본 ~31KB → 압축 ~900B |
| 13s  | 대시보드로 시선 이동 (마우스/카메라 팬) | — |
| 15s  | 대시보드 Overview 탭 확인 | — |

**afd_read 호출 파라미터 (사전 복사해두기):**
```json
{
  "path": "src/daemon/server.ts"
}
```

**예상 출력 미리보기:**
- 원본 크기: ~31,744 bytes (31KB)
- 압축 출력: ~950 bytes (타입 시그니처 + 인터페이스만)
- 압축률: **~97%**

---

### 15-25초 — 대시보드 실시간 반영 확인

| 시각 | 행동 | 상세 |
|------|------|------|
| 15s  | 대시보드 창 포커스 | Overview 탭 |
| 16s  | 토큰 절약 위젯 숫자 증가 확인 | "Token Savings" 카운터 |
| 17s  | 누적 절약 토큰 수치 클로즈업 | 예: "30,000+ tokens saved" |
| 19s  | "압축률" 또는 "Compression" 섹션으로 스크롤 | — |
| 21s  | 97% 수치 강조 (마우스 오버 또는 하이라이트) | — |
| 23s  | 파일별 히스토리 탭 클릭 (선택 사항) | `afd://history/src/daemon/server.ts` |
| 25s  | 다시 Overview 탭으로 돌아오기 | — |

---

### 25-30초 — 클라이맥스: 97% 수치 클로즈업

| 시각 | 행동 | 상세 |
|------|------|------|
| 25s  | "97%" 수치가 크게 보이도록 브라우저 줌 in | Ctrl+= 또는 브라우저 확대 |
| 26s  | 마우스 정지 — 화면에 수치만 남도록 | — |
| 27s  | 마우스 커서를 수치 위에 올려 툴팁 확인 (있을 경우) | — |
| 29s  | 줌 아웃하며 전체 대시보드 복귀 | — |
| 30s  | OBS 녹화 중지 | — |

---

## 3. OBS 설정 가이드

### 기본 설정
```
해상도:  1920 x 1080 (녹화 기준)
FPS:     30fps
출력:    MP4 (H.264) — 녹화 중에는 MKV → 완료 후 MP4로 리먹스
오디오:  음소거 (데스크탑 오디오 OFF)
```

### Scene 구성 (권장: Split Screen)
```
┌────────────────────────────────────────┐
│  Source 1 (60% 좌): Window Capture     │
│  → 대상: Windows Terminal (afd CLI)    │
│  → 또는 VS Code (Claude Code MCP 창)  │
├────────────────────────────────────────┤
│  Source 2 (40% 우): Window Capture     │
│  → 대상: Chrome/Edge (대시보드)        │
│  → http://localhost:7700               │
└────────────────────────────────────────┘
```

### 색상/테마
- 터미널: One Dark Pro 또는 Dracula (어두운 배경)
- 브라우저: 대시보드 다크 모드 활성화
- OBS Canvas 배경: #0a0a0a (순수 검정)

---

## 4. GIF 변환 (핵심 구간: 15-25초)

### Step 1: OBS 클립 트림
```bash
# FFmpeg으로 15-25초 구간 추출
ffmpeg -i recording.mp4 -ss 00:00:15 -t 10 -c copy clip_tokens.mp4
```

### Step 2: MP4 → GIF 변환 (850px, 10fps)
```bash
# 팔레트 생성 (고품질 GIF를 위해 필수)
ffmpeg -i clip_tokens.mp4 -vf "fps=10,scale=850:-1:flags=lanczos,palettegen" palette.png

# GIF 생성
ffmpeg -i clip_tokens.mp4 -i palette.png \
  -vf "fps=10,scale=850:-1:flags=lanczos,paletteuse" \
  output_raw.gif
```

### Step 3: gifsicle로 손실 압축 (목표: 5MB 이하)
```bash
# 설치 (없을 경우)
# Windows: winget install gifsicle
# macOS:   brew install gifsicle

gifsicle --lossy=80 --optimize=3 --colors=128 \
  output_raw.gif -o demo-token-savings.gif

# 파일 크기 확인
ls -lh demo-token-savings.gif
# 목표: < 5MB
```

### Step 4: 크기 초과 시 추가 압축
```bash
# lossy 값 높이기 (최대 200)
gifsicle --lossy=120 --optimize=3 --colors=64 \
  output_raw.gif -o demo-token-savings.gif

# 또는 구간을 15-22초(7초)로 단축
ffmpeg -i recording.mp4 -ss 00:00:15 -t 7 -c copy clip_shorter.mp4
```

---

## 5. MP4 최종 렌더링 (Reddit/YouTube 업로드용)

```bash
# 30초 전체, 1080p H.264, CRF 23 (고품질)
ffmpeg -i recording.mp4 \
  -vf "scale=1920:1080" \
  -c:v libx264 -crf 23 -preset slow \
  -c:a aac -b:a 128k \
  afd-v2-demo-full.mp4

# 파일 크기 확인 (Reddit 업로드 한도: 1GB)
ls -lh afd-v2-demo-full.mp4
```

---

## 6. 트러블슈팅

| 문제 | 해결 방법 |
|------|----------|
| `afd_read` 응답이 느림 | 첫 호출은 캐시 미스. 리허설에서 1회 호출 후 재시작하면 빠름 |
| 대시보드 수치가 갱신 안 됨 | `/mcp`로 MCP 재연결 후 재시도 |
| 97% 수치가 다른 값으로 나옴 | server.ts가 아닌 더 큰 파일 시도 (예: `src/daemon/manager.ts`) |
| GIF가 5MB 초과 | 구간을 7초로 단축 or lossy=150 으로 강화 |
| OBS 창 캡처 블랙 스크린 | "게임 캡처" 대신 "창 캡처" 사용, 또는 GPU 하드웨어 가속 비활성화 |

---

## 7. 완성 파일 체크리스트

```
[ ] afd-v2-demo-full.mp4     — 30초, 1080p (Reddit용)
[ ] demo-token-savings.gif   — 10초, 850px, < 5MB (GitHub README / X 포스팅용)
[ ] palette.png              — 임시 파일, 삭제 OK
```

---

*작성: 2026-04-04 | afd v2.0.0 데모 녹화 시나리오*
