import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  classifyOwner,
  classifyHooks,
  detectConflicts,
  mergeHooks,
  readHooksFile,
  writeHooksFile,
  getHookSummary,
  KNOWN_AFD_HOOKS,
  type HookEntry,
  type ManagedHook,
} from "../../src/core/hook-manager";

const TMP = join(import.meta.dir, "..", "__tmp_hook_manager__");

function setup() {
  mkdirSync(TMP, { recursive: true });
}

function cleanup() {
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}

// ── Classification ────────────────────────────────────────────────────────────

describe("classifyOwner", () => {
  test("classifies afd- prefix as afd owner", () => {
    expect(classifyOwner("afd-auto-heal")).toBe("afd");
    expect(classifyOwner("afd-read-gate")).toBe("afd");
  });

  test("classifies omc- prefix as omc owner", () => {
    expect(classifyOwner("omc-router")).toBe("omc");
    expect(classifyOwner("omc-state")).toBe("omc");
  });

  test("classifies unknown prefix as user owner", () => {
    expect(classifyOwner("my-hook")).toBe("user");
    expect(classifyOwner("lint-check")).toBe("user");
    expect(classifyOwner("")).toBe("user");
  });
});

describe("classifyHooks", () => {
  test("classifies mixed hooks into correct zones", () => {
    const entries: HookEntry[] = [
      { id: "afd-auto-heal", command: "afd diagnose" },
      { id: "omc-router", command: "omc route" },
      { id: "my-hook", command: "do-thing" },
    ];
    const zones = classifyHooks(entries);
    expect(zones.get("afd")!).toHaveLength(1);
    expect(zones.get("omc")!).toHaveLength(1);
    expect(zones.get("user")!).toHaveLength(1);
  });

  test("assigns generated id to hooks without id field", () => {
    const entries: HookEntry[] = [
      { command: "some-script" },
    ];
    const zones = classifyHooks(entries);
    const userHooks = zones.get("user")!;
    expect(userHooks).toHaveLength(1);
    expect(userHooks[0].id).toMatch(/^user-anonymous-/);
    expect(userHooks[0].owner).toBe("user");
  });
});

// ── Conflict Detection ────────────────────────────────────────────────────────

describe("detectConflicts", () => {
  test("detects duplicate id across owners", () => {
    const hooks: ManagedHook[] = [
      { id: "my-hook", matcher: "Write", command: "a", owner: "afd" },
      { id: "my-hook", matcher: "Read", command: "b", owner: "user" },
    ];
    const conflicts = detectConflicts(hooks);
    expect(conflicts.some(c => c.type === "duplicate-id")).toBe(true);
  });

  test("detects matcher overlap across owners", () => {
    const hooks: ManagedHook[] = [
      { id: "afd-auto-heal", matcher: "Write|Edit|MultiEdit", command: "afd", owner: "afd" },
      { id: "my-hook", matcher: "Write", command: "lint", owner: "user" },
    ];
    const conflicts = detectConflicts(hooks);
    expect(conflicts.some(c => c.type === "matcher-overlap")).toBe(true);
  });

  test("ignores matcher overlap within same owner", () => {
    const hooks: ManagedHook[] = [
      { id: "afd-hook-a", matcher: "Write", command: "a", owner: "afd" },
      { id: "afd-hook-b", matcher: "Write", command: "b", owner: "afd" },
    ];
    const conflicts = detectConflicts(hooks);
    expect(conflicts.filter(c => c.type === "matcher-overlap")).toHaveLength(0);
  });

  test("detects wildcard matcher overlap", () => {
    const hooks: ManagedHook[] = [
      { id: "afd-auto-heal", matcher: "Write", command: "afd", owner: "afd" },
      { id: "omc-router", matcher: "*", command: "omc", owner: "omc" },
    ];
    const conflicts = detectConflicts(hooks);
    expect(conflicts.some(c => c.type === "matcher-overlap")).toBe(true);
  });

  test("reports no conflicts for non-overlapping matchers", () => {
    const hooks: ManagedHook[] = [
      { id: "afd-auto-heal", matcher: "Write|Edit|MultiEdit", command: "afd", owner: "afd" },
      { id: "my-hook", matcher: "Read", command: "lint", owner: "user" },
    ];
    const conflicts = detectConflicts(hooks);
    expect(conflicts.filter(c => c.type === "matcher-overlap")).toHaveLength(0);
  });
});

// ── Merge ─────────────────────────────────────────────────────────────────────

