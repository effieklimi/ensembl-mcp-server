#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_lookup tool
 * Tests ID/symbol lookup, cross-references, and variant recoding
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

async function runLookupTests(): Promise<void> {
  console.log("🔍 UNIT TESTS: ensembl_lookup tool\n");

  // Positive tests (should pass)
  await test("Look up BRCA1 gene by symbol").run(async () => {
    const result = await client.performLookup({
      identifier: "BRCA1",
      lookup_type: "symbol",
      species: "homo_sapiens",
      expand: ["Transcript"],
    });

    if (!result || !result.id) throw new Error("No valid result returned");
    if (result.display_name !== "BRCA1")
      throw new Error(`Expected BRCA1, got ${result.display_name}`);
    console.log(`   Result: ${result.display_name} (${result.id})`);
  });

  await test("Look up TP53 gene by Ensembl ID").run(async () => {
    const result = await client.performLookup({
      identifier: "ENSG00000141510",
      lookup_type: "id",
      expand: ["Transcript", "Exon"],
    });

    if (!result || !result.id) throw new Error("No valid result returned");
    if (result.id !== "ENSG00000141510")
      throw new Error(`Expected ENSG00000141510, got ${result.id}`);
    console.log(`   Result: ${result.display_name || result.id}`);
  });

  await test("Look up EGFR transcript").run(async () => {
    const result = await client.performLookup({
      identifier: "ENST00000275493",
      lookup_type: "id",
    });

    if (!result || !result.id) throw new Error("No valid result returned");
    if (result.id !== "ENST00000275493")
      throw new Error(`Expected ENST00000275493, got ${result.id}`);
    console.log(`   Result: ${result.display_name || result.id}`);
  });

  await test("Find cross-references for BRCA1").run(async () => {
    const result = await client.performLookup({
      identifier: "ENSG00000012048",
      lookup_type: "xrefs",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected array of cross-references");
    }
    console.log(`   Found ${result.length} cross-references`);
  });

  await test("Look up external reference (HGNC symbol)").run(async () => {
    const result = await client.performLookup({
      identifier: "TP53",
      lookup_type: "xrefs",
      species: "homo_sapiens",
      external_db: "HGNC",
    });

    if (!Array.isArray(result)) throw new Error("Expected array result");
    console.log(`   Found ${result.length} HGNC references`);
  });

  await test("Look up mouse Trp53 gene").run(async () => {
    const result = await client.performLookup({
      identifier: "Trp53",
      lookup_type: "symbol",
      species: "mus_musculus",
    });

    if (!result || !result.id) throw new Error("No valid result returned");
    console.log(`   Result: ${result.display_name || result.id}`);
  });

  // Negative tests (should fail and we expect them to)
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid gene symbol", false).run(async () => {
    await client.performLookup({
      identifier: "FAKEGENE123",
      lookup_type: "symbol",
      species: "homo_sapiens",
    });
  });

  await test("Invalid Ensembl ID", false).run(async () => {
    await client.performLookup({
      identifier: "ENSG99999999",
      lookup_type: "id",
    });
  });

  await test("Missing required identifier", false).run(async () => {
    await client.performLookup({
      lookup_type: "symbol",
      species: "homo_sapiens",
    } as any);
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runLookupTests();

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
