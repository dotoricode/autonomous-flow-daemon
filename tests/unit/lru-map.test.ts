import { describe, test, expect } from "bun:test";
import { LruStringMap } from "../../src/core/lru-map";

describe("LruStringMap", () => {
  test("basic get/set", () => {
    const m = new LruStringMap(1024);
    m.set("a", "hello");
    expect(m.get("a")).toBe("hello");
    expect(m.size).toBe(1);
  });

  test("returns undefined for missing key", () => {
    const m = new LruStringMap(1024);
    expect(m.get("x")).toBeUndefined();
  });

  test("delete removes entry", () => {
    const m = new LruStringMap(1024);
    m.set("a", "val");
    expect(m.delete("a")).toBe(true);
    expect(m.get("a")).toBeUndefined();
    expect(m.size).toBe(0);
  });

  test("delete non-existent returns false", () => {
    const m = new LruStringMap(1024);
    expect(m.delete("x")).toBe(false);
  });

  test("evicts oldest when exceeding maxBytes", () => {
    // 20 bytes max → 10 chars (2 bytes each)
    const m = new LruStringMap(20);
    m.set("a", "12345"); // 10 bytes
    m.set("b", "67890"); // 10 bytes → total 20, fits
    expect(m.size).toBe(2);

    m.set("c", "xxxxx"); // 10 bytes → must evict "a" (oldest)
    expect(m.size).toBe(2);
    expect(m.get("a")).toBeUndefined();
    expect(m.get("b")).toBe("67890");
    expect(m.get("c")).toBe("xxxxx");
  });

  test("get promotes entry to most-recently-used", () => {
    const m = new LruStringMap(20);
    m.set("a", "12345"); // 10 bytes
    m.set("b", "67890"); // 10 bytes

    // Access "a" → now "b" is oldest
    m.get("a");

    m.set("c", "xxxxx"); // evicts "b" (oldest)
    expect(m.get("a")).toBe("12345");
    expect(m.get("b")).toBeUndefined();
    expect(m.get("c")).toBe("xxxxx");
  });

  test("update replaces value and adjusts bytes", () => {
    const m = new LruStringMap(100);
    m.set("a", "short");
    const bytesBefore = m.bytes;
    m.set("a", "a much longer string here");
    expect(m.bytes).toBeGreaterThan(bytesBefore);
    expect(m.get("a")).toBe("a much longer string here");
    expect(m.size).toBe(1);
  });

  test("skips value that exceeds entire budget", () => {
    const m = new LruStringMap(10);
    m.set("a", "this is way too long for the budget");
    expect(m.size).toBe(0);
    expect(m.get("a")).toBeUndefined();
  });

  test("bytes tracks total correctly", () => {
    const m = new LruStringMap(1000);
    m.set("a", "abc"); // 6 bytes
    m.set("b", "de");  // 4 bytes
    expect(m.bytes).toBe(10);
    m.delete("a");
    expect(m.bytes).toBe(4);
  });
});
