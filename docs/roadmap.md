# Roadmap

> afd 프로젝트의 버전별 계획과 미래 방향.

---

## Released

### v1.0.0 — The Immortal Flow
<!-- S.E.A.M engine, Magic 5 commands, suppression safety -->

### v1.1.0
<!-- Smart discovery, boastful doctor, auto-localization (ko/en), i18n -->

---

## Released

### v1.2.0

#### Cross-Platform Hardening
- [x] Platform abstraction (`src/platform.ts`)
- [x] Cross-platform notifications (macOS/Linux/Windows)
- [x] CI matrix (ubuntu, macos, windows)
- [x] Hook command fallback (afd → bunx → npx)
- [x] Log rotation (5MB, 3 files)
- [x] LRU snapshot memory management (10MB cap)
- [x] Windows real-device verification

#### MCP Integration (Phase 113)
- [x] JSON-RPC dispatch for `tools/list` and `tools/call`
- [x] `afd_diagnose` tool implementation
- [x] `afd_score` tool implementation
- [x] `afd_hologram` tool implementation
- [x] MCP integration tests

---

## In Progress

### v1.3.0

#### Ecosystem Expansion
- [x] Cursor adapter: `injectHooks` implementation
- [x] Windsurf adapter
- [x] Codex adapter

#### Advanced Diagnostics
- [x] AST-based semantic diff (TypeScript compiler API)
- [x] Custom diagnostic rule engine (`.afd/rules/*.yml`)

#### Vaccine Network
- [x] Remote antibody sharing (`afd sync --push/--pull`)
- [x] Vaccine registry (`afd vaccine list/search/install/publish`)

#### Developer Experience
- [x] `afd watch` — interactive TUI dashboard (SSE live stream)
- [x] `afd doctor` — deep health analysis with `--fix`
