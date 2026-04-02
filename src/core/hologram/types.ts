import type { Tree } from "web-tree-sitter";

export interface HologramResult {
  hologram: string;
  originalLength: number;
  hologramLength: number;
  savings: number; // percentage 0-100
  language?: string;
  isDiff?: boolean;
  changedNodes?: number;
}

export interface HologramOptions {
  contextFile?: string;
  diffOnly?: boolean;
  /** L1: Extract only these named symbols (interfaces, types, classes, functions) */
  symbols?: string[];
}

export interface LanguageExtractor {
  /** Supported file extensions (without dot) */
  extensions: string[];
  /** Tree-sitter grammar name for WASM resolution */
  grammarName: string;
  /** Extract type signatures from AST */
  extract(tree: Tree, source: string, options?: HologramOptions): string[];
}
