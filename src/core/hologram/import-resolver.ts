/**
 * Import Resolver — Lightweight TS/JS import resolution
 *
 * Parses import statements via regex and resolves relative specifiers
 * to absolute file paths. Ignores bare specifiers (node_modules).
 */

import { existsSync } from "fs";
import { resolve, dirname, join } from "path";

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

  // De-duplicate by resolvedPath
  const seen = new Map<string, ResolvedImport>();
  for (const r of results) {
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
