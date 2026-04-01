# afd v1.5 "Trust-Builder" MVP — Implementation Plan

**Date:** 2026-04-02
**Status:** APPROVED — Consensus reached (Planner/Architect/Critic)
**Complexity:** MEDIUM (brownfield, 3 pillars across ~10 files)

---

## RALPLAN-DR Summary

### Principles (5)
1. **Additive-only changes** — Extend existing APIs with optional parameters; never break current callers.
2. **Performance budget sacred** — S.E.A.M < 270ms, single file < 100ms. All new DB queries must be indexed and benchmarked.
3. **Bun-native only** — No Node.js APIs outside what Bun already polyfills. Use `bun:sqlite` for all persistence.
4. **Crash-only resilience** — New features degrade gracefully. If mistake_history query fails, hook still runs without injection. If L1 import parsing fails, fall back to L0 hologram.
5. **Token conservation first** — Every new output path (hologram, HUD, hook injection) must reduce or hold constant the token budget, never increase it unexpectedly.

### Decision Drivers (Top 3)
1. **Trust signal visibility** — Users must *see* afd working (HUD counter + reasons) to build trust incrementally.
2. **Mistake recurrence prevention** — Antibody passive defense must prevent repeated mistakes without risky auto-generation of validators.
3. **Hologram efficiency** — L1 filtering should meaningfully improve compression (85%+) for the most common use case (MCP `afd_read` and `afd_hologram`).

### Viable Options

#### Option A: Integrated SQLite Approach (RECOMMENDED)
- Store mistake history in a new `mistake_history` SQLite table alongside existing `antibodies`/`telemetry` tables.
- HUD reads defense events from the same DB via `/mini-status` endpoint enhancement.
- Hologram L1 uses TS Compiler API's existing AST to parse imports from `contextFile`.

**Pros:** Single data source (SQLite), consistent with existing architecture, no new dependencies, all queries benefit from WAL mode.
**Cons:** DB schema migration needed, slightly more complex `/mini-status` query.

#### Option B: File-based Mistake Log + Separate Cache
- Write mistake history to `.afd/mistake-log.jsonl` (append-only).
- HUD reads from a separate `.afd/hud-cache.json` updated by daemon.
- Hologram L1 parses imports via regex instead of AST.

**Pros:** No schema migration, simpler to debug (human-readable files).
**Cons:** Two data sources to maintain, file I/O race conditions on Windows, regex import parsing is fragile for TS edge cases (re-exports, dynamic imports, type imports), violates existing SQLite-centric architecture pattern.
**Invalidation:** Contradicts the project's established SQLite-as-single-source pattern and introduces reliability risks on Windows file locking. Regex-based import parsing would be a regression from the existing TS Compiler API quality bar.

### ADR

- **Decision:** Option A — Integrated SQLite approach with new `mistake_history` table.
- **Drivers:** Architectural consistency, WAL concurrency safety, single query path for both hook injection and HUD.
- **Alternatives considered:** File-based log (Option B) — rejected due to Windows file locking risks and deviation from established patterns.
- **Why chosen:** Leverages existing `bun:sqlite` infrastructure, zero new dependencies, all new data accessible via existing prepared statement patterns in `DaemonContext`.
- **Consequences:** Requires DB migration in `initDb()`. HUD statusline script gains a dependency on HTTP endpoint (already established pattern via `/mini-status`).
- **Follow-ups:** Add `PRAGMA optimize` on daemon shutdown. 30-day retention purge for `mistake_history` (consistent with telemetry pattern).

### Consensus Improvements (Architect + Critic)

The following improvements were incorporated from the Architect and Critic review rounds:

