# Session Context

> 마지막 업데이트: 2026-04-02 | 브랜치: main

## 이번 세션에서 완료된 작업

### 언어 지원 확장 (Hologram Extractor)
- **Go extractor** (`src/core/hologram/go-extractor.ts`) — tree-sitter-go@0.25.0
  - package/import/type(struct+interface+alias)/func/method(receiver) 추출
  - 9개 신규 테스트 (`test/hologram-go.test.ts`)
- **Rust extractor** (`src/core/hologram/rust-extractor.ts`) — tree-sitter-rust@0.24.0
  - use/mod/struct(fields)/enum(variants)/trait(signatures)/type alias/impl(method stubs)/fn 추출
  - impl Trait for Type, generic impl 헤더 정확 처리
  - 11개 신규 테스트 (`test/hologram-rust.test.ts`)
  - 기존 `.rs` L0 fallback 테스트 → `.xyz` 교정

### 아키텍처 결정 (Open Questions 5건 확정)
- **Q1** `mistake_type` → **English enum** in DB, Korean은 HUD 렌더 레이어에서만
- **Q2** defense count → **세션 in-memory** 리셋, 평생 통계는 `afd score`
- **Q3** retention → **90일** (`db.ts:97` 30d→90d 적용 완료)
- **Q4** barrel file L1 → **v2.0 defer**, 현재 L0 fallback 유지
- **Q5** `file_path` → **workspace-relative POSIX** (`src/core/db.ts` 형식)

### 문서 동기화
- `.omc/plans/afd-v1.5-trust-builder.md` — 23개 `[ ]` → `[x]` 전체 완료
- `.omc/plans/open-questions.md` — 5건 결정 이유·Rule 기록
- `docs/roadmap.md` — v1.6.2, v1.6.3 섹션 추가

## 커밋 이력 (이번 세션)
- `2ad92fc` chore: secure baseline for v1.7 and apply lean mode
- `61ab874` feat(hologram): add Go extractor with tree-sitter-go WASM
- `9c588a4` docs(arch): resolve 5 open architecture questions & apply Q3 retention fix
- `40e9b7e` docs(plan): sync v1.5 plan checkboxes with implementation status
- `1135c94` feat(hologram): add Rust extractor with tree-sitter-rust WASM

## 현재 상태
- 버전: **v1.6.3** (Rust Extractor)
- 홀로그램 지원 언어: TypeScript/JS (full) · Python (L0) · **Go (full)** · **Rust (full)**
- 모든 테스트: **165/165 통과**
- Working tree: **clean**
- 모든 v1.x 계획 문서: **완전 동기화**

## ⭐ 다음 최우선 과제 (P1): v1.7.0 Collective Intelligence 착수

첫 번째 항목: **Remote vaccine store** (`afd sync --remote <url>`)
- 참조: `docs/roadmap.md` v1.7.0 → Team Antibody Federation 섹션
- 설계: 로컬 antibody DB를 원격 URL로 push/pull하는 `sync` 커맨드 확장

## 기억할 사항
- web-tree-sitter named export: `import { Parser, Language } from "web-tree-sitter"`
- WASM 경로: `require.resolve("tree-sitter-{lang}/package.json")` → dirname → `tree-sitter-{lang}.wasm`
- bun install 필수: 클론/풀 후 반드시 실행 (WASM 패키지 미설치 시 start 실패)
- `mistake_type`은 English enum으로 저장, HUD 표시 시 한국어 변환
- `file_path`는 항상 workspace-relative POSIX (`src/core/db.ts` 형식)로 정규화
- tree-sitter-go AST: interface methods → `interface_type`의 직접 namedChildren (interface_body 래퍼 없음)
- tree-sitter-rust AST: impl body → `declaration_list`, function body → `block`
