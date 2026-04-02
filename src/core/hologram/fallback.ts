import type { HologramResult } from "./types";

/** L0 fallback: return full source when tree-sitter cannot parse */
export function fallbackL0(filePath: string, source: string): HologramResult {
  return {
    hologram: source,
    originalLength: source.length,
    hologramLength: source.length,
    savings: 0,
  };
}