1. **L1 import parsing: Regex fast-path** — Use regex (`/import\s+\{([^}]+)\}\s+from/g` + `/import\s+(\w+)\s+from/g`) instead of `ts.createSourceFile()` for contextFile parsing. Fallback to full TS parse only if regex yields zero results. Namespace imports (`import * as X`) → return full hologram (no filtering). S.E.A.M hot path stays L0 only; L1 is MCP/HTTP only.
2. **Mistake recording: Direct DB insert** — Insert `mistake_history` rows directly at `server.ts:313` (after `autoHealCount++`) and `server.ts:459` (after corruption restore), NOT via HTTP POST. `/mistake-history` is GET-only.
3. **Write-through cache** — Load `mistake_history` into `Map<string, MistakeEntry[]>` on daemon startup. Write to both DB and cache on recording. Read from cache in hook output (sub-microsecond). `DaemonState` gets new `mistakeCache` field.
4. **200-char description limit at write time** — Truncate `description` to 200 chars in the INSERT prepared statement (application-level, not CHECK constraint).
5. **Per-file cap (5) + 30-day TTL** — After each insert, delete oldest beyond 5 per file. Startup purge: `DELETE FROM mistake_history WHERE timestamp < ?` (30 days).
6. **HUD defense_reasons from in-memory state** — Read from `state.autoHealLog` (capped at 100 entries), NOT from DB query. Keeps `/mini-status` under 200ms timeout.
7. **pastMistakes in both a2a paths** — Inject into healthy path (`diagnose.ts:61`) AND auto-heal path (`diagnose.ts:142-143`). Healthy path is MORE important (proactive warning).
8. **Path normalization** — Normalize `file_path` with forward slashes before insert/query (existing pattern at `server.ts:441`).

---

## Context

afd v1.4 has a working immune system (diagnose + auto-heal), hologram extraction, and a basic HUD. v1.5 adds three "trust-building" features that make the daemon's work more visible and its defenses smarter, without architectural rewrites.

### Key Existing Files (Touch Points)
| File | Current Role | v1.5 Changes |
|------|-------------|-------------|
| `src/core/hologram.ts` | TS AST hologram extraction | Add L1 import-filtered mode |
| `src/core/db.ts` | SQLite schema + `initDb()` | Add `mistake_history` table |
| `src/core/immune.ts` | Diagnosis orchestrator | No changes (stable) |
| `src/daemon/types.ts` | `DaemonContext` + `DaemonState` | Add mistake history prepared statements |
| `src/daemon/server.ts` | S.E.A.M engine + daemon bootstrap | Wire new prepared statements into context |
| `src/daemon/mcp-handler.ts` | MCP tools (afd_hologram, afd_read) | Pass `contextFile` to hologram L1 |
| `src/daemon/http-routes.ts` | HTTP IPC endpoints | Enhance `/mini-status`, add `/mistake-history` |
| `src/commands/diagnose.ts` | CLI `afd diagnose --auto-heal` | Inject mistake history into hook output |
| `.claude/statusline-command.js` | HUD statusline | Show defense count + reasons |
| `.claude/hooks.json` | PreToolUse hooks | No changes needed (existing `afd-auto-heal` hook suffices) |

---

## Guardrails

### Must Have
- All existing tests pass without modification
- `generateHologram(filePath, source)` (no `contextFile`) returns identical output to v1.4
- `/mini-status` response remains backward-compatible (new fields are additive)
- Hook output format remains valid JSON parseable by Claude Code

### Must NOT Have
- Auto-generation of validator scripts (hallucination risk per spec)
- Breaking changes to MCP tool schemas (existing `afd_hologram`, `afd_read` must work as before)
- New npm/Node.js dependencies
- Any synchronous DB calls in the S.E.A.M hot path that could breach 270ms budget

---

## Task Flow (5 Phases)

### Phase 1: Database Schema — `mistake_history` Table
**Files:** `src/core/db.ts`, `src/daemon/types.ts`, `src/daemon/server.ts`

**1.1** Add `mistake_history` table to `initDb()` in `src/core/db.ts`:
```sql
CREATE TABLE IF NOT EXISTS mistake_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,       -- forward-slash normalized
  mistake_type TEXT NOT NULL,    -- e.g. "file-empty", "file-invalid-json", "corruption"
  description TEXT NOT NULL,     -- max 200 chars, truncated at write time
  antibody_id TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_mistake_history_path ON mistake_history(file_path);
CREATE INDEX IF NOT EXISTS idx_mistake_history_ts ON mistake_history(timestamp);
```
Add startup purge (same pattern as `telemetry` at `db.ts:82`):
```sql
DELETE FROM mistake_history WHERE timestamp < unixepoch() * 1000 - 30 * 86400000;
```

