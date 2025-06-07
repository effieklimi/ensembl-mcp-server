#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_protein_features tool
 * Tests protein domain annotations and functional features
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
        if (!expectedToPass) {
          passedTests++;
          console.log(
            `✅ PASS - Expected error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } else {
          failedTests++;
          console.log(
            `❌ FAIL - Unexpected error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    },
  };
}

async function runProteinFeatureTests(): Promise<void> {
  console.log("🧬 UNIT TESTS: ensembl_protein_features tool\n");

  // Positive tests
  await test("Get protein features for TP53").run(async () => {
    const result = await client.getProteinFeatures({
      protein_id: "ENSP00000269305",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No protein features found for TP53");
    }
    console.log(`   Found ${result.length} protein features`);
  });

  await test("Get protein features for BRCA1").run(async () => {
    const result = await client.getProteinFeatures({
      protein_id: "ENSP00000350283",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No protein features found for BRCA1");
    }
    console.log(`   Found ${result.length} protein features`);
  });

  await test("Get specific Pfam domains").run(async () => {
    const result = await client.getProteinFeatures({
      protein_id: "ENSP00000269305",
      species: "homo_sapiens",
      feature_type: "Pfam",
    });

    if (!Array.isArray(result)) {
      throw new Error("Expected protein features array");
    }
    console.log(`   Found ${result.length} Pfam domains`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid protein ID", false).run(async () => {
    await client.getProteinFeatures({
      protein_id: "INVALID_PROTEIN_ID",
      species: "homo_sapiens",
    });
  });

  await test("Missing protein ID", false).run(async () => {
    await client.getProteinFeatures({
      species: "homo_sapiens",
    });
  });

  await test("Invalid species", false).run(async () => {
    await client.getProteinFeatures({
      protein_id: "ENSP00000269305",
      species: "invalid_species",
    });
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runProteinFeatureTests();

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
    console.error(
      `\n💥 TEST RUNNER ERROR: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
}

main();
