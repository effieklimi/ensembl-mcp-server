#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_variation tool
 * Tests variant analysis, VEP predictions, LD analysis, and phenotype mapping
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

async function runVariationTests(): Promise<void> {
  console.log("🧬 UNIT TESTS: ensembl_variation tool\n");

  // Positive tests (should pass)
  await test("Get variant info for rs699 (AGT gene)").run(async () => {
    const result = await client.getVariationData({
      variant_id: "rs699",
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });

    if (!result || !result.most_severe_consequence) {
      throw new Error("No valid variant result returned");
    }
    console.log(`   Most severe: ${result.most_severe_consequence}`);
  });

  await test("Get variant info for rs1800562 (HFE gene)").run(async () => {
    const result = await client.getVariationData({
      variant_id: "rs1800562",
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });

    if (!result || !result.most_severe_consequence) {
      throw new Error("No valid variant result returned");
    }
    console.log(`   Most severe: ${result.most_severe_consequence}`);
  });

  await test("Find variants in TP53 region").run(async () => {
    const result = await client.getVariationData({
      region: "17:7661779-7687546",
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected array of variants");
    }
    console.log(`   Found ${result.length} variants`);
  });

  await test("VEP analysis for rs699").run(async () => {
    const result = await client.getVariationData({
      variant_id: "rs699",
      analysis_type: "vep",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected VEP results array");
    }

    const first = result[0];
    if (!first.most_severe_consequence) {
      throw new Error("Missing VEP consequence data");
    }
    console.log(`   Most severe consequence: ${first.most_severe_consequence}`);
  });

  await test("VEP analysis with HGVS notation").run(async () => {
    const result = await client.getVariationData({
      hgvs_notation: "ENST00000269305.4:c.215C>G",
      analysis_type: "vep",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected VEP results for HGVS notation");
    }
    console.log(`   VEP results: ${result.length} consequences`);
  });

  await test("VEP analysis by region").run(async () => {
    const result = await client.getVariationData({
      region: "17:7676154-7676154:1/C",
      analysis_type: "vep",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected VEP results for region");
    }
    console.log(`   Regional VEP: ${result.length} results`);
  });

  await test("LD analysis for rs699").run(async () => {
    const result = await client.getVariationData({
      variant_id: "rs699",
      analysis_type: "ld",
      species: "homo_sapiens",
      population: "1000GENOMES:phase_3:EUR",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected LD results array");
    }

    const first = result[0];
    if (first.r2 === undefined) {
      throw new Error("Missing LD statistics");
    }
    console.log(`   LD results: ${result.length} variants, r²=${first.r2}`);
  });

  await test("Phenotype variants in region").run(async () => {
    const result = await client.getVariationData({
      region: "17:43044294-43125370",
      analysis_type: "phenotype",
      species: "homo_sapiens",
    });

    if (!Array.isArray(result)) {
      throw new Error("Expected phenotype results array");
    }
    console.log(`   Phenotype variants: ${result.length}`);
  });

  await test("Transcript haplotypes for TP53").run(async () => {
    const result = await client.getVariationData({
      transcript_id: "ENST00000269305",
      analysis_type: "haplotypes",
      species: "homo_sapiens",
    });

    if (!result) {
      throw new Error("Expected haplotype result");
    }
    console.log(`   Haplotype data retrieved`);
  });

  // Negative tests (should fail and we expect them to)
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid variant ID", false).run(async () => {
    await client.getVariationData({
      variant_id: "rs999999999999",
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });
  });

  await test("Invalid HGVS notation", false).run(async () => {
    await client.getVariationData({
      hgvs_notation: "INVALID:c.123A>G",
      analysis_type: "vep",
      species: "homo_sapiens",
    });
  });

  await test("LD without variant ID", false).run(async () => {
    await client.getVariationData({
      analysis_type: "ld",
      species: "homo_sapiens",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.getVariationData({
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runVariationTests();

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