describe("mergeHooks", () => {
  const afdHook: HookEntry = { id: "afd-auto-heal", matcher: "Write|Edit|MultiEdit", command: "afd diagnose" };

  test("merges empty file with afd hooks", () => {
    const result = mergeHooks([], [afdHook]);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].id).toBe("afd-auto-heal");
    expect(result.changes.added).toContain("afd-auto-heal");
  });

  test("preserves existing user hooks after afd hooks", () => {
    const current: HookEntry[] = [
      afdHook,
      { id: "my-hook", matcher: "Read", command: "lint" },
    ];
    const result = mergeHooks(current, [afdHook]);
    expect(result.merged).toHaveLength(2);
    expect(result.merged[0].id).toBe("afd-auto-heal");
    expect(result.merged[1].id).toBe("my-hook");
  });

  test("preserves existing omc hooks between afd and user", () => {
    const current: HookEntry[] = [
      afdHook,
      { id: "omc-router", matcher: "*", command: "omc" },
      { id: "my-hook", matcher: "Read", command: "lint" },
    ];
    const result = mergeHooks(current, [afdHook]);
    expect(result.merged[0].id).toBe("afd-auto-heal");
    expect(result.merged[1].id).toBe("omc-router");
    expect(result.merged[2].id).toBe("my-hook");
  });

  test("reorders misplaced hooks to correct zone order", () => {
    // User hook before afd hook — should be reordered
    const current: HookEntry[] = [
      { id: "my-hook", matcher: "Read", command: "lint" },
      afdHook,
    ];
    const result = mergeHooks(current, [afdHook]);
    expect(result.merged[0].id).toBe("afd-auto-heal");
    expect(result.merged[1].id).toBe("my-hook");
    expect(result.changes.reordered.length).toBeGreaterThan(0);
  });

  test("updates afd hook command if changed", () => {
    const current: HookEntry[] = [
      { id: "afd-auto-heal", matcher: "Write", command: "OLD_COMMAND" },
    ];
    const result = mergeHooks(current, [afdHook]);
    expect(result.merged[0].command).toBe("afd diagnose");
  });

  test("removes stale afd hooks not in desired list", () => {
    const current: HookEntry[] = [afdHook];
    const result = mergeHooks(current, []); // Empty desired = remove all known afd hooks
    expect(result.merged.filter(h => h.id === "afd-auto-heal")).toHaveLength(0);
    expect(result.changes.removed).toContain("afd-auto-heal");
  });

  test("is idempotent — merge twice produces same result", () => {
    const current: HookEntry[] = [
      afdHook,
      { id: "my-hook", matcher: "Read", command: "lint" },
    ];
    const first = mergeHooks(current, [afdHook]);
    const second = mergeHooks(first.merged, [afdHook]);
    expect(second.merged.map(h => h.id)).toEqual(first.merged.map(h => h.id));
    expect(second.changes.added).toHaveLength(0);
    expect(second.changes.removed).toHaveLength(0);
    expect(second.changes.reordered).toHaveLength(0);
  });
});

// ── Read/Write ────────────────────────────────────────────────────────────────

describe("readHooksFile / writeHooksFile", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("reads valid hooks.json", () => {
    const p = join(TMP, "hooks.json");
    writeFileSync(p, JSON.stringify({ hooks: { PreToolUse: [{ id: "a", command: "cmd" }] } }));
    const config = readHooksFile(p);
    expect(config.hooks?.PreToolUse).toHaveLength(1);
  });

  test("handles missing hooks.json gracefully", () => {
    const config = readHooksFile(join(TMP, "nonexistent.json"));
    expect(config).toEqual({ hooks: {} });
  });

  test("handles malformed hooks.json gracefully", () => {
    const p = join(TMP, "hooks.json");
    writeFileSync(p, "{ invalid json }}}");
    const config = readHooksFile(p);
    expect(config).toEqual({ hooks: {} });
  });

  test("writes valid JSON with 2-space indent", () => {
    const p = join(TMP, "hooks.json");
    writeHooksFile(p, { hooks: { PreToolUse: [{ id: "a", command: "cmd" }] } });
    const raw = readFileSync(p, "utf-8");
    expect(raw).toContain("  "); // 2-space indent
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("creates parent directory if needed", () => {
    const p = join(TMP, "sub", "dir", "hooks.json");
    writeHooksFile(p, { hooks: {} });
    expect(existsSync(p)).toBe(true);
  });
});

// ── Hook Summary ──────────────────────────────────────────────────────────────

describe("getHookSummary", () => {
  beforeEach(setup);
  afterEach(cleanup);

  test("reports correct zone counts", () => {
    const p = join(TMP, "hooks.json");
    writeFileSync(p, JSON.stringify({
      hooks: {
        PreToolUse: [
          { id: "afd-auto-heal", matcher: "Write", command: "afd" },
          { id: "omc-router", matcher: "*", command: "omc" },
          { id: "my-hook", matcher: "Read", command: "lint" },
        ],
      },
    }));
    const summary = getHookSummary(p);
    expect(summary.zones.afd).toHaveLength(1);
    expect(summary.zones.omc).toHaveLength(1);
    expect(summary.zones.user).toHaveLength(1);
    expect(summary.total).toBe(3);
  });

  test("reports orderingOk=true for correct order", () => {
    const p = join(TMP, "hooks.json");
    writeFileSync(p, JSON.stringify({
      hooks: {
        PreToolUse: [
          { id: "afd-auto-heal", command: "afd" },
          { id: "my-hook", command: "lint" },
        ],
      },
    }));
    const summary = getHookSummary(p);
    expect(summary.orderingOk).toBe(true);
  });

  test("reports orderingOk=false for wrong order", () => {
    const p = join(TMP, "hooks.json");
    writeFileSync(p, JSON.stringify({
      hooks: {
        PreToolUse: [
          { id: "my-hook", command: "lint" },
          { id: "afd-auto-heal", command: "afd" },
        ],
      },
    }));
    const summary = getHookSummary(p);
    expect(summary.orderingOk).toBe(false);
  });

  test("handles missing hooks.json", () => {
    const summary = getHookSummary(join(TMP, "missing.json"));
    expect(summary.total).toBe(0);
    expect(summary.orderingOk).toBe(true);
    expect(summary.conflicts).toHaveLength(0);
  });
});

// ── KNOWN_AFD_HOOKS safety ────────────────────────────────────────────────────

describe("KNOWN_AFD_HOOKS removal safety", () => {
  test("afd-read-gate IS in KNOWN_AFD_HOOKS as an optional afd hook", () => {
    expect(KNOWN_AFD_HOOKS.has("afd-read-gate")).toBe(true);
  });

  test("afd-auto-heal IS in KNOWN_AFD_HOOKS (managed by afd, removed on stop)", () => {
    expect(KNOWN_AFD_HOOKS.has("afd-auto-heal")).toBe(true);
  });
});
