/**
 * Import Resolver — Lightweight TS/JS import resolution
 *
 * Parses import statements via regex and resolves relative specifiers
 * to absolute file paths. Ignores bare specifiers (node_modules).
 */

import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join, basename } from "path";

export interface ResolvedImport {
  specifier: string;       // raw specifier from source (e.g., "./utils")
  symbols: string[];       // imported names (["greet"] or ["*"] for namespace)
  resolvedPath: string;    // absolute file path
}

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** Try to resolve a relative specifier to an actual file path */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith(".")) return null; // skip bare specifiers (fs, express, etc.)

  const dir = dirname(fromFile);
  const base = resolve(dir, specifier);

  // Direct file match
  for (const ext of TS_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }

  // Index file in directory
  for (const ext of TS_EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }

  // Already has extension
  if (existsSync(base)) return base;

  return null;
}

/**
 * Parse import statements from source and resolve relative ones to file paths.
 * Returns only imports that resolve to actual files.
 */
export function resolveImports(source: string, fromFile: string): ResolvedImport[] {
  const results: ResolvedImport[] = [];

  // Named: import { A, B } from "./module"
  const namedRe = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(namedRe)) {
    const symbols = m[1].split(",").map(s => s.replace(/\s+as\s+\w+/, "").trim()).filter(Boolean);
    const specifier = m[2];
    const resolved = resolveSpecifier(specifier, fromFile);
    if (resolved) results.push({ specifier, symbols, resolvedPath: resolved });
  }

  // Namespace: import * as X from "./module"
  const nsRe = /import\s+\*\s+as\s+\w+\s+from\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(nsRe)) {
    const specifier = m[1];
    const resolved = resolveSpecifier(specifier, fromFile);
    if (resolved) results.push({ specifier, symbols: ["*"], resolvedPath: resolved });
  }

  // Default: import X from "./module" (not already captured by named/namespace)
  const defaultRe = /import\s+(\w+)\s+from\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(defaultRe)) {
    const symbol = m[1];
    const specifier = m[2];
    // Skip if already captured by namespace regex
    if (results.some(r => r.specifier === specifier)) continue;
    const resolved = resolveSpecifier(specifier, fromFile);
    if (resolved) results.push({ specifier, symbols: [symbol], resolvedPath: resolved });
  }

  // Combined: import X, { A, B } from "./module"
  const combinedRe = /import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  for (const m of source.matchAll(combinedRe)) {
    const defaultSymbol = m[1];
    const named = m[2].split(",").map(s => s.replace(/\s+as\s+\w+/, "").trim()).filter(Boolean);
    const specifier = m[3];
    // Avoid duplicates from named regex
    const existing = results.find(r => r.specifier === specifier);
    if (existing) {
      if (!existing.symbols.includes(defaultSymbol)) existing.symbols.push(defaultSymbol);
    } else {
      const resolved = resolveSpecifier(specifier, fromFile);
      if (resolved) results.push({ specifier, symbols: [defaultSymbol, ...named], resolvedPath: resolved });
    }
  }

  // Barrel file resolution: if resolved path is an index.ts barrel,
  // trace re-exports to find the actual source files for each symbol.
  const expanded: ResolvedImport[] = [];
  for (const r of results) {
    const resolved = resolveBarrelExports(r.resolvedPath, r.symbols, r.specifier);
    if (resolved.length > 0) {
      expanded.push(...resolved);
    } else {
      expanded.push(r);
    }
  }

  // De-duplicate by resolvedPath
  const seen = new Map<string, ResolvedImport>();
  for (const r of expanded) {
    const existing = seen.get(r.resolvedPath);
    if (existing) {
      for (const s of r.symbols) {
        if (!existing.symbols.includes(s)) existing.symbols.push(s);
      }
    } else {
      seen.set(r.resolvedPath, r);
    }
  }

  return [...seen.values()];
}

/**
 * If resolvedPath is a barrel file (index.ts), trace re-exports to find
 * the actual source file for each requested symbol.
 * Returns empty array if not a barrel or no re-exports matched.
 */
function resolveBarrelExports(
  barrelPath: string,
  symbols: string[],
  originalSpecifier: string,
): ResolvedImport[] {
  // Only process index files
  const name = basename(barrelPath).replace(/\.[tj]sx?$/, "");
  if (name !== "index") return [];

  let barrelSource: string;
  try { barrelSource = readFileSync(barrelPath, "utf-8"); } catch { return []; }

  // Parse re-export statements from barrel
  // Pattern A: export { X, Y } from './module'
  const namedReexport = /export\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  // Pattern B: export * from './module'
  const wildcardReexport = /export\s+\*\s+from\s+["']([^"']+)["']/g;

  // Build symbol → source file mapping
  const symbolMap = new Map<string, string>(); // symbol → resolved path

  for (const m of barrelSource.matchAll(namedReexport)) {
    const exported = m[1].split(",").map(s => s.replace(/\s+as\s+\w+/, "").trim()).filter(Boolean);
    const specifier = m[2];
    const resolved = resolveSpecifier(specifier, barrelPath);
    if (resolved) {
      for (const sym of exported) symbolMap.set(sym, resolved);
    }
  }

  for (const m of barrelSource.matchAll(wildcardReexport)) {
    const specifier = m[1];
    const resolved = resolveSpecifier(specifier, barrelPath);
    if (!resolved) continue;
    // For wildcard, we need to check if any requested symbol exists in this file
    let depSource: string;
    try { depSource = readFileSync(resolved, "utf-8"); } catch { continue; }
    for (const sym of symbols) {
      if (symbolMap.has(sym)) continue; // already found via named re-export
      // Quick check: does this file export the symbol?
      const exportPattern = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|class|interface|type|enum|let|var)\\s+${sym}\\b`);
      if (exportPattern.test(depSource)) {
        symbolMap.set(sym, resolved);
      }
    }
  }

  if (symbolMap.size === 0) return [];

  // Group symbols by resolved file
  const byFile = new Map<string, string[]>();
  for (const [sym, path] of symbolMap) {
    if (!symbols.includes(sym)) continue; // only requested symbols
    const arr = byFile.get(path) ?? [];
    arr.push(sym);
    byFile.set(path, arr);
  }

  return [...byFile.entries()].map(([resolvedPath, syms]) => ({
    specifier: originalSpecifier,
    symbols: syms,
    resolvedPath,
  }));
}
