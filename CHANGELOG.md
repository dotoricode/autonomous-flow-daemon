# Changelog

All notable changes to **afd** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-03-31 — "The Immortal Flow"

> [afd] 🛡️ AI agent deleted '.claudeignore' | 🩹 Self-healed in 184ms | Context preserved.

**Zero-config immunity for your AI development flow.**

### Phase 1–3: Core S.E.A.M Engine & Magic 5 Commands

- Introduced the **S.E.A.M Cycle** (Scan → Evaluate → Act → Monitor) as the central execution loop
- Implemented the **Magic 5 Commands**: `start`, `stop`, `score`, `fix`, `sync`
- Built `src/core/db.ts`: WAL-mode SQLite for sub-100ms file event persistence
- Built `src/core/hologram.ts`: AST-based skeleton extraction for token-efficient AI handoff
- Built `src/core/immune.ts`: Immune tolerance heuristics — suppression logic for noisy events
- Implemented `src/daemon/server.ts` and `src/daemon/client.ts`: Unix socket IPC for daemon ↔ CLI communication
- Chokidar-backed file watcher with 100ms debounce in `src/daemon/server.ts`

### Phase 4–5: Multilingual UI & Status Line Integration

- Added bilingual terminal UI (EN/KO) with chalk-based color output
- Integrated **Status Line** hook injection for Claude Code, Cursor, and Copilot adapters
- Added adapter layer (`src/adapters/`) for ecosystem-specific configuration
- Published `README.md` (English) and `README.ko.md` (Korean) with full documentation

### Phase 6a–6b: Suppression Safety — Double-Tap & Mass-Event Logic

- Added **Double-Tap suppression**: prevents re-triggering the same file within the cooldown window
- Added **Mass-Event suppression**: drops bulk filesystem events (threshold: ≥ 5 files / 500ms) to prevent runaway AI calls
- Added configurable `suppressionCooldownMs` and `massEventThreshold` / `massEventWindowMs`
- Full E2E safety suite: 9 tests across suppression scenarios — all green
- Published `docs/06-suppression-safety-audit.md` and `docs/05-release-audit.md`

---

## [0.1.0] - 2026-01-01 — Initial prototype

- Project scaffold with Bun runtime
- Basic CLI skeleton and daemon concept
