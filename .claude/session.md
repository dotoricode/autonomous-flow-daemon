# Session Context

> 마지막 업데이트: 2026-04-04 | 브랜치: main

## 현재 상태
- 버전: **v2.0.0-dev** (npm published: v1.9.1)
- 최신 커밋: `b8a9fbf` — chore(session): sync session state for v2.0.0-dev
- 전체 테스트: **195/195 통과** | 빌드: **0.58MB**
- Working tree: clean

## 세션 커밋 이력 (11개)

| 커밋 | 내용 |
|---|---|
| `44fc2cd` | fix(ctx-savings): wsmap/pinpoint 정확한 추적 |
| `6428a2e` | feat(dashboard): `afd dashboard` TUI + 한국어 locale |
| `254b64c` | chore(session): 세션 동기화 |
| `49474b2` | release(v1.9.0): 버전 동기화 + 로드맵 정리 |
| `93669ab` | chore(release): v1.x 안정화 (README 경로, v1.4.0 문서화) |
| `fbadc58` | fix(bin): bun shebang 진입점 추가 |
| `c9f25b3` | release(v1.9.1): npm publish |
| `6be16f9` | refactor(v2-prep): 가지치기 (-975줄, -30MB dep, 빌드 94%↓) |
| `2b17659` | feat(hologram): N-Depth Reachability L2/L3 구현 |
| `5c1d9b1` | feat(hologram): barrel file re-export 추적 |
| `b8a9fbf` | chore(session): 세션 상태 동기화 |

## 핵심 변화 수치

| 지표 | Before | After |
|---|---|---|
| 빌드 크기 | 9.43MB | 0.58MB (-94%) |
| CLI 커맨드 | 20개 | 14개 (-30%) |
| dependencies | 6개 | 3개 (-50%) |
| 테스트 | 193개 | 195개 (+13 N-Depth, -11 semantic-diff) |
| npm | 미배포 | v1.9.1 published |

## 신규 파일

| 파일 | 역할 |
|---|---|
| `src/commands/dashboard.ts` | `afd dashboard` live TUI (한국어/영어) |
| `src/core/hologram/import-resolver.ts` | TS/JS import 경로 해석 + barrel 추적 |
| `src/core/hologram/call-graph.ts` | Tree-sitter call graph L2/L3 추적 |
| `bin/afd.js` | `#!/usr/bin/env bun` shebang 진입점 |
| `tests/unit/n-depth.test.ts` | N-Depth + barrel 13개 TDD 테스트 |

## 삭제된 파일

| 파일 | 이유 |
|---|---|
| `src/core/semantic-diff.ts` | 432줄 Dead Code + typescript 30MB dep의 유일 사용처 |
| `src/commands/stats.ts` | dashboard로 대체 |
| `src/commands/benchmark.ts` | 개발 전용 도구 |
| `src/commands/restart.ts` | start --restart로 흡수 |
| `tests/unit/semantic-diff.test.ts` | 소스 삭제에 따른 제거 |

## 다음 세션 시작 시 확인 사항
1. N-Depth 실전 검증: React/Next.js 프로젝트에서 `generateHologram(file, src, { nDepth: 2 })` 테스트
2. MCP `afd_hologram` / `afd_read`에 `nDepth` 파라미터 노출 구현
3. v2.0.0 로드맵 확정 (디렉토리 구조 재편, adapters 분리, Web Dashboard UI)
4. `afd start` 후 데몬 정상 기동 확인 (가지치기 후 첫 풀 사이클)
