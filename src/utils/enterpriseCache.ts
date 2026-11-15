export interface EnterpriseCacheStats {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  evictions: number;
  coalescedRequests: number;
}

export class EnterpriseLruTtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private coalescedRequests = 0;

  constructor(
    private readonly maxEntries = 2000,
    private readonly defaultTtlMs = 60_000
  ) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (now >= entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Refresh recency in O(1)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions += 1;
      }
    }
    this.store.set(key, {
      value,
      expiresAt: now + Math.max(100, ttlMs),
    });
  }

  async getOrCompute(
    key: string,
    loader: () => Promise<T>,
    ttlMs = this.defaultTtlMs
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const existingFlight = this.inFlight.get(key);
    if (existingFlight) {
      this.coalescedRequests += 1;
      return existingFlight;
    }
    const promise = loader()
      .then((val) => {
        this.set(key, val, ttlMs);
        return val;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
  }

  getStats(): EnterpriseCacheStats {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      coalescedRequests: this.coalescedRequests,
    };
  }
}
