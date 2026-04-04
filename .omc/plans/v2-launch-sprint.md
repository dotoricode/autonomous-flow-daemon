# v2.0.0 Launch Sprint Plan

> **Goal:** 토큰 절약 시각화 데모 제작 + README 삽입 + Reddit/한국 커뮤니티 게시
> **Timeline:** 주말 2-3일 스프린트
> **Date:** 2026-04-04

---

## RALPLAN-DR Summary

### Principles (5)

1. **Show, Don't Tell** — 숫자 테이블보다 실시간 시각 데모가 설득력이 100배 높다
2. **30-Second Hook** — 첫 30초 안에 "97% 토큰 절약"의 임팩트를 시각적으로 전달해야 한다
3. **Low-Effort High-Impact** — 주말 스프린트이므로, 이미 구현된 기능만 보여주고 새 코드 작성은 최소화한다
4. **Bilingual Reach** — 영문(Reddit r/ClaudeAI) + 한국어(커뮤니티) 동시 공략으로 양쪽 청중을 모두 커버한다
5. **Reproducible Demo** — 데모 시나리오는 누구나 `npx @dotoricode/afd start` 후 재현 가능해야 한다

### Decision Drivers (Top 3)

1. **데모 포맷 선택** — GIF vs MP4 vs YouTube: 로딩 속도, GitHub 호환성, 편집 용이성의 균형
2. **녹화 시나리오 설계** — 어떤 파일을 읽고, 무엇을 보여줄 것인가 (압축률이 극적인 대형 파일 선택)
3. **커뮤니티 포스트 전략** — Reddit/한국 커뮤니티 각각의 톤과 포맷에 맞는 콘텐츠 차별화

### Viable Options

#### Option A: Dual-Format (GIF + MP4) — Recommended

- **방식:** OBS로 30초 녹화 → GIF (README용, 15-20초 핵심 구간, lossy 압축) + MP4 (Reddit/커뮤니티용, 30초 전체)
- **Pros:** GitHub에서 GIF 인라인 재생 + Reddit에서 네이티브 비디오 업로드로 각 채널 최적화. 녹화는 1회, 내보내기만 분리.
- **Cons:** ffmpeg 명령어 2개 (GIF + MP4 트림). 추가 작업 ~10분.

#### Option B: YouTube + GIF 병행 (Rich)

- **방식:** OBS로 1-2분 풀 영상 -> YouTube 업로드 + 15초 하이라이트 GIF 별도 제작
- **Pros:** YouTube에서 풀 설명 가능, 검색 가능
- **Cons:** 편집 작업 추가, YouTube 채널 필요, 스프린트 시간 더 소요

**권장: Option A** — Architect 리뷰 반영. GIF는 README에, MP4는 Reddit에 최적. 녹화 1회로 두 포맷 커버.

---

## Implementation Plan

### Step 1: 데모 시나리오 스크립트 작성 (Claude 수행)

**작업 내용:**
- 데모용 녹화 스크립트(시나리오) 마크다운 문서 작성
- 시나리오 핵심 흐름:
  1. 터미널에서 `afd start` 실행 -> 데몬 기동 확인
  2. `afd web` 실행 -> 브라우저에서 대시보드 오픈
  3. Claude Code에서 `afd_read`로 대형 파일(예: `src/daemon/server.ts` 등 20KB+ 파일) 읽기
  4. 대시보드에서 실시간 토큰 절약률 변화 확인 (97% 압축)
  5. `/score` 또는 대시보드 Overview 탭에서 누적 절약량 확인
- 녹화 중 화면에 보여야 할 핵심 순간과 타이밍 가이드 포함
- OBS 설정 권장사항 (해상도, FPS, 크롭 영역)

**담당:** Claude (문서 작성)
**산출물:** `.omc/plans/demo-scenario.md`

**Acceptance Criteria:**
- [ ] 30-60초 분량의 타임라인이 초 단위로 기술되어 있음
- [ ] 각 단계에서 보여줄 화면 영역이 명시되어 있음
- [ ] OBS 녹화 설정 가이드 포함

---

### Step 2: OBS 녹화 실행 (사용자 수행)

**작업 내용:**
- Step 1의 시나리오 스크립트에 따라 OBS로 화면 녹화
- 녹화 전 준비:
  - `afd stop` -> `afd start`로 깨끗한 상태에서 시작
  - 대시보드 초기 상태 확인 (토큰 카운터 0 또는 낮은 수치)
  - 터미널 폰트 크기 확대 (가독성), 불필요한 창 정리
- 녹화 후 MP4 파일 확보

**담당:** 사용자 (OBS 직접 조작)
**산출물:** `demo-raw.mp4` (원본 녹화 파일)

**Acceptance Criteria:**
- [ ] 시나리오의 핵심 5단계가 모두 녹화됨
- [ ] 대시보드에서 토큰 절약률이 시각적으로 확인 가능
- [ ] 터미널 텍스트가 읽을 수 있는 해상도

---

### Step 3: GIF 변환 및 최적화 (Claude 가이드 + 사용자 실행)

