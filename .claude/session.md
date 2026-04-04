# Session Context

> 마지막 업데이트: 2026-04-04 | 브랜치: main

## 현재 버전
- **package.json**: `2.0.0-dev.1`
- **npm**: `@dotoricode/afd@1.10.0` (최신 공개 버전)
- **테스트**: 217/217 (zero-defect)

## 오늘 완료한 작업

### npm 퍼블리시
- `autonomous-flow-daemon` → `@dotoricode/afd` 리네임
- `bin/afd.cjs` node shim, npm 11 검증 대응
- v1.10.0 퍼블리시 완료

### 문서 전면 업데이트
- README/CHANGELOG/CONTRIBUTING: 패키지명, 배지, v1.6~v2.0 릴리스 기록
- platform.ts: hook 폴백 `@dotoricode/afd`

### MCP Windows 수정
- `cmd /c npx` 래퍼 (Windows), `npx` (Unix)

### afd setup 대화형 명령
- Y/n 단계: 데몬→MCP→CLAUDE.md→fix
- CLAUDE.md에 afd_read/hologram 지시 자동 주입

### 반응형 TUI 대시보드
- Alt Screen, 2-pass 렌더링, Windows 폴링, 점진적 접기

### 다국어 N-Depth (Python/Go/Rust)
- grammar-resolver, import-resolver, call-graph 언어 디스패처
- 7개 polyglot 테스트

### 테스트 타임아웃 해결
- rule-suggestion: 디스크→메모리 DB (6.85s→245ms)

### Web Dashboard (Phase 1-3)
- `GET /dashboard` → 18.7KB single HTML
- Phase 1: 토큰 절약, 7일 히스토리, 면역, SSE 이벤트
- Phase 2: Hologram Explorer + N-Depth 트리
- Phase 3: i18n 서버 주입, 구문 강조, 글래스모피즘

## 미커밋 변경
- Web Dashboard (dashboard.html, http-routes.ts /dashboard+/files, setup.ts 린터 수정)
- docs/design/web-dashboard.md

## 다음 작업 후보
- `afd dashboard --web` CLI 플래그
- v2.0.0-dev.2 퍼블리시
- Python/Go/Rust N-Depth 실전 검증
