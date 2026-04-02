import { describe, test, expect } from "bun:test";
import { EventBatcher } from "../src/daemon/event-batcher";

describe("EventBatcher", () => {
  test("immune file change triggers immediate handler", () => {
    let immediateCalls = 0;
    let batchCalls = 0;
    const batcher = new EventBatcher({
      debounceMs: 300,
      isImmunePath: (p) => p === ".claudeignore",
      onImmediate: () => { immediateCalls++; },
      onBatch: () => { batchCalls++; },
    });

    const handled = batcher.push("change", ".claudeignore");
    expect(handled).toBe(true);
    expect(immediateCalls).toBe(1);
    expect(batchCalls).toBe(0);
    batcher.destroy();
  });

  test("non-immune events are batched", async () => {
    let batchCalls = 0;
    let batchedEvents: unknown[] = [];
    const batcher = new EventBatcher({
      debounceMs: 50, // short for test
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: (events) => { batchCalls++; batchedEvents = events; },
    });

    // Push 10 events at 5ms intervals
    for (let i = 0; i < 10; i++) {
      batcher.push("change", `src/file${i}.ts`);
    }

    // Wait for debounce
    await new Promise(r => setTimeout(r, 100));

    expect(batchCalls).toBe(1);
    expect(batchedEvents.length).toBe(10);
    batcher.destroy();
  });

  test("same file multiple events → last event wins", async () => {
    let batchedEvents: Array<{ event: string; path: string }> = [];
    const batcher = new EventBatcher({
      debounceMs: 50,
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: (events) => { batchedEvents = events; },
    });

    batcher.push("add", "src/foo.ts");
    batcher.push("change", "src/foo.ts");
    batcher.push("change", "src/foo.ts");

    await new Promise(r => setTimeout(r, 100));

    expect(batchedEvents.length).toBe(1);
    expect(batchedEvents[0].event).toBe("change");
    batcher.destroy();
  });

  test("add + unlink on same file cancel out", async () => {
    let batchedEvents: Array<{ event: string; path: string }> = [];
    let batchCalls = 0;
    const batcher = new EventBatcher({
      debounceMs: 50,
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: (events) => { batchCalls++; batchedEvents = events; },
    });

    batcher.push("add", "src/temp.ts");
    batcher.push("unlink", "src/temp.ts");

    await new Promise(r => setTimeout(r, 100));

    // Both cancelled out — no batch should fire (empty)
    expect(batchedEvents.length).toBe(0);
    batcher.destroy();
  });

  test("10 files at 10ms intervals → 1 batch", async () => {
    let batchCalls = 0;
    const batcher = new EventBatcher({
      debounceMs: 100,
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: () => { batchCalls++; },
    });

    // Simulate 10 files at 10ms intervals
    for (let i = 0; i < 10; i++) {
      setTimeout(() => batcher.push("change", `src/file${i}.ts`), i * 10);
    }

    // Wait for all events + debounce window
    await new Promise(r => setTimeout(r, 300));

    expect(batchCalls).toBe(1);
    expect(batcher.totalBatches).toBe(1);
    batcher.destroy();
  });

  test("flush() processes pending events immediately", () => {
    let batchedEvents: Array<{ event: string; path: string }> = [];
    const batcher = new EventBatcher({
      debounceMs: 5000, // long debounce
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: (events) => { batchedEvents = events; },
    });

    batcher.push("change", "src/a.ts");
    batcher.push("change", "src/b.ts");
    expect(batcher.pendingCount).toBe(2);

    batcher.flush();
    expect(batchedEvents.length).toBe(2);
    expect(batcher.pendingCount).toBe(0);
    batcher.destroy();
  });

  test("destroy clears pending timers and events", () => {
    const batcher = new EventBatcher({
      debounceMs: 5000,
      isImmunePath: () => false,
      onImmediate: () => {},
      onBatch: () => {},
    });

    batcher.push("change", "src/a.ts");
    expect(batcher.pendingCount).toBe(1);

    batcher.destroy();
    expect(batcher.pendingCount).toBe(0);
  });
});
