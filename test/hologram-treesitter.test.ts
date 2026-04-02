import { describe, test, expect } from "bun:test";
import { generateHologram } from "../src/core/hologram";

describe("Tree-sitter Hologram Engine", () => {
  // ── TypeScript ──

  test("TS: function body is stubbed", async () => {
    const source = `export function foo(x: number): string {
  return x.toString();
}`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain("function foo");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("return x.toString()");
    expect(result.savings).toBeGreaterThan(0);
    expect(result.language).toBe("typescript");
  });

  test("TS: interface preserved fully", async () => {
    const source = `export interface Config {
  name: string;
  port: number;
  debug?: boolean;
}`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain("interface Config");
    expect(result.hologram).toContain("name: string");
    expect(result.hologram).toContain("port: number");
    expect(result.hologram).toContain("debug?: boolean");
  });

  test("TS: class methods become signatures only", async () => {
    const source = `export class MyService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getUser(id: string): Promise<User> {
    const row = await this.db.query("SELECT * FROM users WHERE id = ?", [id]);
    return row as User;
  }
}`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain("class MyService");
    expect(result.hologram).not.toContain("SELECT * FROM users");
  });

  test("TS: import statements preserved", async () => {
    const source = `import { readFileSync } from "fs";
import { resolve } from "path";

export function loadConfig(path: string): string {
  return readFileSync(resolve(path), "utf-8");
}`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain('import { readFileSync } from "fs"');
    expect(result.hologram).toContain('import { resolve } from "path"');
  });

  test("TS: enum preserved", async () => {
    const source = `export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain("enum Status");
  });

  test("TS: arrow function body stubbed", async () => {
    const source = `export const greet = (name: string): string => {
  return \`Hello \${name}\`;
};`;
    const result = await generateHologram("test.ts", source);
    expect(result.hologram).toContain("greet");
    expect(result.hologram).not.toContain("Hello");
  });

  // ── Python ──

  test("PY: function body is stubbed", async () => {
    const source = `def greet(name: str) -> str:
    return f"Hello {name}"
`;
    const result = await generateHologram("test.py", source);
    expect(result.hologram).toContain("def greet(name: str) -> str:");
    expect(result.hologram).toContain("...");
    expect(result.hologram).not.toContain("Hello");
    expect(result.savings).toBeGreaterThan(0);
    expect(result.language).toBe("python");
  });

  test("PY: class with methods shows signatures only", async () => {
    const source = `class UserService:
    def __init__(self, db):
        self.db = db
        self.cache = {}

    def get_user(self, user_id: int) -> dict:
        result = self.db.query("SELECT * FROM users WHERE id = ?", (user_id,))
        return dict(result)

    def delete_user(self, user_id: int) -> bool:
        self.db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return True
`;
    const result = await generateHologram("test.py", source);
    expect(result.hologram).toContain("class UserService:");
    expect(result.hologram).toContain("def __init__(self, db):");
    expect(result.hologram).toContain("def get_user(self, user_id: int) -> dict:");
    expect(result.hologram).not.toContain("SELECT * FROM users");
  });

  test("PY: import statements preserved", async () => {
    const source = `import os
from pathlib import Path
from typing import Optional

def process(path: str) -> Optional[str]:
    return Path(path).read_text()
`;
    const result = await generateHologram("test.py", source);
    expect(result.hologram).toContain("import os");
    expect(result.hologram).toContain("from pathlib import Path");
    expect(result.hologram).toContain("from typing import Optional");
  });

  // ── Graceful Degradation ──

  test("Unknown extension returns L0 (full source)", async () => {
    const source = `fn main() { println!("hello"); }`;
    const result = await generateHologram("test.rs", source);
    expect(result.hologram).toBe(source);
    expect(result.savings).toBe(0);
    expect(result.language).toBeUndefined();
  });

  test("Empty source returns empty hologram", async () => {
    const result = await generateHologram("test.ts", "");
    expect(result.hologram).toBe("");
    expect(result.savings).toBe(0);
  });

  // ── MCP Backward Compatibility ──

  test("HologramResult has all required fields", async () => {
    const source = `export const x = 42;`;
    const result = await generateHologram("test.ts", source);
    expect(result).toHaveProperty("hologram");
    expect(result).toHaveProperty("originalLength");
    expect(result).toHaveProperty("hologramLength");
    expect(result).toHaveProperty("savings");
    expect(typeof result.hologram).toBe("string");
    expect(typeof result.originalLength).toBe("number");
    expect(typeof result.hologramLength).toBe("number");
    expect(typeof result.savings).toBe("number");
  });

  // ── Performance ──

  test("Cached parse completes under 50ms", async () => {
    const source = `export function a(): void { console.log("warm up"); }\n`.repeat(100);
    // Warm up
    await generateHologram("warmup.ts", source);

    const start = performance.now();
    await generateHologram("perf.ts", source);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
