#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_compara tool
 * Tests comparative genomics: homology, gene trees, alignments
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api";

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

async function runComparaTests(): Promise<void> {
  console.log("🔗 UNIT TESTS: ensembl_compara tool\n");

  // Positive tests
  await test("Find orthologs of human TP53").run(async () => {
    const result = await client.getComparativeData({
      gene_symbol: "TP53",
      analysis_type: "homology",
      species: "homo_sapiens",
      homology_type: "orthologues",
    });

    if (
      !result.data ||
      !Array.isArray(result.data) ||
      result.data.length === 0
    ) {
      throw new Error("No orthologs found for TP53");
    }
    console.log(`   Found ${result.data.length} ortholog relationships`);
  });

  await test("Find paralogs of human BRCA1").run(async () => {
    const result = await client.getComparativeData({
      gene_id: "ENSG00000012048",
      analysis_type: "homology",
      species: "homo_sapiens",
      homology_type: "paralogues",
    });

    if (!result.data || !Array.isArray(result.data)) {
      throw new Error("No paralogs data returned");
    }
    console.log(`   Found ${result.data.length} paralog relationships`);
  });

  await test("Get gene tree for TP53").run(async () => {
    const result = await client.getComparativeData({
      gene_symbol: "TP53",
      analysis_type: "genetree",
      species: "homo_sapiens",
    });

    if (!result || !result.tree) {
      throw new Error("No gene tree returned");
    }
    console.log(`   Gene tree retrieved with ID: ${result.id || "N/A"}`);
  });

  await test("Get genomic alignment for TP53 region").run(async () => {
    const result = await client.getComparativeData({
      region: "17:7565096-7590856",
      analysis_type: "alignment",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No alignment blocks returned");
    }
    console.log(`   Found ${result.length} alignment blocks`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid gene symbol", false).run(async () => {
    await client.getComparativeData({
      gene_symbol: "FAKEGENE123",
      analysis_type: "homology",
      species: "homo_sapiens",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.getComparativeData({
      analysis_type: "homology",
      species: "homo_sapiens",
    } as any);
  });

  await test("Alignment without region", false).run(async () => {
    await client.getComparativeData({
      analysis_type: "alignment",
      species: "homo_sapiens",
    } as any);
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runComparaTests();

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
