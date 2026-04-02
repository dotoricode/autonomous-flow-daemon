/**
 * EventBatcher — Adaptive debounce for file watcher events.
 *
 * Strategy:
 * - Immune file changes → fast-path (immediate, no debounce)
 * - All other events → 300ms debounce batch
 * - Deduplicates: same file multiple events → last event wins
 * - Cancels out: add + unlink on same file → removed from batch
 */

export interface BatchedEvent {
  event: string;
  path: string;
  timestamp: number;
}

export interface EventBatcherOptions {
  /** Debounce window in ms (default: 300) */
  debounceMs?: number;
  /** Check if a path is an immune-protected file (fast-path) */
  isImmunePath?: (path: string) => boolean;
  /** Handler for fast-path (immediate) events */
  onImmediate: (event: string, path: string) => void;
  /** Handler for batched events (fired after debounce window) */
  onBatch: (events: BatchedEvent[]) => void;
}

export class EventBatcher {
  private readonly debounceMs: number;
  private readonly isImmunePath: (path: string) => boolean;
  private readonly onImmediate: (event: string, path: string) => void;
  private readonly onBatch: (events: BatchedEvent[]) => void;

  private pendingEvents = new Map<string, BatchedEvent>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private batchCount = 0;

  constructor(options: EventBatcherOptions) {
    this.debounceMs = options.debounceMs ?? 300;
    this.isImmunePath = options.isImmunePath ?? (() => false);
    this.onImmediate = options.onImmediate;
    this.onBatch = options.onBatch;
  }

  /** Push a new file event. Returns true if handled immediately (fast-path). */
  push(event: string, path: string): boolean {
    // Fast-path: immune file change → immediate processing for auto-heal responsiveness
    if (event === "change" && this.isImmunePath(path)) {
      this.onImmediate(event, path);
      return true;
    }

    const now = Date.now();
    const existing = this.pendingEvents.get(path);

    // Cancel out: add + unlink on same file
    if (existing) {
      if ((existing.event === "add" && event === "unlink") ||
          (existing.event === "unlink" && event === "add")) {
        this.pendingEvents.delete(path);
        return false;
      }
    }

    // Last event wins for same file
    this.pendingEvents.set(path, { event, path, timestamp: now });

    // Start/reset debounce timer
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);

    return false;
  }

  /** Flush all pending events immediately */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingEvents.size === 0) return;

    const events = [...this.pendingEvents.values()];
    this.pendingEvents.clear();
    this.batchCount++;
    this.onBatch(events);
  }

  /** Get the number of batches processed */
  get totalBatches(): number {
    return this.batchCount;
  }

  /** Get the number of pending events */
  get pendingCount(): number {
    return this.pendingEvents.size;
  }

  /** Destroy the batcher, clearing any pending timers */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingEvents.clear();
  }
}
