/**
 * Workspace Map — cached project structure with export signatures.
 * Provides afd://workspace-map MCP resource.
 */

import { readdirSync, readFileSync, lstatSync } from "fs";
import { join } from "path";

const MAX_WALK_DEPTH = 8;
const SKIP_DIRS = new Set(["node_modules", ".afd", ".git", "dist", "coverage"]);
const CODE_EXTS = /\.[tj]sx?$/;
const DOC_EXTS = /\.(ts|js|tsx|jsx|json|md)$/;

/** Build a workspace map: file tree with sizes and export signatures */
function buildWorkspaceMap(): { map: string; totalProjectBytes: number } {
  const cwd = process.cwd();
  const lines: string[] = [`# Workspace Map — ${cwd}`, `# Generated: ${new Date().toISOString()}`, ""];
  let totalProjectBytes = 0;

  function walk(dir: string, prefix: string, depth: number) {
    if (depth > MAX_WALK_DEPTH) return;
    let entries: string[];
    try { entries = readdirSync(dir).sort(); } catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      try {
        const lst = lstatSync(fullPath);
        if (lst.isSymbolicLink()) continue;
        if (lst.isDirectory()) {
          lines.push(`${prefix}${entry}/`);
          walk(fullPath, prefix + "  ", depth + 1);
          continue;
        }
        if (!DOC_EXTS.test(entry)) continue;
        totalProjectBytes += lst.size;
        const sizeKB = (lst.size / 1024).toFixed(1);
        if (CODE_EXTS.test(entry) && lst.size < 100 * 1024) {
          try {
            const source = readFileSync(fullPath, "utf-8");
            const exports = source.match(/export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g);
            const sigs = exports ? exports.map(e => e.replace(/^export\s+(async\s+)?/, "").trim()).slice(0, 5).join(", ") : "";
            const extra = exports && exports.length > 5 ? ` +${exports.length - 5} more` : "";
            lines.push(`${prefix}${entry}  (${sizeKB}KB)${sigs ? `  → ${sigs}${extra}` : ""}`);
          } catch {
            lines.push(`${prefix}${entry}  (${sizeKB}KB)`);
          }
        } else {
          lines.push(`${prefix}${entry}  (${sizeKB}KB)`);
        }
      } catch { /* skip */ }
    }
  }

  walk(join(cwd, "src"), "  ", 0);

  lines.push("", "# Root files");
  for (const f of ["CLAUDE.md", "package.json", ".claudeignore", ".mcp.json"]) {
    try {
      const st = lstatSync(join(cwd, f));
      totalProjectBytes += st.size;
      lines.push(`  ${f}  (${(st.size / 1024).toFixed(1)}KB)`);
    } catch { /* not found */ }
  }

  return { map: lines.join("\n"), totalProjectBytes };
}

/**
 * Creates a workspace map manager with lazy caching.
 * Returns getWorkspaceMap() and markMapDirty() functions.
 */
export function createWorkspaceMap() {
  let cache = "";
  let dirty = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastTotalProjectBytes = 0;
  let lastMapBytes = 0;

  function get(): string {
    if (dirty || !cache) {
      const result = buildWorkspaceMap();
      cache = result.map;
      lastTotalProjectBytes = result.totalProjectBytes;
      lastMapBytes = result.map.length;
      dirty = false;
    }
    return cache;
  }

  function getLastBuildStats() {
    return { totalProjectBytes: lastTotalProjectBytes, mapBytes: lastMapBytes };
  }

  function markDirty() {
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { get(); }, 5000);
  }

  function getTimer() { return timer; }

  return { get, getLastBuildStats, markDirty, getTimer };
}
