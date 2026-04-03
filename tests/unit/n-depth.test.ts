/**
 * N-Depth Reachability Tests
 *
 * Tests for Tree-sitter based import resolution and call graph tracing.
 * L2 = 1-depth cross-file, L3 = 2-depth cross-file.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

// Module under test
import { resolveImports } from "../../src/core/hologram/import-resolver";
import { traceCallGraph } from "../../src/core/hologram/call-graph";
import { generateHologram } from "../../src/core/hologram";

const FIXTURE_DIR = join(import.meta.dir, "__fixtures_ndepth__");

// ── Test fixtures ────────────────────────────────────────────────────────────

const TARGET_TS = `
import { greet } from "./utils";
import { formatDate } from "./helpers/date";

export function main() {
  const msg = greet("world");
  const d = formatDate(new Date());
  console.log(msg, d);
}
`;

const UTILS_TS = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function unused(): void {
  // This should NOT appear in N-Depth output
}
`;

const DATE_HELPER_TS = `
import { pad } from "./pad";

export function formatDate(d: Date): string {
  return \`\${d.getFullYear()}-\${pad(d.getMonth()+1)}-\${pad(d.getDate())}\`;
}
`;

const PAD_TS = `
export function pad(n: number): string {
  return n < 10 ? \`0\${n}\` : String(n);
}
`;

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(() => {
  mkdirSync(join(FIXTURE_DIR, "helpers"), { recursive: true });
  mkdirSync(join(FIXTURE_DIR, "components"), { recursive: true });
  writeFileSync(join(FIXTURE_DIR, "target.ts"), TARGET_TS);
  writeFileSync(join(FIXTURE_DIR, "utils.ts"), UTILS_TS);
  writeFileSync(join(FIXTURE_DIR, "helpers", "date.ts"), DATE_HELPER_TS);
  writeFileSync(join(FIXTURE_DIR, "helpers", "pad.ts"), PAD_TS);

  // Barrel file fixtures
  writeFileSync(join(FIXTURE_DIR, "components", "Button.ts"),
    `export function Button(props: { label: string }): string {\n  return props.label;\n}\n`);
  writeFileSync(join(FIXTURE_DIR, "components", "Input.ts"),
    `export function Input(props: { value: string }): string {\n  return props.value;\n}\n`);
  writeFileSync(join(FIXTURE_DIR, "components", "index.ts"),
    `export { Button } from './Button';\nexport * from './Input';\n`);
  writeFileSync(join(FIXTURE_DIR, "barrel-consumer.ts"),
    `import { Button, Input } from "./components";\n\nexport function render() {\n  Button({ label: "hi" });\n  Input({ value: "world" });\n}\n`);
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

// ── 1. Import Resolver ───────────────────────────────────────────────────────

describe("import-resolver", () => {
  test("resolves relative imports to absolute file paths", () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const imports = resolveImports(TARGET_TS, targetPath);

    // Should find 2 imports
    expect(imports.length).toBe(2);

    // Check resolved paths
    const paths = imports.map(i => i.resolvedPath);
    expect(paths).toContain(join(FIXTURE_DIR, "utils.ts"));
    expect(paths).toContain(join(FIXTURE_DIR, "helpers", "date.ts"));

    // Check imported symbols
    const utilsImport = imports.find(i => i.resolvedPath.includes("utils"));
    expect(utilsImport?.symbols).toContain("greet");

    const dateImport = imports.find(i => i.resolvedPath.includes("date"));
    expect(dateImport?.symbols).toContain("formatDate");
  });

  test("ignores node_modules and bare specifiers", () => {
    // Create a local file so it can resolve
    writeFileSync(join(FIXTURE_DIR, "local.ts"), "export const foo = 1;");

    const source = `
      import { readFileSync } from "fs";
      import express from "express";
      import { foo } from "./local";
    `;
    const imports = resolveImports(source, join(FIXTURE_DIR, "test.ts"));

    // Only ./local should resolve (fs and express are bare specifiers)
    expect(imports.length).toBe(1);
    expect(imports[0].specifier).toBe("./local");
  });

  test("handles namespace imports", () => {
    const source = `import * as utils from "./utils";`;
    const imports = resolveImports(source, join(FIXTURE_DIR, "test.ts"));

    expect(imports.length).toBe(1);
    expect(imports[0].symbols).toEqual(["*"]);
  });
});

// ── 2. Call Graph Tracing ────────────────────────────────────────────────────

describe("call-graph", () => {
  test("traces L2: extracts signatures of directly imported functions", async () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const result = await traceCallGraph(targetPath, TARGET_TS, { maxDepth: 2 });

    // Should have entries for greet and formatDate
    expect(result.length).toBeGreaterThanOrEqual(2);

    const signatures = result.map(r => r.signature);
    // greet from utils.ts
    expect(signatures.some(s => s.includes("greet") && s.includes("string"))).toBe(true);
    // formatDate from helpers/date.ts
    expect(signatures.some(s => s.includes("formatDate"))).toBe(true);

    // Should NOT include unused() from utils.ts
    expect(signatures.some(s => s.includes("unused"))).toBe(false);
  });

  test("traces L3: follows imports inside imported files", async () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const result = await traceCallGraph(targetPath, TARGET_TS, { maxDepth: 3 });

    const signatures = result.map(r => r.signature);

    // L2: greet, formatDate
    expect(signatures.some(s => s.includes("greet"))).toBe(true);
    expect(signatures.some(s => s.includes("formatDate"))).toBe(true);

    // L3: pad (imported by date.ts → used in formatDate)
    expect(signatures.some(s => s.includes("pad"))).toBe(true);
  });

  test("respects depth limit: L2 does NOT include L3 symbols", async () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const result = await traceCallGraph(targetPath, TARGET_TS, { maxDepth: 2 });

    const signatures = result.map(r => r.signature);
    // pad is L3 — should NOT appear with maxDepth=2
    expect(signatures.some(s => s.includes("pad"))).toBe(false);
  });

  test("avoids circular imports", async () => {
    // Create circular fixture
    const circDir = join(FIXTURE_DIR, "circ");
    mkdirSync(circDir, { recursive: true });
    writeFileSync(join(circDir, "a.ts"), `import { b } from "./b";\nexport function a(): string { return b(); }`);
    writeFileSync(join(circDir, "b.ts"), `import { a } from "./a";\nexport function b(): string { return a(); }`);

    const result = await traceCallGraph(
      join(circDir, "a.ts"),
      `import { b } from "./b";\nexport function a(): string { return b(); }`,
      { maxDepth: 3 }
    );

    // Should resolve without infinite loop
    expect(result.length).toBeGreaterThanOrEqual(1);
    // b should be found
    expect(result.some(r => r.signature.includes("b"))).toBe(true);
  });
});

// ── 3. Hologram Integration ──────────────────────────────────────────────────

describe("hologram n-depth integration", () => {
  test("generateHologram with nDepth option appends dependency section", async () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const result = await generateHologram(targetPath, TARGET_TS, { nDepth: 2 });

    expect(result.hologram).toContain("[🔗 N-Depth Dependencies]");
    expect(result.hologram).toContain("greet");
    expect(result.hologram).toContain("formatDate");
  });

  test("nDepth: 3 includes transitive dependencies", async () => {
    const targetPath = join(FIXTURE_DIR, "target.ts");
    const result = await generateHologram(targetPath, TARGET_TS, { nDepth: 3 });

    expect(result.hologram).toContain("[🔗 N-Depth Dependencies]");
    expect(result.hologram).toContain("pad");
  });
});

// ── 4. Barrel File Re-export Tracking ────────────────────────────────────────

describe("barrel file re-export", () => {
  test("resolveImports follows named re-export: export { X } from './X'", () => {
    const consumerPath = join(FIXTURE_DIR, "barrel-consumer.ts");
    const source = `import { Button } from "./components";`;
    const imports = resolveImports(source, consumerPath);

    expect(imports.length).toBe(1);
    // Should resolve through barrel to the actual Button.ts file
    expect(imports[0].resolvedPath).toBe(join(FIXTURE_DIR, "components", "Button.ts"));
    expect(imports[0].symbols).toContain("Button");
  });

  test("resolveImports follows wildcard re-export: export * from './X'", () => {
    const consumerPath = join(FIXTURE_DIR, "barrel-consumer.ts");
    const source = `import { Input } from "./components";`;
    const imports = resolveImports(source, consumerPath);

    expect(imports.length).toBe(1);
    // Should resolve through barrel's `export * from './Input'` to actual Input.ts
    expect(imports[0].resolvedPath).toBe(join(FIXTURE_DIR, "components", "Input.ts"));
    expect(imports[0].symbols).toContain("Input");
  });

  test("resolveImports handles multiple symbols from barrel", () => {
    const consumerPath = join(FIXTURE_DIR, "barrel-consumer.ts");
    const source = `import { Button, Input } from "./components";`;
    const imports = resolveImports(source, consumerPath);

    // Should resolve to TWO separate files (Button.ts and Input.ts)
    expect(imports.length).toBe(2);
    const paths = imports.map(i => i.resolvedPath);
    expect(paths).toContain(join(FIXTURE_DIR, "components", "Button.ts"));
    expect(paths).toContain(join(FIXTURE_DIR, "components", "Input.ts"));
  });

  test("N-Depth traces through barrel files", async () => {
    const consumerPath = join(FIXTURE_DIR, "barrel-consumer.ts");
    const source = `import { Button, Input } from "./components";\n\nexport function render() {\n  Button({ label: "hi" });\n  Input({ value: "world" });\n}\n`;
    const result = await traceCallGraph(consumerPath, source, { maxDepth: 2 });

    const signatures = result.map(r => r.signature);
    expect(signatures.some(s => s.includes("Button"))).toBe(true);
    expect(signatures.some(s => s.includes("Input"))).toBe(true);
  });
});