**작업 내용:**
- Claude: ffmpeg 변환 명령어 2개 제공:
  - **GIF (README용):** 15-20초 핵심 구간, 850px 너비, 10fps, gifsicle --lossy=80 → 5MB 이하
  - **MP4 (Reddit용):** 30초 전체, 1080p, H.264 → Reddit 네이티브 비디오 업로드용
- 사용자: 명령어 실행하여 GIF + MP4 생성
- 기존 `demo.gif` 교체

**담당:** Claude (명령어 작성) + 사용자 (실행)
**산출물:** `demo.gif` (README용) + `demo.mp4` (커뮤니티용)

**Acceptance Criteria:**
- [ ] GIF: 15-20초 핵심 구간, 5MB 이하, GitHub에서 정상 렌더링
- [ ] MP4: 30초 전체, Reddit 네이티브 업로드 가능 크기
- [ ] 양쪽 모두 대시보드의 97% 절약률이 화면에 명확히 보임

---

### Step 4: README 업데이트 (Claude 수행)

**작업 내용:**
- `README.md`의 `<!-- TODO: Replace with actual screenshot -->` 코멘트 제거
- 데모 GIF 주변 캡션/설명 텍스트 업데이트 (필요시)
- `README-ko.md` 동일하게 업데이트
- demo.gif 참조 경로가 올바른지 확인

**담당:** Claude (코드/문서 수정)
**산출물:** 업데이트된 `README.md`, `README-ko.md`

**Acceptance Criteria:**
- [ ] TODO 코멘트가 제거됨
- [ ] 데모 GIF가 README에서 정상 표시됨 (로컬 + GitHub 미리보기)
- [ ] 한국어 README도 동기화됨

---

### Step 5: 커뮤니티 게시글 작성 (Claude 수행)

**작업 내용:**
- Reddit r/ClaudeAI용 영문 포스트 초안 작성
  - 톤: 기술적이되 접근 가능, "Show HN" 스타일
  - 구조: 문제 -> 해결책 -> 데모 GIF/링크 -> 설치 방법 1줄
  - 핵심 훅: "97% token savings" + "self-healing in 184ms"
- 한국 커뮤니티(디스코드/카페 등)용 한국어 포스트 초안 작성
  - 톤: 친근하고 실용적, 개발자 커뮤니티 맞춤
  - Claude Code 사용자 관점에서의 실질적 이점 강조

**담당:** Claude (초안 작성)
**산출물:** `.omc/drafts/reddit-post.md`, `.omc/drafts/korean-post.md`

**Acceptance Criteria:**
- [ ] Reddit 포스트가 r/ClaudeAI 규칙에 부합하는 형식
- [ ] 한국어 포스트가 자연스러운 한국어로 작성됨
- [ ] 양쪽 모두 데모 GIF/링크와 설치 명령어 포함

---

### Step 6: 게시 및 확인 (사용자 수행)

**작업 내용:**
- GitHub에 README 변경사항 push
- Reddit r/ClaudeAI에 포스트 게시
- 한국 커뮤니티 1곳 이상에 포스트 게시
- 각 게시물 URL 기록

**담당:** 사용자 (직접 게시)
**산출물:** 게시된 포스트 URL들

**Acceptance Criteria:**
- [ ] GitHub README에서 데모 GIF 정상 표시
- [ ] Reddit 포스트 게시 완료
- [ ] 한국 커뮤니티 포스트 게시 완료

---

## Success Criteria (from spec)

- [ ] 토큰 절약 시각화 데모 GIF/영상 1개 완성 (30초~1분)
- [ ] README.md에 데모 GIF/영상 삽입
- [ ] Reddit r/ClaudeAI에 소개 포스트 게시
- [ ] 한국 커뮤니티 1곳 이상에 소개 게시

---

## ADR: Demo Format Decision

| Field | Content |
|:------|:--------|
| **Decision** | Dual-Format 접근 (Option A: GIF + MP4) |
| **Drivers** | 주말 시간 제약, 채널별 최적 포맷 차별화 필요 (GitHub=GIF, Reddit=MP4) |
| **Alternatives** | YouTube + GIF 병행 (Option B) — 추가 편집/호스팅 부담으로 스프린트 범위 초과 |
| **Why Chosen** | 녹화 1회로 두 채널 최적화. GitHub은 GIF 인라인 렌더링, Reddit은 MP4 네이티브 비디오 업로드 |
| **Consequences** | ffmpeg + gifsicle 사전 설치 필요. GIF는 음성 불가, MP4는 Reddit 네이티브 플레이어 활용 |
| **Follow-ups** | 커뮤니티 반응이 좋으면 YouTube 풀 영상으로 확장 (v2.1 스프린트) |

---

## Role Distribution Summary

| Step | Claude | User |
|:-----|:-------|:-----|
| 1. 시나리오 스크립트 | 작성 | 리뷰 |
| 2. OBS 녹화 | - | 실행 |
| 3. GIF 변환 | 명령어 제공 | 실행 |
| 4. README 업데이트 | 수정 | 확인 |
| 5. 커뮤니티 포스트 | 초안 작성 | 리뷰/수정 |
| 6. 게시 | - | 직접 게시 |
