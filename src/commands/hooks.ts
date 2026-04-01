import { join } from "path";
import { resolveWorkspacePaths } from "../constants";
import {
  readHooksFile,
  writeHooksFile,
  mergeHooks,
  getHookSummary,
  getAfdDesiredHooks,
  type HookOwner,
  type ManagedHook,
} from "../core/hook-manager";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

const OWNER_COLOR: Record<HookOwner, string> = {
  afd: C.cyan,
  omc: C.yellow,
  user: C.dim,
};

function formatHookLine(hook: ManagedHook): string {
  const color = OWNER_COLOR[hook.owner];
  const ownerTag = `[${hook.owner}]`.padEnd(6);
  const id = hook.id.padEnd(24);
  const matcher = hook.matcher || "*";
  return `  ${color}${ownerTag}${C.reset} ${C.bold}${id}${C.reset} ${C.dim}${matcher}${C.reset}`;
}

export function hooksCommand(subcommand?: string): void {
  const hooksPath = join(resolveWorkspacePaths().root, ".claude", "hooks.json");

  if (!subcommand || subcommand === "status") {
    const summary = getHookSummary(hooksPath);
    const total = summary.total;
    console.log("");
    console.log(`${C.bold}afd hooks — Hook Manager${C.reset}`);
    console.log("");
    console.log(`  PreToolUse (${total} hook${total !== 1 ? "s" : ""})`);
    console.log("  " + "─".repeat(48));

    const allInOrder: ManagedHook[] = [
      ...summary.zones.afd,
      ...summary.zones.omc,
      ...summary.zones.user,
    ];

    if (allInOrder.length === 0) {
      console.log(`  ${C.dim}No hooks registered${C.reset}`);
    } else {
      for (const hook of allInOrder) {
        console.log(formatHookLine(hook));
      }
    }

    console.log("");

    const orderStatus = summary.orderingOk
      ? `${C.green}OK${C.reset} ${C.dim}(afd → omc → user)${C.reset}`
      : `${C.yellow}DISORDERED${C.reset} — run ${C.bold}afd hooks sync${C.reset} to fix`;
    console.log(`  Ordering:  ${orderStatus}`);

    if (summary.conflicts.length === 0) {
      console.log(`  Conflicts: ${C.green}none${C.reset}`);
    } else {
      console.log(`  Conflicts: ${C.yellow}${summary.conflicts.length} warning(s)${C.reset}`);
      for (const c of summary.conflicts) {
        const prefix = c.type === "duplicate-id" ? "✗" : "⚠";
        console.log(`    ${C.yellow}${prefix}${C.reset} ${c.type}: ${C.bold}${c.hookA.id}${C.reset} ↔ ${C.bold}${c.hookB.id}${C.reset}`);
        console.log(`      ${C.dim}${c.resolution}${C.reset}`);
      }
    }

    console.log("");
    return;
  }

  if (subcommand === "sync") {
    console.log("");
    console.log(`${C.bold}afd hooks sync${C.reset}`);
    console.log("");

    const config = readHooksFile(hooksPath);
    if (!config.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
      config.hooks = {};
    }
    if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

    const result = mergeHooks(config.hooks.PreToolUse, getAfdDesiredHooks());
    config.hooks.PreToolUse = result.merged;
    writeHooksFile(hooksPath, config);

    let anyChange = false;
    if (result.changes.added.length > 0) {
      console.log(`  Added:     ${result.changes.added.join(", ")}`);
      anyChange = true;
    }
    if (result.changes.removed.length > 0) {
      console.log(`  Removed:   ${result.changes.removed.join(", ")}`);
      anyChange = true;
    }
    if (result.changes.reordered.length > 0) {
      console.log(`  Reordered: ${result.changes.reordered.join(", ")}`);
      anyChange = true;
    }
    if (!anyChange) {
      console.log(`  ${C.green}Already in sync — no changes needed${C.reset}`);
    }

    if (result.conflicts.length > 0) {
      console.log(`  Conflicts: ${C.yellow}${result.conflicts.length} warning(s)${C.reset}`);
      for (const c of result.conflicts) {
        const prefix = c.type === "duplicate-id" ? "✗" : "⚠";
        console.log(`    ${C.yellow}${prefix}${C.reset} ${c.type}: ${C.bold}${c.hookA.id}${C.reset} ↔ ${C.bold}${c.hookB.id}${C.reset}`);
        console.log(`      ${C.dim}${c.resolution}${C.reset}`);
      }
    } else {
      console.log(`  Conflicts: ${C.green}none${C.reset}`);
    }

    console.log(`  ${C.dim}hooks.json updated.${C.reset}`);
    console.log("");
    return;
  }

  console.error(`Unknown subcommand: ${subcommand}`);
  console.error("Usage: afd hooks [status|sync]");
  process.exit(1);
}
