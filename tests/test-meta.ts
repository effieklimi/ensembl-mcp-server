#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_meta tool
 * Tests server metadata, species info, assemblies, and diagnostics
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

async function runMetaTests(): Promise<void> {
  console.log("📊 UNIT TESTS: ensembl_meta tool\n");

  // Positive tests
  await test("Get server info and status").run(async () => {
    const result = await client.getMetaInfo({
      info_type: "rest",
    });

    if (!result || !result.release) {
      throw new Error("No server info returned");
    }
    console.log(`   Ensembl release: ${result.release}`);
  });

  await test("Check server ping").run(async () => {
    const result = await client.getMetaInfo({
      info_type: "ping",
    });

    if (!result || result.ping !== 1) {
      throw new Error("Server ping failed");
    }
    console.log(`   Server status: OK`);
  });

  await test("Get available species list").run(async () => {
    const result = await client.getMetaInfo({
      info_type: "species",
    });

    // The species API returns { species: [...] } not [...] directly
    const speciesList = result.species || result;

    if (!Array.isArray(speciesList) || speciesList.length === 0) {
      throw new Error("No species list returned");
    }

    const human = speciesList.find((s: any) => s.name === "homo_sapiens");
    if (!human) {
      throw new Error("Human not found in species list");
    }

    console.log(`   Found ${speciesList.length} species including human`);
  });

  await test("Get assembly info for human").run(async () => {
    const result = await client.getMetaInfo({
      info_type: "assembly",
      species: "homo_sapiens",
    });

    if (!result || !result.assembly_name) {
      throw new Error("No assembly info returned");
    }

    console.log(`   Assembly: ${result.assembly_name}`);
  });

  await test("Get biotypes for human").run(async () => {
    const result = await client.getMetaInfo({
      info_type: "biotypes",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("No biotypes returned");
    }

    const proteinCoding = result.find(
      (b: any) => b.biotype === "protein_coding"
    );
    if (!proteinCoding) {
      throw new Error("protein_coding biotype not found");
    }

    console.log(`   Found ${result.length} biotypes including protein_coding`);
  });

  await test("Archive ID version lookup").run(async () => {
    const result = await client.getMetaInfo({
      archive_id: "ENSG00000141510",
    });

    if (!result || !result.id) {
      throw new Error("No archive result returned");
    }

    if (result.id !== "ENSG00000141510") {
      throw new Error(`Expected ENSG00000141510, got ${result.id}`);
    }

    console.log(`   Archive ID: ${result.id}, Latest: ${result.latest}`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid species", false).run(async () => {
    await client.getMetaInfo({
      info_type: "assembly",
      species: "invalid_species",
    });
  });

  await test("Invalid info type", false).run(async () => {
    await client.getMetaInfo({
      info_type: "invalid_info_type" as any,
    });
  });

  await test("Invalid archive ID", false).run(async () => {
    await client.getMetaInfo({
      archive_id: "INVALID_ID123",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.getMetaInfo({} as any);
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runMetaTests();

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
