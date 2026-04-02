/**
 * Hologram Engine — Language Dispatcher
 *
 * Routes file parsing to the appropriate tree-sitter extractor based on extension.
 * Falls back to L0 (full source) for unsupported languages or parse errors.
 */

import { TreeSitterEngine } from "./hologram/engine";
import { tsExtractor } from "./hologram/ts-extractor";
import { pyExtractor } from "./hologram/py-extractor";
import { goExtractor } from "./hologram/go-extractor";
import { rustExtractor } from "./hologram/rust-extractor";
import { fallbackL0 } from "./hologram/fallback";
import { generateIncrementalHologram, setCachedHologram } from "./hologram/incremental";
import type { HologramResult, HologramOptions, LanguageExtractor } from "./hologram/types";

// Re-export types for backward compatibility
export type { HologramResult, HologramOptions } from "./hologram/types";
export { clearHologramCache } from "./hologram/incremental";

const extractors: LanguageExtractor[] = [tsExtractor, pyExtractor, goExtractor, rustExtractor];

function detectExtractor(filePath: string): LanguageExtractor | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return extractors.find(e => e.extensions.includes(ext)) ?? null;
}

export async function generateHologram(
  filePath: string,
  source: string,
  options?: HologramOptions,
): Promise<HologramResult> {
  const extractor = detectExtractor(filePath);

  if (!extractor) {
    return fallbackL0(filePath, source);
  }

  // Incremental diff mode
  if (options?.diffOnly) {
    try {
      return await generateIncrementalHologram(filePath, source, extractor, options);
    } catch {
      return fallbackL0(filePath, source);
    }
  }

  try {
    const engine = await TreeSitterEngine.getInstance();
    const tree = await engine.parse(source, extractor.grammarName);
    const lines = extractor.extract(tree, source, options);
    tree.delete();

    // Cache for future incremental diffs
    setCachedHologram(filePath, lines);

    const hologram = lines.join("\n");
    const hologramLength = hologram.length;
    const savings = source.length > 0
      ? Math.round((source.length - hologramLength) / source.length * 1000) / 10
      : 0;

    return {
      hologram,
      originalLength: source.length,
      hologramLength,
      savings,
      language: extractor.grammarName,
    };
  } catch {
    return fallbackL0(filePath, source);
  }
}
