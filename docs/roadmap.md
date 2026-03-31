# Roadmap

> afd 프로젝트의 버전별 계획과 미래 방향.

---

## Released

### v1.0.0 — The Immortal Flow
<!-- S.E.A.M engine, Magic 5 commands, suppression safety -->

### v1.1.0
<!-- Smart discovery, boastful doctor, auto-localization (ko/en), i18n -->

---

## In Progress

### v1.2.0 (Target)

#### Cross-Platform Hardening
- [x] Platform abstraction (`src/platform.ts`)
- [x] Cross-platform notifications (macOS/Linux/Windows)
- [x] CI matrix (ubuntu, macos, windows)
- [x] Hook command fallback (afd → bunx → npx)
- [x] Log rotation (5MB, 3 files)
- [x] LRU snapshot memory management (10MB cap)
- [ ] Windows real-device verification

#### MCP Integration (Phase 113)
- [ ] JSON-RPC dispatch for `tools/list` and `tools/call`
- [ ] `afd_diagnose` tool implementation
- [ ] `afd_score` tool implementation
- [ ] `afd_hologram` tool implementation
- [ ] MCP integration tests

---

## Planned

### v1.3.0 (Candidates)

#### Ecosystem Expansion
- [ ] Cursor adapter: `injectHooks` implementation
- [ ] Windsurf adapter
- [ ] Codex adapter

#### Advanced Diagnostics
- [ ] Tree-sitter AST-based semantic diff
- [ ] Custom diagnostic rule engine

#### Vaccine Network
- [ ] Remote antibody sharing (team sync)
- [ ] Vaccine registry / central server

#### Developer Experience
- [ ] `afd watch` — interactive TUI dashboard
- [ ] `afd doctor` — deep health analysis with recommendations
