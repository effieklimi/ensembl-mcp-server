#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_regulatory tool
 * Tests protein features, domains, and binding matrices
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

// Test framework
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, expectedToPass = true) {
  return {
    async run(testFunction) {
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
      } catch (error) {
        if (!expectedToPass) {
          passedTests++;
          console.log(`✅ PASS - Expected error: ${error.message}`);
        } else {
          failedTests++;
          console.log(`❌ FAIL - Unexpected error: ${error.message}`);
        }
      }
    },
  };
}

async function runRegulatoryTests() {
  console.log("🔬 UNIT TESTS: ensembl_regulatory tool\n");

  // Positive tests
  await test("Find protein features for EGFR protein").run(async () => {
    const result = await client.getRegulatoryFeatures({
      protein_id: "ENSP00000275493",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result)) {
      throw new Error("Expected protein features array");
    }
    console.log(`   Found ${result.length} protein features`);
  });

  await test("Find protein features for TP53 protein").run(async () => {
    const result = await client.getRegulatoryFeatures({
      protein_id: "ENSP00000269305",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result)) {
      throw new Error("Expected protein features array");
    }
    console.log(`   Found ${result.length} protein features`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Missing required parameters", false).run(async () => {
    await client.getRegulatoryFeatures({
      species: "homo_sapiens",
      // Missing region, protein_id, and binding_matrix_id
    });
  });

  await test("Invalid protein ID", false).run(async () => {
    await client.getRegulatoryFeatures({
      protein_id: "INVALID_PROTEIN_ID",
      species: "homo_sapiens",
    });
  });

  await test("Invalid binding matrix ID", false).run(async () => {
    await client.getRegulatoryFeatures({
      binding_matrix_id: "INVALID_MATRIX",
      species: "homo_sapiens",
    });
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runRegulatoryTests();

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
  } catch (error) {
    console.error(`\n💥 TEST RUNNER ERROR: ${error.message}`);
    process.exit(1);
  }
}

main();