**1.2** Add prepared statements to `DaemonContext` in `src/daemon/types.ts`:
- `insertMistakeHistory: { run: (...args: unknown[]) => void }`
- `queryMistakesByFile: { all: (...args: unknown[]) => { file_path: string; mistake_type: string; description: string; timestamp: number }[] }`
- `queryRecentDefenses: { all: (...args: unknown[]) => { mistake_type: string; description: string; timestamp: number }[] }`

**1.3** Wire prepared statements in `src/daemon/server.ts` main() context construction:
- `insertMistakeHistory` — `INSERT INTO mistake_history (file_path, mistake_type, description, antibody_id, timestamp) VALUES (?, ?, ?, ?, ?)`
- `queryMistakesByFile` — `SELECT file_path, mistake_type, description, timestamp FROM mistake_history WHERE file_path = ? ORDER BY timestamp DESC LIMIT 5`
- `queryRecentDefenses` — `SELECT mistake_type, description, timestamp FROM mistake_history ORDER BY timestamp DESC LIMIT 10`

**1.4** Record mistake history via direct DB insert (NOT HTTP POST):
- At `server.ts:313` (after `state.autoHealCount++`): insert with `mistake_type` from `symptom.patternType` and `description` from `symptom.title`
- At `server.ts:459` (after corruption restore): insert with `mistake_type: "corruption"` and description from detection reason
- Normalize `file_path` with forward slashes before insert (pattern: `path.replace(/\\/g, "/")`)
- Truncate `description` to 200 chars: `description.slice(0, 200)`
- After each insert, enforce per-file cap: `DELETE FROM mistake_history WHERE file_path = ? AND id NOT IN (SELECT id FROM mistake_history WHERE file_path = ? ORDER BY timestamp DESC LIMIT 5)`

**1.5** Add write-through cache to `DaemonState` in `src/daemon/types.ts`:
- New field: `mistakeCache: Map<string, { mistake_type: string; description: string; timestamp: number }[]>`
- On daemon startup in `server.ts`: load all rows from `mistake_history` into cache
- On each insert: update both DB and cache
- On read (diagnose hook): read from cache (sub-microsecond)

**Acceptance Criteria:**
- [ ] `initDb()` creates `mistake_history` table with indexes on fresh DB
- [ ] Existing DBs gain the table on next daemon start (migration-safe)
- [ ] Auto-heal events are recorded in `mistake_history` with file_path, type, and description
- [ ] `queryMistakesByFile` returns at most 5 recent entries for a given file path

---

### Phase 2: Hologram L1 — Import-Based Filtering
**Files:** `src/core/hologram.ts`, `src/daemon/mcp-handler.ts`, `src/daemon/http-routes.ts`

**2.1** Add L1 import filtering logic to `src/core/hologram.ts`:

**Import extraction (regex fast-path, NOT ts.createSourceFile):**
```typescript
function extractImportedSymbols(contextSource: string, targetPath: string): Set<string> | "all" {
  const symbols = new Set<string>();
  // Named imports: import { A, B } from "./target"
  const namedRe = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  // Default import: import X from "./target"
  const defaultRe = /import\s+(\w+)\s+from\s+["']([^"']+)["']/g;
  // Namespace import: import * as X from "./target"  → return full hologram
  const nsRe = /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']/g;
  
  // Check namespace imports first — if found, return "all" (no filtering)
  for (const m of contextSource.matchAll(nsRe)) {
    if (m[1].includes(targetPath)) return "all";
  }
  // Extract named imports
  for (const m of contextSource.matchAll(namedRe)) {
    if (m[2].includes(targetPath)) {
      m[1].split(",").forEach(s => symbols.add(s.trim().split(/\s+as\s+/)[0].trim()));
    }
  }
  // Extract default imports
  for (const m of contextSource.matchAll(defaultRe)) {
    if (m[2].includes(targetPath)) symbols.add("default");
  }
  return symbols;
}
```

**Filtering logic in existing `extractNode()` pipeline:**
- Directly imported symbols: full signature (same as L0)
- Not-imported exported symbols: name-only stub: `export function unusedHelper(…): …; // details omitted — read directly if needed`
- Non-exported symbols: omit entirely (same as L0)
- If `contextFile` cannot be read, parsed, or regex yields zero results: fall back to L0 silently

