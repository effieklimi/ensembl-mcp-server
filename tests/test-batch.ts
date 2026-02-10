#!/usr/bin/env node

/**
 * UNIT TESTS for batch operations (array inputs to ensembl_lookup,
 * ensembl_sequence, ensembl_variation)
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

// Test framework
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

async function runBatchTests(): Promise<void> {
  console.log("📦 UNIT TESTS: batch tools\n");

  // Batch lookup by ID
  await test("Batch lookup of 3 gene IDs").run(async () => {
    const ids = ["ENSG00000141510", "ENSG00000012048", "ENSG00000139618"];
    const result = await client.batchLookupIds(ids);

    if (!result || typeof result !== "object") {
      throw new Error("Expected object result");
    }
    const keys = Object.keys(result);
    if (keys.length !== 3) {
      throw new Error(`Expected 3 results, got ${keys.length}`);
    }
    console.log(
      `   Results: ${keys.map((k) => result[k]?.display_name || k).join(", ")}`
    );
  });

  // Batch lookup by symbol
  await test("Batch lookup of 3 gene symbols").run(async () => {
    const symbols = ["BRCA1", "TP53", "EGFR"];
    const result = await client.batchLookupSymbols("homo_sapiens", symbols);

    if (!result || typeof result !== "object") {
      throw new Error("Expected object result");
    }
    const keys = Object.keys(result);
    if (keys.length !== 3) {
      throw new Error(`Expected 3 results, got ${keys.length}`);
    }
    console.log(
      `   Results: ${keys.map((k) => result[k]?.display_name || k).join(", ")}`
    );
  });

  // Single ID batch (edge case)
  await test("Batch lookup with single ID").run(async () => {
    const result = await client.batchLookupIds(["ENSG00000141510"]);

    if (!result || typeof result !== "object") {
      throw new Error("Expected object result");
    }
    if (!result["ENSG00000141510"]) {
      throw new Error("Expected result for ENSG00000141510");
    }
    console.log(
      `   Result: ${result["ENSG00000141510"]?.display_name || "ENSG00000141510"}`
    );
  });

  // Batch sequence by ID
  await test("Batch sequence retrieval for 2 transcripts").run(async () => {
    const ids = ["ENST00000288602", "ENST00000275493"];
    const result = await client.batchSequenceIds(ids);

    if (!Array.isArray(result)) {
      throw new Error("Expected array result");
    }
    if (result.length !== 2) {
      throw new Error(`Expected 2 sequences, got ${result.length}`);
    }
    console.log(
      `   Got ${result.length} sequences (${result.map((r: any) => r.id).join(", ")})`
    );
  });

  // Batch VEP by variant ID
  await test("Batch VEP for 2 variant IDs").run(async () => {
    const ids = ["rs699", "rs1042779"];
    const result = await client.batchVepIds("homo_sapiens", ids);

    if (!Array.isArray(result)) {
      throw new Error("Expected array result");
    }
    if (result.length < 1) {
      throw new Error("Expected at least 1 VEP result");
    }
    console.log(`   Got ${result.length} VEP results`);
  });

  // Batch variant info
  await test("Batch variant info for 2 variants").run(async () => {
    const ids = ["rs699", "rs1042779"];
    const result = await client.batchVariationIds("homo_sapiens", ids);

    if (!result || typeof result !== "object") {
      throw new Error("Expected object result");
    }
    const keys = Object.keys(result);
    if (keys.length < 1) {
      throw new Error("Expected at least 1 variant result");
    }
    console.log(`   Got ${keys.length} variant results: ${keys.join(", ")}`);
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runBatchTests();

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
