# Deep Interview Spec: Dashboard Design Overhaul — Top 10 Trend Analysis & Implementation

## Metadata
- Rounds: 6
- Final Ambiguity Score: 18%
- Type: brownfield
- Generated: 2026-04-04
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 35% | 0.315 |
| Constraint Clarity | 0.80 | 25% | 0.200 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity | 0.70 | 15% | 0.105 |
| **Total Clarity** | | | **0.820** |
| **Ambiguity** | | | **18%** |

## Goal
2024~2025 최신 대시보드 디자인 트렌드 Top 10을 분석하고, 그 결과를 afd 웹 대시보드(`src/daemon/dashboard.html`)에 즉시 적용하여 "상용 서비스 수준"의 완성도로 전면 개편한다.

### 세부 목표
1. **트렌드 분석 보고서**: Product Hunt, Dribbble, Awwwards 기준 2024~2025 화제 대시보드 Top 10 선정 및 디자인 패턴 분석
2. **비주얼 개편**: 색상 팔레트, 타이포그래피, 아이콘 시스템 업그레이드
3. **레이아웃 재구성**: 카드 배치, 그리드 시스템, 정보 위계 최적화
4. **인터랙션 강화**: 호버/트랜지션/마이크로인터랙션/데이터 업데이트 애니메이션

## Constraints
- **단일 HTML 파일** 유지 (별도 빌드 파이프라인 없음)
- **CDN만 허용** (Tailwind CDN, Google Fonts CDN 등)
- **용량 제한 없음** (현재 32KB, 합리적 범위 내에서 증가 허용)
- **기존 기능 보존**: SSE 실시간 이벤트, i18n (ko/en), /score API 연동, 홀로그램 뷰어, 파일 트리, SVG 차트
- **기존 API 인터페이스 불변**: /score, /events, /files, /hologram 엔드포인트

## Non-Goals
- npm/빌드 파이프라인 도입
- 별도 CSS 파일 분리
- React/Vue 등 프레임워크 도입
- 서버 측 렌더링(SSR)
- 새로운 API 엔드포인트 추가

## Acceptance Criteria
- [ ] Top 10 대시보드 트렌드 분석 보고서 작성 완료
- [ ] 분석된 트렌드 중 afd에 적용 가능한 패턴 5개 이상 구현
- [ ] 브라우저에서 열었을 때 "상용 서비스 수준" 감성 달성 (Vercel/Linear/Toss 급)
- [ ] 기존 기능 전체 정상 동작 (SSE, i18n, 차트, 홀로그램, 파일 트리)
- [ ] 217/217 기존 테스트 전체 통과
- [ ] Overview 탭과 Explorer 탭 모두 시각적 일관성 유지

## Technical Context
### 현재 대시보드 구조
- **파일**: `src/daemon/dashboard.html` (32KB, 488줄)
- **스타일**: Tailwind CDN + `<style type="text/tailwindcss">` @apply 패턴
- **색상**: Toss blue (#3182F6) + slate 팔레트 다크 모드
- **컴포넌트**: stat cards (4), SVG bar chart, row-sep 테이블, event log, file tree, hologram viewer
- **i18n**: 서버에서 `/*{{I18N}}*/` placeholder에 `window.T` 주입
- **API**: `/score` (polling), `/events` (SSE + 15s heartbeat), `/files`, `/hologram`

### 서버 측 연관 파일
- `src/daemon/http-routes.ts`: i18n 키 정의 (ko/en), CSP 헤더, /dashboard 라우트

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Dashboard | core domain | html, style, layout, tabs | contains StatCard, Chart, EventLog |
| Design Trend | external reference | name, source, pattern, year | informs Dashboard |
| Benchmark | analysis artifact | rank, screenshot, analysis | produces Design Trend |
| Implementation | process | before, after, diff | transforms Dashboard |
| Interaction | UX component | type, trigger, animation | enhances Dashboard |

## Interview Transcript
<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** 벤치마크 범위는?
**A:** 최신 트렌드 올인 (2024~2025 Product Hunt/Dribbble/Awwwards)
**Ambiguity:** 68%

### Round 2
**Q:** 최종 결과물 범위는?
**A:** 보고서 + 즉시 구현 (dashboard.html에 바로 적용)
**Ambiguity:** 52%

### Round 3
**Q:** 기술적 제약 조건?
**A:** 단일 HTML + CDN만, 용량 제한 없음
**Ambiguity:** 38%

### Round 4
**Q:** 개선 영역?
**A:** 전부 다 (비주얼 + 레이아웃 + 인터랙션)
**Ambiguity:** 30%

### Round 5
**Q:** 성공 기준?
**A:** "상용 서비스 수준" — Vercel/Linear/Toss급 완성도
**Ambiguity:** 22%

### Round 6
**Q:** 디자인 레퍼런스 선정 방법?
**A:** AI에게 선정 맡김
**Ambiguity:** 18%
</details>
