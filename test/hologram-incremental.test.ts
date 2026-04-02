import { describe, test, expect, beforeEach } from "bun:test";
import { generateHologram, clearHologramCache } from "../src/core/hologram";

describe("Incremental Hologram (diff-only)", () => {
  beforeEach(() => {
    clearHologramCache();
  });

  test("first call with diffOnly returns full hologram (no cache)", async () => {
    const source = `export function foo(x: number): string { return x.toString(); }`;
    const result = await generateHologram("incr-test.ts", source, { diffOnly: true });
    expect(result.isDiff).toBe(false);
    expect(result.hologram).toContain("function foo");
  });

  test("second call with same source returns no-changes diff", async () => {
    const source = `export function foo(x: number): string { return x.toString(); }`;

    // First call — populates cache
    await generateHologram("incr-same.ts", source, { diffOnly: true });

    // Second call — same source
    const result = await generateHologram("incr-same.ts", source, { diffOnly: true });
    expect(result.isDiff).toBe(true);
    expect(result.changedNodes).toBe(0);
    expect(result.hologram).toContain("no changes");
  });

  test("modified function shows diff with +/- markers", async () => {
    const sourceV1 = `export function greet(name: string): string { return "Hello " + name; }`;
    const sourceV2 = `export function greet(name: string, greeting?: string): string { return (greeting ?? "Hello") + " " + name; }`;

    await generateHologram("incr-diff.ts", sourceV1, { diffOnly: true });
    const result = await generateHologram("incr-diff.ts", sourceV2, { diffOnly: true });

    expect(result.isDiff).toBe(true);
    expect(result.changedNodes).toBeGreaterThan(0);
    expect(result.hologram).toContain("-");
    expect(result.hologram).toContain("+");
  });

  test("added function shows in diff", async () => {
    const sourceV1 = `export function foo(): void { }`;
    const sourceV2 = `export function foo(): void { }\nexport function bar(): number { return 42; }`;

    await generateHologram("incr-add.ts", sourceV1, { diffOnly: true });
    const result = await generateHologram("incr-add.ts", sourceV2, { diffOnly: true });

    expect(result.isDiff).toBe(true);
    expect(result.hologram).toContain("+");
    expect(result.hologram).toContain("bar");
  });

  test("removed function shows in diff", async () => {
    const sourceV1 = `export function foo(): void { }\nexport function bar(): number { return 42; }`;
    const sourceV2 = `export function foo(): void { }`;

    await generateHologram("incr-rm.ts", sourceV1, { diffOnly: true });
    const result = await generateHologram("incr-rm.ts", sourceV2, { diffOnly: true });

    expect(result.isDiff).toBe(true);
    expect(result.hologram).toContain("-");
    expect(result.hologram).toContain("bar");
  });

  test("normal mode still works (no diffOnly)", async () => {
    const source = `export function foo(): void { console.log("hi"); }`;
    const result = await generateHologram("incr-normal.ts", source);
    expect(result.isDiff).toBeUndefined();
    expect(result.hologram).toContain("foo");
    expect(result.hologram).toContain("{…}");
  });

  test("Python incremental diff works", async () => {
    const v1 = `def greet(name: str) -> str:\n    return f"Hello {name}"\n`;
    const v2 = `def greet(name: str, lang: str = "en") -> str:\n    return f"Hello {name}"\n`;

    await generateHologram("incr.py", v1, { diffOnly: true });
    const result = await generateHologram("incr.py", v2, { diffOnly: true });

    expect(result.isDiff).toBe(true);
    expect(result.language).toBe("python");
  });

  test("unknown extension with diffOnly returns L0", async () => {
    const source = `fn main() {}`;
    const result = await generateHologram("incr.rs", source, { diffOnly: true });
    expect(result.hologram).toBe(source);
    expect(result.savings).toBe(0);
  });

  test("HologramResult backward compatibility maintained", async () => {
    const source = `export const x = 42;`;
    const result = await generateHologram("compat.ts", source, { diffOnly: true });
    expect(result).toHaveProperty("hologram");
    expect(result).toHaveProperty("originalLength");
    expect(result).toHaveProperty("hologramLength");
    expect(result).toHaveProperty("savings");
  });

  test("incremental hologram performance < 50ms (cached)", async () => {
    const source = `export function a(): void { }\n`.repeat(50);
    await generateHologram("perf-incr.ts", source, { diffOnly: true });

    const modified = source + `export function b(): void { }\n`;
    const start = performance.now();
    await generateHologram("perf-incr.ts", modified, { diffOnly: true });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
