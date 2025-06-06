#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_feature_overlap tool
 * Tests genomic feature overlap queries
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

async function runFeatureOverlapTests() {
  console.log("🧬 UNIT TESTS: ensembl_feature_overlap tool\n");

  // Positive tests
  await test("Find genes in BRCA1 region").run(async () => {
    const result = await client.getOverlapByRegion({
      region: "17:43000000-44000000",
      species: "homo_sapiens",
      feature_types: ["gene"],
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No genes found in BRCA1 region");
    }
    console.log(`   Found ${result.length} genes`);
  });

  await test("Find genes in TP53 region").run(async () => {
    const result = await client.getOverlapByRegion({
      region: "17:7661779-7687546",
      species: "homo_sapiens",
      feature_types: ["gene"],
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No genes found in TP53 region");
    }

    const tp53 = result.find((g) => g.external_name === "TP53");
    if (!tp53) {
      throw new Error("TP53 gene not found in its own region");
    }

    console.log(`   Found ${result.length} genes including TP53`);
  });

  await test("Find transcripts by feature ID").run(async () => {
    const result = await client.getOverlapById({
      feature_id: "ENSG00000146648",
      species: "homo_sapiens",
      feature_types: ["transcript"],
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No transcripts found for EGFR");
    }
    console.log(`   Found ${result.length} transcripts`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid region format", false).run(async () => {
    await client.getOverlapByRegion({
      region: "invalid-region",
      species: "homo_sapiens",
    });
  });

  await test("Invalid species", false).run(async () => {
    await client.getOverlapByRegion({
      region: "1:1000000-2000000",
      species: "invalid_species",
    });
  });

  await test("Missing required region", false).run(async () => {
    await client.getOverlapByRegion({
      species: "homo_sapiens",
      feature_types: ["gene"],
    });
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runFeatureOverlapTests();

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
