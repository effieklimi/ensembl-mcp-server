#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_mapping tool
 * Tests coordinate transformations between genomic, cDNA, CDS, and protein coordinates
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

async function runMappingTests() {
  console.log("🗺️ UNIT TESTS: ensembl_mapping tool\n");

  // Positive tests
  await test("Map genomic to cDNA coordinates (TP53)").run(async () => {
    const result = await client.mapCoordinates({
      feature_id: "ENST00000269305",
      mapping_type: "cdna",
      coordinates: "100..200",
      species: "homo_sapiens",
    });

    if (!result || (!result.mappings && !Array.isArray(result))) {
      throw new Error("No coordinate mapping returned");
    }
    console.log(`   Coordinate mapping successful`);
  });

  await test("Map assembly coordinates (GRCh37 to GRCh38)").run(async () => {
    const result = await client.mapCoordinates({
      mapping_type: "assembly",
      source_assembly: "GRCh37",
      target_assembly: "GRCh38",
      coordinates: "17:7512445..7531642",
      species: "homo_sapiens",
    });

    if (!result) {
      throw new Error("No assembly mapping returned");
    }
    console.log(`   Assembly mapping successful`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid feature ID", false).run(async () => {
    await client.mapCoordinates({
      feature_id: "INVALID_TRANSCRIPT",
      mapping_type: "cdna",
      coordinates: "1..100",
      species: "homo_sapiens",
    });
  });

  await test("Invalid coordinate format", false).run(async () => {
    await client.mapCoordinates({
      feature_id: "ENST00000269305",
      mapping_type: "cdna",
      coordinates: "invalid-coordinates",
      species: "homo_sapiens",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.mapCoordinates({
      mapping_type: "cdna",
      species: "homo_sapiens",
    });
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runMappingTests();

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
