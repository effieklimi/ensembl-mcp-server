import { describe, it, expect, vi } from "vitest";
import { ResponseCache } from "../../src/utils/cache.js";

describe("ResponseCache", () => {
  it("sets and gets a cache entry", () => {
    const cache = new ResponseCache();
    cache.set("test-key", { foo: "bar" }, "114");
    const result = cache.get<{ foo: string }>("test-key");
    expect(result).toEqual({ foo: "bar" });
  });

  it("returns null for missing key", () => {
    const cache = new ResponseCache();
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("expires entries after TTL", async () => {
    const cache = new ResponseCache();
    cache.set("expiring", "data", "114", 50);
    expect(cache.get("expiring")).toBe("data");

    await new Promise((r) => setTimeout(r, 80));
    expect(cache.get("expiring")).toBeNull();
  });

  it("evicts LRU entries when at capacity", () => {
    const cache = new ResponseCache(3);
    cache.set("a", 1, "114");
    cache.set("b", 2, "114");
    cache.set("c", 3, "114");

    // Access "a" to make it recently used
    cache.get("a");

    // Add "d" — should evict "b" (least recently used)
    cache.set("d", 4, "114");

    expect(cache.size).toBe(3);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("d")).toBe(4);
  });

  it("clears all entries", () => {
    const cache = new ResponseCache();
    cache.set("x", 1, "114");
    cache.set("y", 2, "114");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("x")).toBeNull();
  });

  it("produces deterministic keys with sorted params", () => {
    const cache = new ResponseCache();
    const key1 = cache.buildKey("114", "/lookup/id/ENSG00000141510", {
      expand: "Transcript",
      species: "homo_sapiens",
    });
    const key2 = cache.buildKey("114", "/lookup/id/ENSG00000141510", {
      species: "homo_sapiens",
      expand: "Transcript",
    });
    expect(key1).toBe(key2);
  });

  it("includes release version in key", () => {
    const cache = new ResponseCache();
    const key = cache.buildKey("114", "/info/species");
    expect(key).toMatch(/^114:/);
  });

  it("filters empty/null param values in key", () => {
    const cache = new ResponseCache();
    const key1 = cache.buildKey("114", "/lookup/id/BRCA1", {
      expand: "Transcript",
      biotype: "",
    });
    const key2 = cache.buildKey("114", "/lookup/id/BRCA1", {
      expand: "Transcript",
    });
    expect(key1).toBe(key2);
  });

  it("returns correct tier TTLs", () => {
    const cache = new ResponseCache();
    const hour = 60 * 60 * 1000;

    expect(cache.getTtlForEndpoint("/info/species")).toBe(24 * hour);
    expect(cache.getTtlForEndpoint("/lookup/id/ENSG00000141510")).toBe(6 * hour);
    expect(cache.getTtlForEndpoint("/vep/homo_sapiens/id/rs699")).toBe(1 * hour);
    expect(cache.getTtlForEndpoint("/ontology/id/GO:0008150")).toBe(24 * hour);
  });

  it("returns default TTL for unknown endpoints", () => {
    const cache = new ResponseCache();
    expect(cache.getTtlForEndpoint("/unknown/endpoint")).toBe(1 * 60 * 60 * 1000);
  });

  it("tracks hits and misses in stats", () => {
    const cache = new ResponseCache();
    cache.set("k", "v", "114");
    cache.get("k"); // hit
    cache.get("k"); // hit
    cache.get("missing"); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe("66.7%");
  });

  it("reports N/A hit rate when empty", () => {
    const cache = new ResponseCache();
    expect(cache.getStats().hitRate).toBe("N/A");
  });

  it("does not increase size on overwrite", () => {
    const cache = new ResponseCache();
    cache.set("k", "v1", "114");
    cache.set("k", "v2", "114");
    expect(cache.size).toBe(1);
    expect(cache.get("k")).toBe("v2");
  });
});
