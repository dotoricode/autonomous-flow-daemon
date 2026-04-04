# Deep Interview Spec: v2.0.0 Launch Sprint

## Metadata
- Interview ID: di-next-step-001
- Rounds: 9
- Final Ambiguity Score: 18%
- Type: brownfield
- Generated: 2026-04-04
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.9 | 35% | 0.315 |
| Constraint Clarity | 0.8 | 25% | 0.200 |
| Success Criteria | 0.8 | 25% | 0.200 |
| Context Clarity | 0.7 | 15% | 0.105 |
| **Total Clarity** | | | **0.820** |
| **Ambiguity** | | | **18.0%** |

## Goal
afd v2.0.0 릴리즈 직후, 주말 2-3일 스프린트로 **토큰 절약 시각화 데모 영상**을 핵심 자산으로 제작하고, 이를 README에 삽입한 뒤 Reddit r/ClaudeAI + 한국 개발자 커뮤니티에 게시하여 초기 사용자를 확보한다.

## Constraints
- **시간:** 주말 2-3일 스프린트 (집중 투자)
- **도구:** OBS 화면 녹화 + 간단 편집 (프로급 영상 아님)
- **기술:** 기존 대시보드(`localhost:51831/dashboard`) + `afd_read` MCP 도구 활용
- **범위:** 데모 영상 1개가 핵심, README 업데이트와 커뮤니티 게시는 부수 작업
- **커뮤니티:** Reddit r/ClaudeAI (영어) + 한국 커뮤니티 (GeekNews, 디스코드 등)

## Non-Goals
- 프로급 나레이션/자막/음악 포함 영상 (시간 부족)
- 블로그 포스트 별도 작성
- awesome-claude-code PR (장기 과제로 이동)
- Hacker News Show HN (이번 스프린트 범위 밖)

## Acceptance Criteria
- [ ] 토큰 절약 시각화 데모 GIF 또는 영상 1개 완성 (30초~1분)
  - 시나리오: `afd_read`로 대형 파일 읽기 → 대시보드에서 97% 압축 실시간 확인
- [ ] README.md에 데모 GIF/영상 삽입 (기존 `demo.gif` 자리 교체)
- [ ] Reddit r/ClaudeAI에 소개 포스트 게시
- [ ] 한국 개발자 커뮤니티 1곳 이상에 소개 게시

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 3가지 산출물 모두 필요 | "딱 하나만 제대로 만든다면?" (Contrarian) | 데모 영상이 핵심, 나머지는 따라오는 부수 작업 |
| 복합 시나리오가 좋다 | "핵심 시나리오 하나만 고른다면?" (Simplifier) | 토큰 절약 시각화가 가장 임팩트 큰 단일 장면 |
| 커뮤니티 폭넓게 공략 | HN/awesome-list도 포함? | 이번은 r/ClaudeAI + 한국 커뮤니티에 집중, 나머지는 장기 |

## Technical Context
- `localhost:51831/dashboard` — 글래스모피즘 UI 웹 대시보드 (이미 구현)
- `afd_read` MCP 도구 — 10KB 초과 파일 자동 홀로그램 반환 (97% 압축)
- `afd web` — 브라우저 자동 오픈 CLI 명령어
- README.md 이미 v2.0.0 업데이트 완료, `demo.gif` 플레이스홀더 존재

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| afd | core domain | version, commands, MCP tools | provides → 토큰 절약, 자가 치유 |
| 타겟 개발자 | external | Claude Code 사용자, AI 에이전트 사용자 | uses → afd |
| 데모 영상 | deliverable | GIF/MP4, 30초~1분, OBS 녹화 | showcases → 토큰 절약 시각화 |
| README | deliverable | GitHub 첫인상, 데모 GIF 포함 | links → 데모 영상 |
| 대시보드 | supporting | 웹 UI, 실시간 메트릭, 글래스모피즘 | appears in → 데모 영상 |
| Reddit r/ClaudeAI | channel | 영어, Claude 사용자 집중 | receives → 소개 포스트 |
| 한국 커뮤니티 | channel | GeekNews, 디스코드, X | receives → 한국어 소개 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 2 | 2 | - | - | N/A |
| 3 | 5 | 3 | 0 | 2 | 40% |
| 5 | 6 | 1 | 0 | 5 | 83% |
| 7 | 6 | 0 | 0 | 6 | 100% |
| 9 | 7 | 1 | 0 | 6 | 86% |

<details>
<summary>Full Q&A (9 rounds)</summary>

### Round 1
**Q:** v2.0.0을 막 배포했는데, 지금 가장 하고 싶은 건 뭔가요?
**A:** 외부 노출/사용자 확보
**Ambiguity:** 81.5% (Goal: 0.3, Constraints: 0.1, Criteria: 0.1, Context: 0.2)

### Round 2
**Q:** 외부 노출을 위해 투자할 수 있는 시간과 자원이 어느 정도인가요?
**A:** 이번 주말 스프린트 (2-3일 집중)
**Ambiguity:** 71.5% (Goal: 0.3, Constraints: 0.5, Criteria: 0.1, Context: 0.2)

### Round 3
**Q:** 주말 스프린트의 최종 산출물로 가장 임팩트 있을 것 같은 건?
**A:** 데모 영상/GIF + README 리뉴얼 + 커뮤니티 등록
**Ambiguity:** 56.0% (Goal: 0.7, Constraints: 0.5, Criteria: 0.1, Context: 0.3)

### Round 4
**Q:** "성공했다"고 느낄 기준이 뭐예요?
**A:** 복합 (산출물 완성 + 최소한의 외부 반응)
**Ambiguity:** 48.5% (Goal: 0.7, Constraints: 0.5, Criteria: 0.4, Context: 0.3)

### Round 5 [Contrarian]
**Q:** 3개 중 딱 하나만 제대로 만들 수 있다면?
**A:** 데모 영상/GIF
**Ambiguity:** 42.5% (Goal: 0.8, Constraints: 0.5, Criteria: 0.5, Context: 0.3)

### Round 6
**Q:** 데모 영상을 어떻게 만들 생각이세요?
**A:** 화면 녹화 + 편집 (OBS)
**Ambiguity:** 37.5% (Goal: 0.8, Constraints: 0.7, Criteria: 0.5, Context: 0.5)

### Round 7 [Simplifier]
**Q:** 핵심 시나리오를 하나만 골라야 한다면?
**A:** 토큰 절약 시각화
**Ambiguity:** 31.0% (Goal: 0.9, Constraints: 0.7, Criteria: 0.5, Context: 0.5)

### Round 8
**Q:** 완료 조건 3가지면 충분한가요?
**A:** 충분하다 (데모 GIF + README 삽입 + 커뮤니티 1곳)
**Ambiguity:** 22.0% (Goal: 0.9, Constraints: 0.7, Criteria: 0.8, Context: 0.6)

### Round 9
**Q:** 커뮤니티 게시 대상은?
**A:** Reddit r/ClaudeAI + 한국 커뮤니티
**Ambiguity:** 18.0% (Goal: 0.9, Constraints: 0.8, Criteria: 0.8, Context: 0.7)

</details>
