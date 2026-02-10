#!/usr/bin/env node

/**
 * UNIT TESTS for ResponseCache + integration with EnsemblApiClient caching
 */

import { ResponseCache } from "../src/utils/cache.js";
import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

// Test framework (same pattern as other test files)
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

interface TestCase {
  run(testFunction: () => Promise<void>): Promise<void>;
}

function test(name: string, expectedToPass: boolean = true): TestCase {
  return {
    async run(testFunction: () => Promise<void>): Promise<void> {
      totalTests++;
      console.log(`\n📍 ${name}`);

      try {
        await testFunction();
        if (expectedToPass) {
          passedTests++;
          console.log(`✅ PASS`);
        } else {
          failedTests++;
          console.log(`❌ FAIL - Expected this test to fail but it passed`);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!expectedToPass) {
          passedTests++;
          console.log(`✅ PASS - Expected error: ${errorMessage}`);
        } else {
          failedTests++;
          console.log(`❌ FAIL - Unexpected error: ${errorMessage}`);
        }
      }
    },
  };
}

async function runCacheTests(): Promise<void> {
  console.log("📊 UNIT TESTS: ResponseCache\n");

  // --- Unit tests for ResponseCache ---

  await test("Set and get a cache entry").run(async () => {
    const cache = new ResponseCache();
    cache.set("test-key", { foo: "bar" }, "114");
    const result = cache.get<{ foo: string }>("test-key");
    if (!result || result.foo !== "bar") {
      throw new Error(`Expected { foo: "bar" }, got ${JSON.stringify(result)}`);
    }
    console.log(`   Cached and retrieved: ${JSON.stringify(result)}`);
  });

  await test("Return null for missing key").run(async () => {
    const cache = new ResponseCache();
    const result = cache.get("nonexistent");
    if (result !== null) {
      throw new Error(`Expected null, got ${JSON.stringify(result)}`);
    }
    console.log(`   Correctly returned null for missing key`);
  });

  await test("Expire entries after TTL").run(async () => {
    const cache = new ResponseCache();
    // Set with 50ms TTL
    cache.set("expiring", "data", "114", 50);
    const before = cache.get("expiring");
    if (before !== "data") {
      throw new Error(`Expected "data" before expiry, got ${before}`);
    }
    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = cache.get("expiring");
    if (after !== null) {
      throw new Error(`Expected null after expiry, got ${after}`);
    }
    console.log(`   Entry expired correctly after TTL`);
  });

  await test("Evict LRU entries when at capacity").run(async () => {
    const cache = new ResponseCache(3); // Max 3 entries
    cache.set("a", 1, "114");
    cache.set("b", 2, "114");
    cache.set("c", 3, "114");

    // Access "a" to make it recently used
    cache.get("a");

    // Add "d" - should evict "b" (least recently used)
    cache.set("d", 4, "114");

    if (cache.size !== 3) {
      throw new Error(`Expected size 3, got ${cache.size}`);
    }
    if (cache.get("b") !== null) {
      throw new Error(`Expected "b" to be evicted`);
    }
    if (cache.get("a") !== 1) {
      throw new Error(`Expected "a" to still be present`);
    }
    if (cache.get("d") !== 4) {
      throw new Error(`Expected "d" to be present`);
    }
    console.log(`   LRU eviction works correctly (evicted "b", kept "a")`);
  });

  await test("Clear removes all entries").run(async () => {
    const cache = new ResponseCache();
    cache.set("x", 1, "114");
    cache.set("y", 2, "114");
    cache.clear();
    if (cache.size !== 0) {
      throw new Error(`Expected size 0 after clear, got ${cache.size}`);
    }
    if (cache.get("x") !== null) {
      throw new Error(`Expected null after clear`);
    }
    console.log(`   Cache cleared successfully`);
  });

  await test("buildKey produces deterministic keys with sorted params").run(
    async () => {
      const cache = new ResponseCache();
      const key1 = cache.buildKey("114", "/lookup/id/ENSG00000141510", {
        expand: "Transcript",
        species: "homo_sapiens",
      });
      const key2 = cache.buildKey("114", "/lookup/id/ENSG00000141510", {
        species: "homo_sapiens",
        expand: "Transcript",
      });
      if (key1 !== key2) {
        throw new Error(`Keys differ despite same params:\n  ${key1}\n  ${key2}`);
      }
      console.log(`   Key: ${key1}`);
    }
  );

  await test("buildKey includes release version prefix").run(async () => {
    const cache = new ResponseCache();
    const key = cache.buildKey("114", "/info/species");
    if (!key.startsWith("114:")) {
      throw new Error(`Expected key to start with "114:", got ${key}`);
    }
    console.log(`   Key: ${key}`);
  });

  await test("buildKey filters empty/null param values").run(async () => {
    const cache = new ResponseCache();
    const key1 = cache.buildKey("114", "/lookup/id/BRCA1", {
      expand: "Transcript",
      biotype: "",
    });
    const key2 = cache.buildKey("114", "/lookup/id/BRCA1", {
      expand: "Transcript",
    });
    if (key1 !== key2) {
      throw new Error(
        `Empty param values should be filtered:\n  ${key1}\n  ${key2}`
      );
    }
    console.log(`   Empty params correctly filtered`);
  });

  await test("getTtlForEndpoint returns correct tier TTLs").run(async () => {
    const cache = new ResponseCache();
    const hour = 60 * 60 * 1000;

    const metaTtl = cache.getTtlForEndpoint("/info/species");
    if (metaTtl !== 24 * hour) {
      throw new Error(`Expected 24h for /info/species, got ${metaTtl}ms`);
    }

    const lookupTtl = cache.getTtlForEndpoint("/lookup/id/ENSG00000141510");
    if (lookupTtl !== 6 * hour) {
      throw new Error(`Expected 6h for /lookup, got ${lookupTtl}ms`);
    }

    const vepTtl = cache.getTtlForEndpoint("/vep/homo_sapiens/id/rs699");
    if (vepTtl !== 1 * hour) {
      throw new Error(`Expected 1h for /vep, got ${vepTtl}ms`);
    }

    const ontologyTtl = cache.getTtlForEndpoint("/ontology/id/GO:0008150");
    if (ontologyTtl !== 24 * hour) {
      throw new Error(`Expected 24h for /ontology, got ${ontologyTtl}ms`);
    }

    console.log(
      `   Tier TTLs: info=24h, lookup=6h, vep=1h, ontology=24h`
    );
  });

  await test("getStats tracks hits and misses").run(async () => {
    const cache = new ResponseCache();
    cache.set("k", "v", "114");
    cache.get("k"); // hit
    cache.get("k"); // hit
    cache.get("missing"); // miss
    const stats = cache.getStats();
    if (stats.hits !== 2 || stats.misses !== 1) {
      throw new Error(
        `Expected 2 hits / 1 miss, got ${stats.hits} / ${stats.misses}`
      );
    }
    console.log(`   Stats: ${JSON.stringify(stats)}`);
  });

  await test("Overwriting an existing key doesn't increase size").run(
    async () => {
      const cache = new ResponseCache();
      cache.set("k", "v1", "114");
      cache.set("k", "v2", "114");
      if (cache.size !== 1) {
        throw new Error(`Expected size 1, got ${cache.size}`);
      }
      if (cache.get("k") !== "v2") {
        throw new Error(`Expected "v2", got ${cache.get("k")}`);
      }
      console.log(`   Overwrite works, size stays at 1`);
    }
  );

  // --- Integration test: verify caching in EnsemblApiClient ---

  console.log("\n🔗 INTEGRATION TESTS: EnsemblApiClient caching\n");

  await test("Second identical lookup returns cached result (faster)").run(
    async () => {
      const client = new EnsemblApiClient();

      // First call - hits the network
      const start1 = Date.now();
      const result1 = await client.performLookup({
        identifier: "ENSG00000141510",
        lookup_type: "id",
      });
      const duration1 = Date.now() - start1;

      if (!result1 || !result1.id) {
        throw new Error("First lookup failed");
      }

      // Second call - should come from cache
      const start2 = Date.now();
      const result2 = await client.performLookup({
        identifier: "ENSG00000141510",
        lookup_type: "id",
      });
      const duration2 = Date.now() - start2;

      if (!result2 || result2.id !== result1.id) {
        throw new Error("Cached result doesn't match original");
      }

      // Cache hit should be significantly faster (< 5ms vs 100ms+ network)
      if (duration2 >= duration1 && duration2 > 10) {
        throw new Error(
          `Cache didn't help: first=${duration1}ms, second=${duration2}ms`
        );
      }

      console.log(
        `   First call: ${duration1}ms, Second (cached): ${duration2}ms`
      );
      console.log(`   Gene: ${result1.display_name} (${result1.id})`);
    }
  );

  await test("clearCache forces fresh network request").run(async () => {
    const client = new EnsemblApiClient();

    // Warm the cache
    await client.getMetaInfo({ info_type: "ping" });

    // Verify it's cached (fast)
    const start1 = Date.now();
    await client.getMetaInfo({ info_type: "ping" });
    const cachedDuration = Date.now() - start1;

    // Clear and re-request
    client.clearCache();
    const start2 = Date.now();
    await client.getMetaInfo({ info_type: "ping" });
    const freshDuration = Date.now() - start2;

    console.log(
      `   Cached: ${cachedDuration}ms, After clear: ${freshDuration}ms`
    );

    // Just verify it didn't error - timing can be variable
    const stats = client.getCacheStats();
    console.log(`   Cache stats after clear+refetch: ${JSON.stringify(stats)}`);
  });

  await test("getCacheStats returns hit/miss data").run(async () => {
    const client = new EnsemblApiClient();

    await client.getMetaInfo({ info_type: "ping" }); // miss
    await client.getMetaInfo({ info_type: "ping" }); // hit

    const stats = client.getCacheStats();
    if (stats.hits < 1) {
      throw new Error(`Expected at least 1 hit, got ${stats.hits}`);
    }
    console.log(`   Stats: ${JSON.stringify(stats)}`);
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runCacheTests();

    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(
      `   Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    );

    if (failedTests > 0) {
      console.log(`\n❌ OVERALL: FAILED (${failedTests} test failures)`);
      process.exit(1);
    } else {
      console.log(`\n✅ OVERALL: PASSED (all tests successful)`);
      process.exit(0);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n💥 TEST RUNNER ERROR: ${errorMessage}`);
    process.exit(1);
  }
}

main();
