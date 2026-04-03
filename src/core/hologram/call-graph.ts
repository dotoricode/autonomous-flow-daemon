/**
 * Call Graph Tracer — N-Depth Cross-File Symbol Resolution
 *
 * Uses Tree-sitter AST to trace function calls across files.
 * Extracts only signatures (not bodies) of called functions from external files.
 * Supports L2 (1-depth) and L3 (2-depth) traversal.
 */

import { readFileSync } from "fs";
import { TreeSitterEngine } from "./engine";
import { resolveImports, type ResolvedImport } from "./import-resolver";
import type { Tree, SyntaxNode } from "web-tree-sitter";

export interface TraceResult {
  symbol: string;        // function/class/type name
  sourceFile: string;    // absolute path of the defining file
  signature: string;     // extracted type signature line
  depth: number;         // 2 = L2 (direct import), 3 = L3 (transitive)
}

export interface TraceOptions {
  maxDepth?: number;     // default: 2 (L2). max: 3 (L3).
}

/** Extract called function names from AST that match imported symbols */
function extractCalledSymbols(tree: Tree, importedSymbols: Set<string>): Set<string> {
  const called = new Set<string>();

  function walk(node: SyntaxNode) {
    // call_expression: greet("world") → identifier "greet"
    if (node.type === "call_expression") {
      const fn = node.firstChild;
      if (fn?.type === "identifier" && importedSymbols.has(fn.text)) {
        called.add(fn.text);
      }
      // member_expression: utils.greet() → property "greet"
      if (fn?.type === "member_expression") {
        const prop = fn.lastChild;
        if (prop?.type === "property_identifier" && importedSymbols.has(prop.text)) {
          called.add(prop.text);
        }
      }
    }

    // Type references: const x: SomeType = ... or function foo(a: SomeType)
    if (node.type === "type_identifier" && importedSymbols.has(node.text)) {
      called.add(node.text);
    }

    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i)!);
    }
  }

  walk(tree.rootNode);
  return called;
}

/** Extract the signature of a named export from a parsed tree */
function extractSignature(tree: Tree, source: string, symbolName: string): string | null {
  function walk(node: SyntaxNode): string | null {
    // Look for export statements or top-level declarations
    if (
      node.type === "export_statement" ||
      node.type === "function_declaration" ||
      node.type === "class_declaration" ||
      node.type === "type_alias_declaration" ||
      node.type === "interface_declaration" ||
      node.type === "lexical_declaration"
    ) {
      const text = node.text;
      // Check if this declaration contains our symbol name
      if (text.includes(symbolName)) {
        // For functions: extract signature without body
        if (text.includes("function " + symbolName) || text.includes("function\n" + symbolName)) {
          const bodyStart = text.indexOf("{");
          if (bodyStart !== -1) {
            return text.slice(0, bodyStart).trim();
          }
          return text.split("\n")[0].trim();
        }
        // For interfaces/types: extract header + body (they ARE the signature)
        if (node.type === "interface_declaration" || node.type === "type_alias_declaration" ||
            (node.type === "export_statement" && (text.includes("interface ") || text.includes("type ")))) {
          return text;
        }
        // For const/let arrow functions: extract up to the arrow or type annotation
        if (text.includes("const " + symbolName) || text.includes("let " + symbolName)) {
          const arrowIdx = text.indexOf("=>");
          const eqIdx = text.indexOf("=");
          if (arrowIdx !== -1) {
            return text.slice(0, arrowIdx + 2).trim();
          }
          if (eqIdx !== -1) {
            // Get type annotation before =
            const beforeEq = text.slice(0, eqIdx).trim();
            return beforeEq;
          }
        }
        // For class: header only
        if (text.includes("class " + symbolName)) {
          const bodyStart = text.indexOf("{");
          if (bodyStart !== -1) {
            return text.slice(0, bodyStart).trim();
          }
        }
        // Fallback: first line
        return text.split("\n")[0].trim();
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      const result = walk(node.child(i)!);
      if (result) return result;
    }
    return null;
  }

  return walk(tree.rootNode);
}

/**
 * Trace the call graph from a target file, following imports up to maxDepth.
 *
 * @param targetPath - Absolute path of the target file
 * @param targetSource - Source content of the target file
 * @param options - Trace options (maxDepth: 2 or 3)
 * @returns Array of traced symbols with their signatures
 */
export async function traceCallGraph(
  targetPath: string,
  targetSource: string,
  options?: TraceOptions,
): Promise<TraceResult[]> {
  const maxDepth = Math.min(options?.maxDepth ?? 2, 3);
  const results: TraceResult[] = [];
  const visited = new Set<string>(); // absolute paths already processed (circular protection)
  visited.add(targetPath);

  const engine = await TreeSitterEngine.getInstance();

  async function trace(source: string, filePath: string, currentDepth: number) {
    if (currentDepth > maxDepth) return;

    // 1. Parse AST
    let tree: Tree;
    try {
      tree = await engine.parse(source, "typescript");
    } catch {
      return;
    }

    // 2. Resolve imports
    const imports = resolveImports(source, filePath);

    // 3. Build symbol → import mapping
    const allImportedSymbols = new Set<string>();
    const symbolToImport = new Map<string, ResolvedImport>();
    for (const imp of imports) {
      for (const sym of imp.symbols) {
        if (sym === "*") {
          // Namespace: we can't know which symbols are used without deeper analysis
          // Mark all exports from the target file as potentially used
          allImportedSymbols.add("*:" + imp.resolvedPath);
        } else {
          allImportedSymbols.add(sym);
          symbolToImport.set(sym, imp);
        }
      }
    }

    // 4. Find which imported symbols are actually called/referenced
    const calledSymbols = extractCalledSymbols(tree, allImportedSymbols);
    tree.delete();

    // 5. For each called symbol, extract its signature from the source file
    for (const sym of calledSymbols) {
      const imp = symbolToImport.get(sym);
      if (!imp) continue;
      if (visited.has(imp.resolvedPath + ":" + sym)) continue;
      visited.add(imp.resolvedPath + ":" + sym);

      let depSource: string;
      try {
        depSource = readFileSync(imp.resolvedPath, "utf-8");
      } catch {
        continue;
      }

      let depTree: Tree;
      try {
        depTree = await engine.parse(depSource, "typescript");
      } catch {
        continue;
      }

      const sig = extractSignature(depTree, depSource, sym);
      if (sig) {
        results.push({
          symbol: sym,
          sourceFile: imp.resolvedPath,
          signature: sig,
          depth: currentDepth,
        });
      }

      // 6. Recurse into the dependency file for deeper tracing
      if (currentDepth < maxDepth && !visited.has(imp.resolvedPath)) {
        visited.add(imp.resolvedPath);
        await trace(depSource, imp.resolvedPath, currentDepth + 1);
      }

      depTree.delete();
    }
  }

  await trace(targetSource, targetPath, 2); // L2 = depth 2
  return results;
}
