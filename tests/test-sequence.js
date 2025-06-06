#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_sequence tool
 * Tests DNA, RNA, and protein sequence retrieval
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

async function runSequenceTests() {
  console.log("🧬 UNIT TESTS: ensembl_sequence tool\n");

  // Positive tests
  await test("Get genomic sequence for BRCA1 gene").run(async () => {
    const result = await client.getSequenceData({
      identifier: "ENSG00000012048",
      sequence_type: "genomic",
      species: "homo_sapiens",
      format: "json",
    });

    if (!result || !result.seq) {
      throw new Error("No sequence data returned");
    }
    if (result.seq.length < 1000) {
      throw new Error(`BRCA1 sequence too short: ${result.seq.length}`);
    }
    console.log(`   Retrieved ${result.seq.length} bp sequence`);
  });

  await test("Get cDNA sequence for TP53 transcript").run(async () => {
    const result = await client.getSequenceData({
      identifier: "ENST00000269305",
      sequence_type: "cdna",
      species: "homo_sapiens",
      format: "fasta",
    });

    if (!result || !result.seq) {
      throw new Error("No cDNA sequence returned");
    }
    console.log(`   Retrieved ${result.seq.length} bp cDNA`);
  });

  await test("Get protein sequence for TP53").run(async () => {
    const result = await client.getSequenceData({
      identifier: "ENSP00000269305",
      sequence_type: "protein",
      species: "homo_sapiens",
      format: "fasta",
    });

    if (!result || !result.seq) {
      throw new Error("No protein sequence returned");
    }
    if (result.seq.length < 300) {
      throw new Error(`TP53 protein too short: ${result.seq.length}`);
    }
    console.log(`   Retrieved ${result.seq.length} aa protein`);
  });

  await test("Get genomic region sequence").run(async () => {
    const result = await client.getSequenceData({
      identifier: "17:7565096-7590856",
      sequence_type: "genomic",
      species: "homo_sapiens",
      format: "json",
    });

    if (!result || !result.seq) {
      throw new Error("No region sequence returned");
    }
    const expectedLength = 7590856 - 7565096 + 1;
    if (Math.abs(result.seq.length - expectedLength) > 100) {
      throw new Error(
        `Unexpected region length: ${result.seq.length} vs ${expectedLength}`
      );
    }
    console.log(`   Retrieved ${result.seq.length} bp region`);
  });

  await test("Get sequence with soft masking").run(async () => {
    const result = await client.getSequenceData({
      identifier: "17:7565096-7570000",
      sequence_type: "genomic",
      species: "homo_sapiens",
      format: "json",
      mask: "soft",
    });

    if (!result || !result.seq) {
      throw new Error("No masked sequence returned");
    }
    const lowercaseCount = (result.seq.match(/[a-z]/g) || []).length;
    console.log(
      `   Retrieved ${result.seq.length} bp with ${lowercaseCount} soft-masked bases`
    );
  });

  // Negative tests
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid identifier", false).run(async () => {
    await client.getSequenceData({
      identifier: "INVALID_ID",
      sequence_type: "genomic",
      species: "homo_sapiens",
    });
  });

  await test("Invalid region format", false).run(async () => {
    await client.getSequenceData({
      identifier: "chr17:invalid-region",
      sequence_type: "genomic",
      species: "homo_sapiens",
    });
  });

  await test("Missing required identifier", false).run(async () => {
    await client.getSequenceData({
      sequence_type: "genomic",
      species: "homo_sapiens",
    });
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runSequenceTests();

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
