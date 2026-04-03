# Session Context

> 마지막 업데이트: 2026-04-04 | 브랜치: main

## 현재 상태
- 버전: **v2.0.0-dev** (npm published: v1.9.1)
- 최신 커밋: `5c1d9b1` — feat(hologram): barrel file re-export tracking
- 전체 테스트: **195/195 통과** | 빌드: **0.58MB**
- Working tree: clean

## 이번 세션 작업 요약 (2026-04-03 ~ 04-04)

### 1. v1.9.1 안정화 & npm 배포
- `afd dashboard` TUI 구현 (한국어 locale, 3종 절약량 합산, SSE hybrid)
- ctx_savings 추적 정확도 수정 (wsmap/pinpoint 분모 정직화)
- npm publish `autonomous-flow-daemon@1.9.1` (bin/afd.js bun shebang)

### 2. v2.0 아키텍처 다이어트 (94% 빌드 감소)
- `semantic-diff.ts` 삭제 + `typescript@^6.0.2` dep 제거 (~30MB 절감)
- CLI 커맨드 20개 → 14개 통합 (restart/doctor/suggest/correlate 흡수)
- `tree-sitter-go/rust` → optionalDependencies 이동
- 빌드: 9.43MB → 0.58MB

### 3. N-Depth Reachability 엔진 구현 (v2.0 핵심)
- `import-resolver.ts` — regex 기반 TS/JS import 경로 해석
- `call-graph.ts` — Tree-sitter AST call_expression 추적 (L2/L3, 순환 보호)
- `hologram.ts` — `nDepth` 옵션 → `[🔗 N-Depth Dependencies]` 섹션 자동 첨부
- Barrel file re-export 추적 (`export { X } from`, `export * from`)
- 13개 TDD 테스트 (resolver 3 + call-graph 4 + integration 2 + barrel 4)

### 4. 버전 체계 정비
- package.json / git tag / roadmap 3곳 동기화
- v1.4.0 유령 태그 문서화, v1.6.1~3 → v1.7.0 병합
- v1.0~v1.9 전 항목 `[x]` 완료 (144개)

## 다음 세션 시작 시 확인 사항
1. N-Depth 실전 검증: React/Next.js 프로젝트에서 `afd_hologram --nDepth 2` 테스트
2. MCP `afd_hologram` / `afd_read` 에 `nDepth` 파라미터 노출 여부 결정
3. v2.0.0 로드맵 확정 (N-Depth + 디렉토리 구조 재편 + adapters 분리)
