/**
 * Semantic Diff Engine — AST-based change classification for TypeScript/JavaScript.
 *
 * Instead of line-by-line text diff, parses both old and new source into AST,
 * extracts top-level declarations, and classifies changes as:
 *   - signature-change (breaking)
 *   - body-change (non-breaking)
 *   - added / removed
 *   - renamed
 *   - comment-only
 *
 * Falls back to text diff for non-TS/JS files.
 */

import ts from "typescript";

export type ChangeKind =
  | "signature-change"  // function/class signature modified (breaking)
  | "body-change"       // implementation changed, signature intact
  | "added"             // new declaration
  | "removed"           // declaration deleted
  | "export-change"     // export modifier added/removed
  | "comment-only"      // only comments changed
  | "whitespace-only"   // only formatting changed
  | "type-change"       // type annotation changed
  | "unknown";

export interface SemanticChange {
  kind: ChangeKind;
  name: string;           // declaration name
  nodeType: string;       // "function", "class", "interface", "variable", etc.
  breaking: boolean;      // true if this could break consumers
  detail?: string;        // human-readable description
}

export interface SemanticDiffResult {
  changes: SemanticChange[];
  hasBreakingChanges: boolean;
  summary: string;        // one-line summary for logging
}

interface DeclInfo {
  name: string;
  nodeType: string;
  signature: string;      // type signature (no body)
  body: string;           // full text including body
  exported: boolean;
  hasComments: boolean;
}

/** Check if a file path is TypeScript or JavaScript */
export function isAstSupported(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/.test(filePath);
}

/** Generate semantic diff between old and new source */
export function semanticDiff(filePath: string, oldSource: string, newSource: string): SemanticDiffResult {
  if (!isAstSupported(filePath)) {
    return textFallback(oldSource, newSource);
  }

  try {
    const oldDecls = extractDeclarations(filePath, oldSource);
    const newDecls = extractDeclarations(filePath, newSource);
    return compareDeclarations(oldDecls, newDecls);
  } catch {
    // AST parsing failed — fall back to text diff
    return textFallback(oldSource, newSource);
  }
}

function extractDeclarations(filePath: string, source: string): Map<string, DeclInfo> {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const decls = new Map<string, DeclInfo>();

  for (const stmt of sf.statements) {
    const infos = extractDeclInfos(stmt, source);
    for (const info of infos) {
      decls.set(info.name, info);
    }
  }

  return decls;
}

