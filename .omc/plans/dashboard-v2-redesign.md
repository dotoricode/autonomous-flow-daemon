# Dashboard v2 Redesign — Final Consensus Plan

**Date:** 2026-04-04
**Status:** CONSENSUS APPROVED (R2)
**Target File:** `src/daemon/dashboard.html` (primary), `src/daemon/http-routes.ts` (i18n sync)
**Approach:** Tailwind CDN 유지 + CSS 변수 테마 레이어 추가 (Tailwind for layout, CSS vars for theming)

---

## RALPLAN-DR Summary

### Principles (5)
1. **Single-File Constraint** — 모든 변경은 dashboard.html 내 인라인 CSS/JS. CDN만 허용.
2. **API Contract Preservation** — /score, /events, /files, /hologram 호출 구조 불변.
3. **Progressive Enhancement** — 기존 기능(폴링, countUp, 차트, i18n, SSE) 100% 보존.
4. **Performance First** — CSS animation은 transform/opacity만 사용. 60fps 유지.
5. **Blue Accent + Semantic Exceptions** — Toss blue(#3182F6)가 주 accent. 상태 표시(LIVE=green, error=red)는 의미론적 예외로 허용하되 최소한으로 사용.

### Decision Drivers (Top 3)
1. **시각적 임팩트** — "상용 서비스 수준" 달성이 최우선
2. **구현 안전성** — JS render 함수 + DOM selector 커플링 보호
3. **일관성** — 정적 HTML과 동적 JS innerHTML이 동일한 디자인 시스템 사용

### Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tailwind CDN | **유지** | JS render 함수들이 Tailwind 클래스를 직접 emit — 제거하면 전체 JS 재작성 필요. 비용 대비 효과 부족. |
| Font | **시스템 폰트 스택** | CSP 변경 불필요, 로컬 도구에 외부 의존 부적합. 현재 스택(-apple-system, BlinkMacSystemFont, 'Segoe UI') 유지. |
| CSS Variables | **테마 레이어로 추가** | :root에 색상 변수 정의, 새로운 정적 HTML에서 사용. JS innerHTML은 기존 Tailwind 유틸리티 유지. 점진적 마이그레이션. |
| SVG Animation | **JS-driven attribute** | CSS transform-origin이 SVG rect에서 불안정. JS로 직접 height/y 속성 조작이 가장 안정적. |
| Color Principle | **Blue accent + 의미론적 예외** | LIVE=green, phase 태그는 기능적 색상이므로 모노크롬 원칙의 예외. accent는 #3182F6 단일. |

### ADR
- **Decision:** Tailwind CDN 유지 + CSS 변수 테마 레이어 병행
- **Drivers:** JS render 함수 커플링 비용, 작업 범위 관리
- **Alternatives:** (A) Tailwind 완전 제거 — JS innerHTML 전면 재작성 필요, 리스크 과다 (B) Tailwind만 사용 — 커스텀 테마 변수 표현 한계
- **Why Chosen:** 정적 HTML에는 새 CSS 변수로 일관된 테마, JS innerHTML은 기존 Tailwind 유지. 경계가 명확하고 기존 코드 파괴 최소화.
- **Consequences:** 이중 시스템이지만 경계가 명확(정적=CSS vars, 동적=Tailwind). 향후 JS render 함수를 점진적으로 CSS 변수로 마이그레이션 가능.

---

## JS Render Function Audit

| Function | Emits HTML | Tailwind Classes Used | Impact |
|----------|-----------|----------------------|--------|
| renderHeader() | status-badge className | bg-emerald-950/40, text-emerald-400, etc. | 정적 badge → HTML에서 기본 스타일, JS에서 상태만 toggle |
| renderStatCards() | sc-* textContent only | 없음 (textContent만 조작) | Safe — HTML 구조만 변경하면 됨 |
| renderToday() | today-content innerHTML | text-xs, text-slate-* | svgBar() 함수 내 Tailwind 유지 |
| renderLifetime() | lifetime-content innerHTML | row-sep, text-slate-*, font-medium | row-sep 클래스 유지 |
| renderHistory() | SVG markup string | 없음 (인라인 SVG 속성) | Safe — SVG는 Tailwind 무관 |
| renderImmune() | immune-content innerHTML | row-sep, text-slate-*, font-mono | row-sep 클래스 유지 |
| appendEvent() | event div innerHTML | bg-blue-950/40, text-blue-400, etc. | 기존 Tailwind 유지 |
| highlight() | code innerHTML | sk-kw, sk-fn, sk-str, sk-type, sk-cmt | 커스텀 CSS — 영향 없음 |

**결론:** JS render 함수는 대부분 textContent 조작이거나 Tailwind 유틸리티를 직접 사용. 기존 Tailwind 유지가 안전한 선택.

---

## Implementation Steps (4 Steps + Checkpoint)

### Step 0: Git Checkpoint
```bash
git add -A && git commit -m "chore: pre-dashboard-v2 checkpoint"
```
각 Step 완료 후 별도 커밋으로 롤백 포인트 확보.

### Step 1: CSS Theme Layer + Background (Pattern 3, 7)
**파일:** `src/daemon/dashboard.html` (인라인 `<style>`)

**변경:**
1. `<style>` 블록에 `:root` CSS 변수 추가:
   ```css
   :root {
     --bg: #050510;
     --bg-card: #0c0c1a;
     --bg-card-hover: #12122a;
     --border: #1a1a2e;
     --border-hover: #252540;
     --accent: #3182f6;
     --accent-glow: rgba(49,130,246,0.12);
     --text-1: #e4e4e7;
     --text-2: #71717a;
     --text-3: #3f3f46;
   }
   ```
2. `body` 스타일에 dot pattern 배경 추가:
   ```css
   body { background: var(--bg); background-image: radial-gradient(#ffffff05 1px, transparent 1px); background-size: 24px 24px; }
   ```
3. `.card` @apply를 CSS 변수 기반으로 교체:
   ```css
   .card { background: var(--bg-card); border: 1px solid var(--border); ... }
   .card:hover { border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.25); }
   ```

**Acceptance Criteria:**
- [ ] body 배경에 미세한 도트 패턴이 보인다
- [ ] 카드 hover 시 2px 위로 이동 + 그림자 깊어짐
- [ ] Tailwind CDN 정상 로드
- [ ] 기존 모든 JS 기능 정상 동작

### Step 2: Bento Grid + Stat Card Glow (Pattern 1, 2, 6)
**파일:** `src/daemon/dashboard.html` (HTML 구조 + CSS)

**변경:**
1. Overview 탭의 stat 카드 그리드를 Bento 스타일로:
   - 기존 `grid-cols-2 sm:grid-cols-4` → 유지하되 gap을 `gap-4`로 넓힘
   - Savings Breakdown + Lifetime Breakdown 카드를 `lg:col-span-1`로 유지
   - 7-Day History를 `col-span-full`로 full width
2. 핵심 숫자(sc-uptime, sc-healed, sc-compress, sc-antibodies)에 glow 효과:
   ```css
   .stat-glow { position: relative; }
   .stat-glow::after {
     content: ''; position: absolute; inset: -16px;
     background: radial-gradient(ellipse, var(--accent-glow), transparent 70%);
     z-index: -1; pointer-events: none; border-radius: 50%;
   }
   ```
3. 기존 id 속성 전부 보존 — DOM selector 커플링 유지

**Acceptance Criteria:**
- [ ] stat 카드가 4열(데스크톱) / 2열(모바일)로 배치
- [ ] 핵심 숫자 뒤에 은은한 blue glow 배경 visible
- [ ] getElementById('sc-uptime') 등 기존 바인딩 정상 동작

### Step 3: Pills + Chart Animation (Pattern 4, 5, 8)
**파일:** `src/daemon/dashboard.html` (CSS + JS)

**변경:**
1. LIVE/OFFLINE 배지를 pill 스타일로 개선 (현재 이미 rounded-full — 미세 조정)
2. SVG 차트 애니메이션: `renderHistory()`에서 JS-driven 방식으로 구현
   ```javascript
   // 각 rect를 height=0으로 생성 후 requestAnimationFrame으로 성장
   function animateBar(rect, targetH, targetY, delay) {
     rect.setAttribute('height', '0');
     rect.setAttribute('y', H);
     setTimeout(() => {
       const start = performance.now();
       (function step(ts) {
         const p = Math.min((ts - start) / 500, 1);
         const ease = 1 - Math.pow(1 - p, 3);
         rect.setAttribute('height', String(targetH * ease));
         rect.setAttribute('y', String(H - targetH * ease));
         if (p < 1) requestAnimationFrame(step);
       })(performance.now());
     }, delay);
   }
   ```
3. 숫자 갱신 시 미세 transition: countUp() 호출 전 opacity 0.7 → 갱신 후 1.0
4. 이벤트 phase 태그 스타일 유지 (Tailwind 클래스 — JS innerHTML에서 emit)

**Acceptance Criteria:**
- [ ] 7-Day History 바가 아래에서 위로 순차적으로 성장
- [ ] 숫자 갱신 시 미세한 fade 전환 visible
- [ ] LIVE 배지 + phase 태그 정상 표시
- [ ] appendEvent() 동적 생성 요소 스타일 정상

### Step 4: Polish + Responsive + Verification
**파일:** `src/daemon/dashboard.html`, `src/daemon/http-routes.ts` (i18n 동기화)

**변경:**
1. 스크롤바 커스텀 스타일:
   ```css
   ::-webkit-scrollbar { width: 4px; }
   ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
   ```
2. 반응형 breakpoints 확인/조정:
   - 768px 이하: 1열 레이아웃
   - 1024px 이하: 2열 레이아웃
3. http-routes.ts i18n 키 동기화 (새 키가 추가된 경우)
4. 전체 기능 검증:
   - `curl http://localhost:PORT/dashboard` → HTML 정상 반환
   - `curl http://localhost:PORT/score` → JSON 정상 반환
   - `npx bun test` → 217/217 통과

**Acceptance Criteria:**
- [ ] 모바일(768px 이하)에서 1열 레이아웃
- [ ] 기존 테스트 217/217 통과
- [ ] i18n ko/en 모두 정상
- [ ] SSE 이벤트 실시간 수신 정상
- [ ] 홀로그램 파일 선택 → 코드 뷰어 정상 표시

---

## Guardrails

### Must Have
- 기존 API 엔드포인트 호출 구조 보존
- 기존 DOM id 속성 전부 보존
- Tailwind CDN 유지 (JS render 함수 호환성)
- CSS 변수 기반 테마 레이어 추가
- 각 Step 완료 후 git commit (롤백 포인트)

### Must NOT Have
- Google Fonts CDN (CSP 충돌)
- 외부 CSS/JS 파일 생성
- CSS transform-origin on SVG (대신 JS-driven animation)
- Layout-triggering CSS animation (width, height, top, left)
- Tailwind 클래스 제거 (JS innerHTML 호환성 파괴)

---

## Verification Checklist
- [ ] dot pattern 배경 visible
- [ ] 카드 hover elevation 동작
- [ ] 핵심 숫자 glow 효과 visible
- [ ] 7-Day History 차트 바 성장 애니메이션 동작
- [ ] LIVE/OFFLINE pill 배지 정상
- [ ] 모바일 반응형 레이아웃 정상
- [ ] SSE 이벤트 스트림 정상
- [ ] i18n 전환 정상
- [ ] countUp 애니메이션 정상
- [ ] 홀로그램 뷰어 파일 선택 → 코드 표시 정상
- [ ] 217/217 테스트 통과
