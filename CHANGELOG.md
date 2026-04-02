# Changelog

All notable changes to **afd** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.5.0] - 2026-04-02 — "Trust-Builder"

> The immune system now speaks. Three pillars that make afd's defenses visible, self-improving, and smarter.

### Added

- **Hologram L1 — Import-Based Semantic Compression**
  - New optional `contextFile` parameter on `afd_hologram` MCP tool and `/hologram` HTTP endpoint
  - `extractImportedSymbols()` function: regex fast-path parsing of named imports, default imports, and namespace imports from the context file
  - L1 filtering in `generateHologram()`: directly imported symbols receive full type signatures; non-imported exports are reduced to name-only stubs with guide text `// details omitted — read directly if needed`
  - Namespace imports (`import * as X`) trigger full L0 hologram (safe default, no false filtering)
  - Silent fallback to L0 when `contextFile` is missing, unreadable, or yields zero import results
  - Compression target: 85%+ with contextFile (vs ~80% L0 baseline)
  - L1 is MCP/HTTP path only — S.E.A.M hot path remains L0 to protect the 270ms budget

- **Antibody Passive Defense — Mistake History Injection**
  - New `mistake_history` SQLite table: `file_path`, `mistake_type`, `description` (max 200 chars), `antibody_id`, `timestamp`
  - Indexes on `file_path` and `timestamp` for sub-millisecond query performance
  - Write-through cache: `mistakeCache: Map<string, MistakeEntry[]>` loaded on daemon startup, updated on every insert
  - Per-file cap of 5 most recent entries enforced at write time
  - 30-day TTL purge on daemon startup (consistent with `telemetry` table pattern)
  - Direct DB insert on auto-heal events (not via HTTP POST): records `mistake_type` from `symptom.patternType` and `description` from `symptom.title`
  - New GET `/mistake-history?file=<path>` HTTP endpoint (returns max 5 entries, most recent first)
  - `pastMistakes` field injected into `afd diagnose --format a2a` output on both the healthy path (proactive warning) and the auto-heal path (reactive)
  - `pastMistakes` is omitted entirely when no history exists (zero token overhead)
  - Path normalization: `file_path` stored with forward slashes (cross-platform safe)

- **HUD Defense Counter + Reasons**
  - `/mini-status` endpoint enhanced with `total_defenses: number` and `defense_reasons: string[]` (in-memory only, no DB query — always under 200ms)
  - `defense_reasons` derived from in-memory `state.autoHealLog` (capped at 100 entries), returning up to 3 most recent unique `mistake_type` values
  - Status bar format: `[afd] {N}건 방어 ({reason1}, {reason2}, ...)` when defenses exist; `[afd] ON` when none
  - Existing `healed_count` and `last_healed` fields preserved for backward compatibility

### Fixed

- **Windows path normalization in `assertInsideWorkspace()`**: backslash (`\`) separators in Windows paths are now normalized to forward slashes before workspace boundary checks, fixing false-positive "outside workspace" errors on Windows

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
