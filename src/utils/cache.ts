import { logger } from "./logger.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  releaseVersion: string;
}

/** TTL tiers in milliseconds, keyed by endpoint prefix pattern */
const TTL_TIERS: { pattern: RegExp; ttl: number }[] = [
  // Meta/species/assembly: 24 hours (changes only on release)
  { pattern: /^\/info\//, ttl: 24 * 60 * 60 * 1000 },
  { pattern: /^\/archive\//, ttl: 24 * 60 * 60 * 1000 },

  // Ontology/taxonomy: 24 hours (very stable)
  { pattern: /^\/ontology\//, ttl: 24 * 60 * 60 * 1000 },
  { pattern: /^\/taxonomy\//, ttl: 24 * 60 * 60 * 1000 },

  // Gene/transcript lookups: 6 hours (stable within release)
  { pattern: /^\/lookup\//, ttl: 6 * 60 * 60 * 1000 },
  { pattern: /^\/xrefs\//, ttl: 6 * 60 * 60 * 1000 },

  // Sequence data: 6 hours (immutable for a given ID)
  { pattern: /^\/sequence\//, ttl: 6 * 60 * 60 * 1000 },

  // Overlap/features: 6 hours
  { pattern: /^\/overlap\//, ttl: 6 * 60 * 60 * 1000 },

  // Comparative genomics: 6 hours
  { pattern: /^\/homology\//, ttl: 6 * 60 * 60 * 1000 },
  { pattern: /^\/genetree\//, ttl: 6 * 60 * 60 * 1000 },
  { pattern: /^\/cafe\//, ttl: 6 * 60 * 60 * 1000 },
  { pattern: /^\/alignment\//, ttl: 6 * 60 * 60 * 1000 },

  // Coordinate mapping: 6 hours
  { pattern: /^\/map\//, ttl: 6 * 60 * 60 * 1000 },

  // Variation/VEP: 1 hour (phenotype annotations update more often)
  { pattern: /^\/variation\//, ttl: 1 * 60 * 60 * 1000 },
  { pattern: /^\/vep\//, ttl: 1 * 60 * 60 * 1000 },
  { pattern: /^\/ld\//, ttl: 1 * 60 * 60 * 1000 },
  { pattern: /^\/phenotype\//, ttl: 1 * 60 * 60 * 1000 },
  { pattern: /^\/variant_recoder\//, ttl: 1 * 60 * 60 * 1000 },
  { pattern: /^\/transcript_haplotypes\//, ttl: 1 * 60 * 60 * 1000 },
];

/** Default TTL: 1 hour */
const DEFAULT_TTL = 1 * 60 * 60 * 1000;

export class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private accessOrder: string[] = [];
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Build a deterministic cache key from endpoint + sorted params.
   * Prefixed with the Ensembl release version for auto-invalidation.
   */
  buildKey(
    releaseVersion: string,
    endpoint: string,
    params?: Record<string, string>
  ): string {
    let paramString = "";
    if (params) {
      const sorted = Object.entries(params)
        .filter(([, v]) => v != null && v !== "")
        .sort(([a], [b]) => a.localeCompare(b));
      if (sorted.length > 0) {
        paramString = "?" + sorted.map(([k, v]) => `${k}=${v}`).join("&");
      }
    }
    return `${releaseVersion}:${endpoint}${paramString}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      logger.debug("cache_miss", { key });
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      logger.debug("cache_expired", { key, age_ms: age, ttl_ms: entry.ttl });
      return null;
    }

    // Move to end of access order (most recently used)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    this.hits++;
    logger.debug("cache_hit", { key });
    return entry.data as T;
  }

  set<T>(key: string, data: T, releaseVersion: string, ttl?: number): void {
    // Evict if at capacity and this is a new entry
    if (!this.cache.has(key) && this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? DEFAULT_TTL,
      releaseVersion,
    });

    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /** Resolve the TTL for an endpoint based on the tier patterns. */
  getTtlForEndpoint(endpoint: string): number {
    for (const tier of TTL_TIERS) {
      if (tier.pattern.test(endpoint)) {
        return tier.ttl;
      }
    }
    return DEFAULT_TTL;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    logger.info("cache_cleared");
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? "N/A" : `${((this.hits / total) * 100).toFixed(1)}%`,
    };
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    const oldest = this.accessOrder.shift()!;
    this.cache.delete(oldest);
    logger.debug("cache_evict", { key: oldest });
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }
}
