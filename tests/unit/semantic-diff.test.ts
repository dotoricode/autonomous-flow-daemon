import { describe, expect, test } from "bun:test";
import { semanticDiff, isAstSupported } from "../../src/core/semantic-diff";

describe("isAstSupported", () => {
  test("supports .ts, .tsx, .js, .jsx", () => {
    expect(isAstSupported("foo.ts")).toBe(true);
    expect(isAstSupported("bar.tsx")).toBe(true);
    expect(isAstSupported("baz.js")).toBe(true);
    expect(isAstSupported("qux.jsx")).toBe(true);
    expect(isAstSupported("mod.mts")).toBe(true);
  });

  test("does not support non-JS files", () => {
    expect(isAstSupported("readme.md")).toBe(false);
    expect(isAstSupported("config.json")).toBe(false);
    expect(isAstSupported("style.css")).toBe(false);
  });
});

describe("semanticDiff", () => {
  test("detects added function", () => {
    const oldSrc = `export function foo(): void {}`;
    const newSrc = `export function foo(): void {}\nexport function bar(): string { return ""; }`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "added" && c.name === "bar")).toBe(true);
    expect(result.hasBreakingChanges).toBe(false);
  });

  test("detects removed exported function (breaking)", () => {
    const oldSrc = `export function foo(): void {}\nexport function bar(): string { return ""; }`;
    const newSrc = `export function foo(): void {}`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "removed" && c.name === "bar")).toBe(true);
    expect(result.hasBreakingChanges).toBe(true);
  });

  test("detects signature change (breaking)", () => {
    const oldSrc = `export function greet(name: string): string { return name; }`;
    const newSrc = `export function greet(name: string, age: number): string { return name; }`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "signature-change" && c.breaking)).toBe(true);
  });

  test("detects body-only change (non-breaking)", () => {
    const oldSrc = `export function calc(x: number): number { return x + 1; }`;
    const newSrc = `export function calc(x: number): number { return x * 2; }`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "body-change")).toBe(true);
    expect(result.hasBreakingChanges).toBe(false);
  });

  test("detects comment-only change", () => {
    const oldSrc = `// old comment\nexport function foo(): void {}`;
    const newSrc = `// new comment\nexport function foo(): void {}`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "comment-only")).toBe(true);
    expect(result.hasBreakingChanges).toBe(false);
  });

  test("detects interface change", () => {
    const oldSrc = `export interface User { id: string; }`;
    const newSrc = `export interface User { id: string; name: string; }`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  test("falls back to text diff for non-TS files", () => {
    const oldSrc = "line1\nline2";
    const newSrc = "line1\nline3\nline4";
    const result = semanticDiff("config.json", oldSrc, newSrc);
    expect(result.summary).toContain("text diff");
  });

  test("no changes returns empty", () => {
    const src = `export function foo(): void {}`;
    const result = semanticDiff("test.ts", src, src);
    expect(result.changes).toHaveLength(0);
    expect(result.summary).toBe("no semantic changes");
  });

  test("detects export modifier removal (breaking)", () => {
    const oldSrc = `export function secret(): void {}`;
    const newSrc = `function secret(): void {}`;
    const result = semanticDiff("test.ts", oldSrc, newSrc);
    expect(result.changes.some(c => c.kind === "export-change" && c.breaking)).toBe(true);
  });
});
