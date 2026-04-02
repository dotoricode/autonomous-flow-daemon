import type { Node, Tree } from "web-tree-sitter";
import type { LanguageExtractor, HologramOptions } from "./types";

/** Stub a Python function/method body — keep signature + "..." */
function stubPythonBody(node: Node, source: string): string {
  const body = node.childForFieldName("body");
  if (!body) return node.text;
  return source.slice(node.startIndex, body.startIndex).trimEnd() + " ...";
}

/** Extract a Python function definition */
function extractFunction(node: Node, source: string): string {
  // Decorators
  const decorators = collectDecorators(node, source);
  const sig = stubPythonBody(node, source);
  return decorators + sig;
}

/** Extract a Python class with method signatures */
function extractClass(node: Node, source: string): string {
  const decorators = collectDecorators(node, source);
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "?";
  const superclasses = node.childForFieldName("superclasses");
  const sup = superclasses ? superclasses.text : "";
  const body = node.childForFieldName("body");

  const header = `class ${name}${sup ? `(${sup.replace(/^\(|\)$/g, "")})` : ""}:`;

  if (!body) return decorators + header;

  const members: string[] = [];
  for (const child of body.namedChildren) {
    switch (child.type) {
      case "function_definition": {
        const memberDecorators = collectDecorators(child, source);
        members.push(indent(memberDecorators + stubPythonBody(child, source)));
        break;
      }
      case "expression_statement": {
        // Type-annotated assignments: x: int = 42
        const expr = child.namedChildren[0];
        if (expr?.type === "assignment" || expr?.type === "type") {
          members.push(indent(child.text.split("\n")[0]));
        }
        break;
      }
      case "class_definition": {
        // Nested class — just show header
        const nestedName = child.childForFieldName("name")?.text ?? "?";
        members.push(indent(`class ${nestedName}: ...`));
        break;
      }
    }
  }

  if (members.length === 0) {
    return decorators + header + "\n    ...";
  }

  return decorators + header + "\n" + members.join("\n");
}

/** Collect decorator lines above a node */
function collectDecorators(node: Node, source: string): string {
  const decorators: string[] = [];
  // In tree-sitter-python, decorators are children of the decorated_definition
  // or are 'decorator' type children of the function/class
  const parent = node.parent;
  if (parent?.type === "decorated_definition") {
    for (const child of parent.namedChildren) {
      if (child.type === "decorator") {
        decorators.push(child.text);
      }
    }
  }
  return decorators.length > 0 ? decorators.join("\n") + "\n" : "";
}

function indent(s: string): string {
  return s.split("\n").map(line => "    " + line).join("\n");
}

/** Process a single top-level statement */
function extractTopLevel(node: Node, source: string): string | null {
  switch (node.type) {
    case "import_statement":
    case "import_from_statement":
      return node.text;
    case "function_definition":
      return extractFunction(node, source);
    case "class_definition":
      return extractClass(node, source);
    case "decorated_definition": {
      // Unwrap to get the inner function/class
      const inner = node.namedChildren.find(c =>
        c.type === "function_definition" || c.type === "class_definition");
      if (inner) return extractTopLevel(inner, source);
      return null;
    }
    case "expression_statement": {
      // Module-level type annotations or assignments
      const expr = node.namedChildren[0];
      if (expr?.type === "assignment" || expr?.type === "type") {
        return node.text.split("\n")[0];
      }
      // __all__ = [...]
      if (node.text.startsWith("__all__")) {
        return node.text;
      }
      return null;
    }
    default:
      return null;
  }
}

export const pyExtractor: LanguageExtractor = {
  extensions: ["py", "pyi"],
  grammarName: "python",

  extract(tree: Tree, source: string, _options?: HologramOptions): string[] {
    const lines: string[] = [];

    for (const stmt of tree.rootNode.namedChildren) {
      const line = extractTopLevel(stmt, source);
      if (line) lines.push(line);
    }

    return lines;
  },
};
