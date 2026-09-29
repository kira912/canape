/**
 * Tiny in-memory cache for upstream API calls. Stores the in-flight promise so
 * concurrent requests for the same key hit the upstream only once; failures
 * are evicted so they are retried next time. Single-instance only — swap for
 * Redis if the API ever runs on several instances.
 */
export class TtlCache {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  constructor(private readonly maxEntries = 5_000) {}

  getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

    const value = load();
    this.entries.set(key, { expiresAt: now + ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    this.evictOverflow();
    return value;
  }

  private evictOverflow() {
    // Map iterates in insertion order → drops the oldest entries first.
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