**IMPORTANT:** L1 is for MCP/HTTP paths ONLY. S.E.A.M hot path (`safeHologram` at `server.ts:183`) stays L0 to protect 270ms budget.

**2.2** Extend `generateHologram()` signature to accept optional `contextFile`:
```typescript
export function generateHologram(
  filePath: string,
  source: string,
  options?: { contextFile?: string }
): HologramResult
```
- When `options?.contextFile` is provided, delegate to L1 logic
- When absent, existing L0 behavior is unchanged (zero regression risk)

**2.3** Update MCP tool `afd_hologram` in `src/daemon/mcp-handler.ts`:
- Add optional `contextFile` parameter to input schema
- Pass through to `generateHologram(file, source, { contextFile })`

**2.4** Update HTTP `/hologram` route in `src/daemon/http-routes.ts`:
- Accept optional `?contextFile=` query parameter
- Pass through to `generateHologram()`

**Acceptance Criteria:**
- [ ] `generateHologram("target.ts", source)` without contextFile returns identical output to v1.4
- [ ] `generateHologram("target.ts", source, { contextFile: "consumer.ts" })` only includes full signatures for symbols imported by consumer.ts
- [ ] Non-imported exports show name-only stubs with guide text
- [ ] Compression ratio >= 85% on typical files with contextFile (vs ~80% without)
- [ ] Invalid/missing contextFile gracefully falls back to L0

---

### Phase 3: Antibody Passive Defense — Mistake History Injection
**Files:** `src/commands/diagnose.ts`, `src/daemon/http-routes.ts`

**3.1** Add `/mistake-history` GET endpoint to `src/daemon/http-routes.ts`:
- Query param: `?file=<path>` (required)
- Returns: `{ mistakes: [{ mistake_type, description, timestamp }] }` (max 5, most recent first)
- Returns empty array if no history exists

**3.2** Enhance `diagnoseCommand()` in `src/commands/diagnose.ts` for hook injection:

**Two injection points (BOTH required):**
- **Healthy path** (`diagnose.ts:61`, `console.log(JSON.stringify({status:"healthy",...}))`) — MORE important (proactive warning when system is healthy but file has history)
- **Auto-heal path** (`diagnose.ts:142-143`, healed/no-action output) — post-heal warning

**Implementation:**
- Query daemon via `GET /mistake-history?file=<path>` (HTTP, since diagnose.ts runs as CLI process separate from daemon)
- If mistakes exist, append `pastMistakes` field to the a2a JSON output:
  ```json
  {
    "status": "healthy",
    "symptoms": [],
    "pastMistakes": [
      "Previous mistake on src/core/db.ts: 'type mismatch in prepared statement'. Be careful.",
      "Previous mistake on src/core/db.ts: 'empty file after edit'. Be careful."
    ]
  }
  ```
- When no history exists: omit `pastMistakes` entirely (not empty array) to save tokens
- Max 3 entries per response, max 200 chars per entry
- If `/mistake-history` request fails (daemon down): silently skip injection (crash-only resilience)

**3.3** Enhance the auto-heal recording flow: When `diagnose --auto-heal` successfully heals a symptom, POST the mistake details (including `mistake_type` derived from `symptom.patternType` and `description` derived from `symptom.title`) to `/auto-heal/record` with the extended schema from Phase 1.

**Acceptance Criteria:**
- [ ] `/mistake-history?file=src/core/db.ts` returns relevant history entries
- [ ] `afd diagnose --format a2a --auto-heal` output includes `pastMistakes` array when history exists
- [ ] `pastMistakes` entries are human-readable, concise warnings
- [ ] When no history exists, `pastMistakes` is absent (not empty array) to save tokens
- [ ] Hook output remains valid JSON parseable by Claude Code

---

### Phase 4: HUD Counter + One-Line Reasons
**Files:** `.claude/statusline-command.js`, `src/daemon/http-routes.ts`