function extractDeclInfos(node: ts.Statement, _source: string): DeclInfo[] {
  const exported = hasExportModifier(node);
  const fullText = node.getFullText().trim();
  const hasComments = /^\s*\/[/*]/.test(node.getFullText());

  if (ts.isFunctionDeclaration(node) && node.name) {
    return [{
      name: node.name.text,
      nodeType: "function",
      signature: getFunctionSignature(node),
      body: fullText,
      exported,
      hasComments,
    }];
  }

  if (ts.isClassDeclaration(node) && node.name) {
    return [{
      name: node.name.text,
      nodeType: "class",
      signature: getClassSignature(node),
      body: fullText,
      exported,
      hasComments,
    }];
  }

  if (ts.isInterfaceDeclaration(node)) {
    return [{
      name: node.name.text,
      nodeType: "interface",
      signature: normalizeWhitespace(node.getText()),
      body: fullText,
      exported,
      hasComments,
    }];
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return [{
      name: node.name.text,
      nodeType: "type",
      signature: normalizeWhitespace(node.getText()),
      body: fullText,
      exported,
      hasComments,
    }];
  }

  if (ts.isEnumDeclaration(node)) {
    return [{
      name: node.name.text,
      nodeType: "enum",
      signature: normalizeWhitespace(node.getText()),
      body: fullText,
      exported,
      hasComments,
    }];
  }

  if (ts.isVariableStatement(node)) {
    const results: DeclInfo[] = [];
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        const typeStr = decl.type ? `: ${decl.type.getText()}` : "";
        const isArrowFn = decl.initializer && ts.isArrowFunction(decl.initializer);
        results.push({
          name: decl.name.text,
          nodeType: isArrowFn ? "function" : "variable",
          signature: `${decl.name.text}${typeStr}`,
          body: fullText,
          exported,
          hasComments,
        });
      }
    }
    return results;
  }

  if (ts.isImportDeclaration(node)) {
    const importText = normalizeWhitespace(node.getText());
    return [{
      name: `import:${importText}`,
      nodeType: "import",
      signature: importText,
      body: fullText,
      exported: false,
      hasComments,
    }];
  }

  if (ts.isExportDeclaration(node)) {
    const exportText = normalizeWhitespace(node.getText());
    return [{
      name: `export:${exportText}`,
      nodeType: "export",
      signature: exportText,
      body: fullText,
      exported: true,
      hasComments,
    }];
  }

  return [];
}

function compareDeclarations(
  oldDecls: Map<string, DeclInfo>,
  newDecls: Map<string, DeclInfo>,
): SemanticDiffResult {
  const changes: SemanticChange[] = [];

  // Check removed declarations
  for (const [name, oldInfo] of oldDecls) {
    if (!newDecls.has(name)) {
      changes.push({
        kind: "removed",
        name,
        nodeType: oldInfo.nodeType,
        breaking: oldInfo.exported,
        detail: oldInfo.exported ? `exported ${oldInfo.nodeType} removed` : `${oldInfo.nodeType} removed`,
      });
    }
  }

  // Check added and modified declarations
  for (const [name, newInfo] of newDecls) {
    const oldInfo = oldDecls.get(name);

    if (!oldInfo) {
      changes.push({
        kind: "added",
        name,
        nodeType: newInfo.nodeType,
        breaking: false,
        detail: `new ${newInfo.nodeType}`,
      });
      continue;
    }

    // Same full text → no change
    if (normalizeWhitespace(oldInfo.body) === normalizeWhitespace(newInfo.body)) {
      continue;
    }

    // Check export modifier change
    if (oldInfo.exported !== newInfo.exported) {
      changes.push({
        kind: "export-change",
        name,
        nodeType: newInfo.nodeType,
        breaking: oldInfo.exported && !newInfo.exported, // removing export is breaking
        detail: newInfo.exported ? "export added" : "export removed",
      });
      continue;
    }

    // Check if only comments changed
    const oldNoComments = stripComments(oldInfo.body);
    const newNoComments = stripComments(newInfo.body);
    if (normalizeWhitespace(oldNoComments) === normalizeWhitespace(newNoComments)) {
      changes.push({
        kind: "comment-only",
        name,
        nodeType: oldInfo.nodeType,
        breaking: false,
        detail: "comments modified",
      });
      continue;
    }

    // Check if only whitespace changed
    if (oldNoComments.replace(/\s+/g, "") === newNoComments.replace(/\s+/g, "")) {
      changes.push({
        kind: "whitespace-only",
        name,
        nodeType: oldInfo.nodeType,
        breaking: false,
        detail: "formatting changed",
      });
      continue;
    }

    // Signature changed?
    if (oldInfo.signature !== newInfo.signature) {
      // Check if it's just a type annotation change
      const oldSigNoType = stripTypeAnnotations(oldInfo.signature);
      const newSigNoType = stripTypeAnnotations(newInfo.signature);
      if (oldSigNoType !== newSigNoType) {
        changes.push({
          kind: "signature-change",
          name,
          nodeType: oldInfo.nodeType,
          breaking: oldInfo.exported,
          detail: `${oldInfo.signature} → ${newInfo.signature}`,
        });
      } else {
        changes.push({
          kind: "type-change",
          name,
          nodeType: oldInfo.nodeType,
          breaking: oldInfo.exported,
          detail: "type annotation changed",
        });
      }
      continue;
    }

    // Signature same, body different → body-only change
    changes.push({
      kind: "body-change",
      name,
      nodeType: oldInfo.nodeType,
      breaking: false,
      detail: "implementation changed",
    });
  }

  const hasBreakingChanges = changes.some(c => c.breaking);
  const summary = buildSummary(changes);

  return { changes, hasBreakingChanges, summary };
}

function buildSummary(changes: SemanticChange[]): string {
  if (changes.length === 0) return "no semantic changes";

  const counts: Record<string, number> = {};
  for (const c of changes) {
    counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  }

  const parts: string[] = [];
  for (const [kind, count] of Object.entries(counts)) {
    parts.push(`${count} ${kind}`);
  }

  const breaking = changes.filter(c => c.breaking).length;
  if (breaking > 0) parts.push(`⚠️ ${breaking} breaking`);

  return parts.join(", ");
}

// ── Helpers ──

function hasExportModifier(node: ts.Statement): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function getFunctionSignature(node: ts.FunctionDeclaration): string {
  const name = node.name?.text ?? "anonymous";
  const params = node.parameters.map(p => {
    const pName = p.name.getText();
    const pType = p.type ? `: ${p.type.getText()}` : "";
    const optional = p.questionToken ? "?" : "";
    return `${pName}${optional}${pType}`;
  }).join(", ");
  const ret = node.type ? `: ${node.type.getText()}` : "";
  return `${name}(${params})${ret}`;
}

function getClassSignature(node: ts.ClassDeclaration): string {
  const name = node.name?.text ?? "anonymous";
  const heritage = node.heritageClauses?.map(h => h.getText()).join(" ") ?? "";
  const members: string[] = [];
  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)) {
      const mName = member.name?.getText() ?? "";
      if (ts.isMethodDeclaration(member)) {
        const params = member.parameters.map(p => p.getText()).join(", ");
        const ret = member.type ? `: ${member.type.getText()}` : "";
        members.push(`${mName}(${params})${ret}`);
      } else {
        const type = (member as ts.PropertyDeclaration).type?.getText() ?? "";
        members.push(`${mName}: ${type}`);
      }
    }
  }
  return `class ${name} ${heritage} { ${members.join("; ")} }`;
}

/** Strip type annotations from a signature, handling nested braces/parens/generics */
function stripTypeAnnotations(sig: string): string {
  let result = "";
  let depth = 0;
  let inType = false;
  for (let i = 0; i < sig.length; i++) {
    const ch = sig[i];
    if (ch === ":" && depth === 0 && !inType) {
      inType = true;
      continue;
    }
    if (inType) {
      if (ch === "<" || ch === "{" || ch === "(") depth++;
      else if (ch === ">" || ch === "}" || ch === ")") {
        if (depth > 0) { depth--; continue; }
        // depth === 0 and closing paren → end of type, keep the paren
        inType = false;
        result += ch;
      } else if (ch === "," && depth === 0) {
        inType = false;
        result += ch;
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();
}

/** Fallback for non-TS/JS files */
function textFallback(oldSource: string, newSource: string): SemanticDiffResult {
  const oldLines = oldSource.split("\n");
  const newLines = newSource.split("\n");
  let added = 0, removed = 0, changed = 0;
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) { added++; continue; }
    if (i >= newLines.length) { removed++; continue; }
    if (oldLines[i] !== newLines[i]) changed++;
  }

  const changes: SemanticChange[] = [];
  if (added > 0) changes.push({ kind: "added", name: `${added} lines`, nodeType: "text", breaking: false });
  if (removed > 0) changes.push({ kind: "removed", name: `${removed} lines`, nodeType: "text", breaking: false });
  if (changed > 0) changes.push({ kind: "body-change", name: `${changed} lines`, nodeType: "text", breaking: false });

  return {
    changes,
    hasBreakingChanges: false,
    summary: `text diff: +${added} -${removed} ~${changed} lines`,
  };
}
