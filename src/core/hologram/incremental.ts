/**
 * Incremental Hologram — diff-only mode.
 *
 * Compares previous and current hologram extractions,
 * returns only changed nodes with surrounding context in unified-diff style.
 */

import type { Tree } from "web-tree-sitter";
import type { HologramResult, LanguageExtractor, HologramOptions } from "./types";
import { TreeSitterEngine } from "./engine";

/** In-memory cache for previous hologram lines (per file path) */
const hologramCache = new Map<string, string[]>();

/** Maximum cache entries */
const MAX_CACHE_SIZE = 200;

export function clearHologramCache(): void {
  hologramCache.clear();
}

export function setCachedHologram(filePath: string, lines: string[]): void {
  // True LRU: delete existing entry first so re-insert moves it to end
  hologramCache.delete(filePath);
  if (hologramCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = hologramCache.keys().next().value;
    if (oldestKey) hologramCache.delete(oldestKey);
  }
  hologramCache.set(filePath, lines);
}

export function getCachedHologram(filePath: string): string[] | undefined {
  const value = hologramCache.get(filePath);
  if (value !== undefined) {
    // Promote to most-recently-used position
    hologramCache.delete(filePath);
    hologramCache.set(filePath, value);
  }
  return value;
}

/**
 * Generate an incremental (diff-only) hologram.
 * Compares current extraction with cached previous result.
 * Returns unified-diff style output showing only changed nodes.
 */
export async function generateIncrementalHologram(
  filePath: string,
  source: string,
  extractor: LanguageExtractor,
  options?: HologramOptions,
): Promise<HologramResult> {
  const engine = await TreeSitterEngine.getInstance();
  const tree = await engine.parse(source, extractor.grammarName);
  const currentLines = extractor.extract(tree, source, options);
  tree.delete();

  const previousLines = getCachedHologram(filePath);

  // Cache current result for next diff
  setCachedHologram(filePath, currentLines);

  // No previous → return full hologram with diff header
  if (!previousLines) {
    const hologram = currentLines.join("\n");
    return {
      hologram,
      originalLength: source.length,
      hologramLength: hologram.length,
      savings: source.length > 0
        ? Math.round((source.length - hologram.length) / source.length * 1000) / 10
        : 0,
      language: extractor.grammarName,
      isDiff: false,
      changedNodes: currentLines.length,
    };
  }

  // Diff previous vs current lines
  const diffOutput = buildUnifiedDiff(filePath, previousLines, currentLines);

  return {
    hologram: diffOutput.text,
    originalLength: source.length,
    hologramLength: diffOutput.text.length,
    savings: source.length > 0
      ? Math.round((source.length - diffOutput.text.length) / source.length * 1000) / 10
      : 0,
    language: extractor.grammarName,
    isDiff: true,
    changedNodes: diffOutput.changedCount,
  };
}

interface DiffOutput {
  text: string;
  changedCount: number;
}

/**
 * Build a unified-diff style output comparing old and new hologram lines.
 * Groups unchanged lines into summary markers, shows changed lines with +/- prefixes.
 */
function buildUnifiedDiff(filePath: string, oldLines: string[], newLines: string[]): DiffOutput {
  const header = `--- a/${filePath} (previous)\n+++ b/${filePath} (current)\n`;

  // Simple line-by-line diff using LCS approach
  const hunks = computeHunks(oldLines, newLines);

  if (hunks.length === 0) {
    return {
      text: header + "@@ no changes @@",
      changedCount: 0,
    };
  }

  const parts: string[] = [header];
  let changedCount = 0;
  let oldIdx = 0;

  for (const hunk of hunks) {
    // Show unchanged lines before this hunk as a summary
    const unchangedBefore = hunk.oldStart - oldIdx;
    if (unchangedBefore > 0) {
      const summaryLines = oldLines.slice(oldIdx, hunk.oldStart);
      const firstLine = summaryLines[0]?.split("{")[0]?.trim() ?? "...";
      parts.push(`@@ unchanged: ${firstLine} (${unchangedBefore} ${unchangedBefore === 1 ? "declaration" : "declarations"}) @@`);
    }

    // Show removed lines
    for (let i = hunk.oldStart; i < hunk.oldStart + hunk.oldCount; i++) {
      parts.push(`- ${oldLines[i]}`);
      changedCount++;
    }

    // Show added lines
    for (let i = hunk.newStart; i < hunk.newStart + hunk.newCount; i++) {
      parts.push(`+ ${newLines[i]}`);
    }

    oldIdx = hunk.oldStart + hunk.oldCount;
  }

  // Trailing unchanged
  const trailingCount = oldLines.length - oldIdx;
  if (trailingCount > 0) {
    parts.push(`@@ unchanged: ${trailingCount} more ${trailingCount === 1 ? "declaration" : "declarations"} @@`);
  }

  return { text: parts.join("\n"), changedCount };
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

/**
 * Compute diff hunks between old and new line arrays.
 * Uses a simple O(n*m) LCS-based diff suitable for small arrays (hologram lines are typically < 100).
 */
function computeHunks(oldLines: string[], newLines: string[]): Hunk[] {
  const n = oldLines.length;
  const m = newLines.length;

  // Guard: for very large inputs, fall back to full diff to stay within SEAM budget
  if (n * m > 50_000) {
    return [{ oldStart: 0, oldCount: n, newStart: 0, newCount: m }];
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matching lines
  const matches: Array<[number, number]> = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift([i - 1, j - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Convert matches to hunks (gaps between matches)
  const hunks: Hunk[] = [];
  let oi = 0, ni = 0;

  for (const [mi, mj] of matches) {
    if (oi < mi || ni < mj) {
      hunks.push({
        oldStart: oi,
        oldCount: mi - oi,
        newStart: ni,
        newCount: mj - ni,
      });
    }
    oi = mi + 1;
    ni = mj + 1;
  }

  // Trailing diff
  if (oi < n || ni < m) {
    hunks.push({
      oldStart: oi,
      oldCount: n - oi,
      newStart: ni,
      newCount: m - ni,
    });
  }

  return hunks;
}