**4.1** Enhance `/mini-status` endpoint in `src/daemon/http-routes.ts`:
- Add `defense_reasons: string[]` — list of unique `mistake_type` values from **in-memory** `state.autoHealLog` (max 3, most recent first). Do NOT query SQLite here (200ms timeout budget).
- Add `total_defenses: number` — `state.autoHealCount` (already tracked)
- Keep existing `healed_count` and `last_healed` for backward compatibility
- New response shape:
  ```json
  {
    "status": "ON",
    "healed_count": 3,
    "last_healed": "IMM-001",
    "total_defenses": 5,
    "defense_reasons": ["타입 불일치", "파일 삭제 방지", "무한 루프"]
  }
  ```

**4.2** Update `.claude/statusline-command.js` to display new format:
- Current: `afd: ON 3` (healed_count only)
- New: `[afd] 3 defense (type mismatch, file deletion blocked, infinite loop)`
- Format: `[afd] {total_defenses} defense ({reasons.join(", ")})`
- When `total_defenses === 0`: show `[afd] ON`
- When reasons array is empty but count > 0: show `[afd] {count} defense`
- Korean locale variant: `[afd] {count}件 防御 ({reasons})`  — keep Korean as default per existing spec format `3건 방어`

**Acceptance Criteria:**
- [ ] `/mini-status` returns `defense_reasons` and `total_defenses` alongside existing fields
- [ ] HUD shows `[afd] 3건 방어 (타입 불일치, 파일 삭제 방지, 무한 루프)` format when defenses exist
- [ ] HUD shows `[afd] ON` when no defenses have occurred
- [ ] HUD fetch still completes within 200ms timeout (existing AbortSignal.timeout)
- [ ] Existing statusline fields (model, context, rate, cost, branch) are unaffected

---

### Phase 5: Integration Testing + Performance Validation
**Files:** New test files under `tests/` or `src/__tests__/`

**5.1** Unit tests for Hologram L1:
- Test L1 with a known consumer file importing 2 of 5 exports from target
- Verify non-imported exports are name-only stubs
- Verify fallback to L0 when contextFile is invalid
- Verify compression ratio improvement

**5.2** Unit tests for mistake history:
- Test DB insertion and querying
- Test `/mistake-history` endpoint
- Test a2a output includes `pastMistakes` when history exists
- Test a2a output omits `pastMistakes` when no history

**5.3** Integration test for HUD:
- Mock `/mini-status` with defense data
- Verify statusline output format

**5.4** Performance benchmark:
- Measure hologram L1 generation time on a 500-line file (must be < 50ms)
- Measure `/mini-status` with 100 mistake_history rows (must respond < 50ms)
- Measure full S.E.A.M cycle with mistake_history recording (must be < 270ms)

**Acceptance Criteria:**
- [ ] All new tests pass with `bun test`
- [ ] All existing tests pass unchanged
- [ ] No performance regression: S.E.A.M < 270ms, single file < 100ms
- [ ] Hologram L1 achieves >= 85% compression on test fixtures

---

## Success Criteria (Overall)

1. **Hologram L1** delivers measurably higher compression (>= 85%) when `contextFile` is provided, with zero regression on the no-contextFile path.
2. **Mistake history** is recorded on every auto-heal and surfaced in hook output as concise warnings, reducing repeated mistakes.
3. **HUD** shows defense count and reasons, making afd's work visible to the user at a glance.
4. All changes are additive — no breaking changes to existing MCP tools, HTTP endpoints, or CLI commands.
5. Performance budget is maintained across all paths.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hologram L1 import parsing misses edge cases (re-exports, barrel files) | Medium | Low | Fall back to L0 silently; L1 is best-effort optimization |
| mistake_history table grows unbounded | Low | Medium | Add 90-day retention purge in `initDb()` (same pattern as telemetry) |
| `/mini-status` query slows down with large mistake_history | Low | Medium | Index on timestamp + LIMIT 3 keeps it O(1) practically |
| Windows file path normalization issues in mistake_history queries | Medium | Low | Normalize paths with forward slashes before insert/query (existing pattern in http-routes.ts) |
| HUD statusline script timeout (200ms) exceeded with new endpoint data | Low | High | New fields are a single indexed query; benchmark confirms < 50ms |
