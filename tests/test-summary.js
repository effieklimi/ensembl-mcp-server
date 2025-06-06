#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_summary tool
 * Tests comprehensive gene information summaries
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

async function runSummaryTests() {
  console.log("📋 UNIT TESTS: ensembl_summary tool\n");

  // Positive tests
  await test("Get TP53 gene summary").run(async () => {
    const result = await client.getGeneSummary({
      gene_symbol: "TP53",
      species: "homo_sapiens",
    });

    if (!result || !result.gene_id) {
      throw new Error("No gene summary returned for TP53");
    }

    if (result.gene_symbol !== "TP53") {
      throw new Error(`Expected gene symbol TP53, got ${result.gene_symbol}`);
    }

    console.log(`   Gene ID: ${result.gene_id}`);
    console.log(
      `   Location: ${result.chromosome}:${result.start}-${result.end}`
    );
  });

  await test("Get BRCA1 gene summary").run(async () => {
    const result = await client.getGeneSummary({
      gene_symbol: "BRCA1",
      species: "homo_sapiens",
    });

    if (!result || !result.gene_id) {
      throw new Error("No gene summary returned for BRCA1");
    }

    if (result.gene_symbol !== "BRCA1") {
      throw new Error(`Expected gene symbol BRCA1, got ${result.gene_symbol}`);
    }

    console.log(`   Gene ID: ${result.gene_id}`);
    console.log(`   Transcripts: ${result.transcript_count || "N/A"}`);
  });

  await test("Get gene summary by ID").run(async () => {
    const result = await client.getGeneSummary({
      gene_id: "ENSG00000141510",
      species: "homo_sapiens",
    });

    if (!result || !result.gene_id) {
      throw new Error("No gene summary returned for TP53 gene ID");
    }

    console.log(`   Gene symbol: ${result.gene_symbol}`);
    console.log(`   Description: ${result.description?.substring(0, 50)}...`);
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid gene symbol", false).run(async () => {
    await client.getGeneSummary({
      gene_symbol: "FAKEGENE123",
      species: "homo_sapiens",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.getGeneSummary({
      species: "homo_sapiens",
      // Missing both gene_symbol and gene_id
    });
  });

  await test("Invalid species", false).run(async () => {
    await client.getGeneSummary({
      gene_symbol: "TP53",
      species: "invalid_species",
    });
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runSummaryTests();

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
