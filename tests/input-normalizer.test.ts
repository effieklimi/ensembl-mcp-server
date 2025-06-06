#!/usr/bin/env node

/**
 * UNIT TESTS for input normalizer
 * Tests format normalization for various Ensembl input types
 */

import {
  normalizeGenomicRegion,
  normalizeCdnaCoordinates,
  normalizeSpeciesName,
  normalizeGeneIdentifier,
  normalizeHgvsNotation,
  normalizeEnsemblInputs,
} from "../src/utils/input-normalizer.js";

// Test framework
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name: string, expectedToPass = true) {
  return {
    async run(testFunction: () => Promise<void>) {
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

async function runNormalizerTests() {
  console.log("🔧 UNIT TESTS: Input Normalizer\n");

  // Test genomic region normalization
  await test("Normalize chr prefix").run(async () => {
    const result = normalizeGenomicRegion("chr17:43000000-44000000");
    if (result !== "17:43000000-44000000") {
      throw new Error(`Expected '17:43000000-44000000', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Normalize chromosome prefix").run(async () => {
    const result = normalizeGenomicRegion("chromosome17:43000000-44000000");
    if (result !== "17:43000000-44000000") {
      throw new Error(`Expected '17:43000000-44000000', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Handle comma separators in numbers").run(async () => {
    const result = normalizeGenomicRegion("17:43,000,000-44,000,000");
    if (result !== "17:43000000-44000000") {
      throw new Error(`Expected '17:43000000-44000000', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Handle spaces in genomic region").run(async () => {
    const result = normalizeGenomicRegion("17 : 43000000 - 44000000");
    if (result !== "17:43000000-44000000") {
      throw new Error(`Expected '17:43000000-44000000', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  // Test cDNA coordinate normalization
  await test("Convert dash to .. format").run(async () => {
    const result = normalizeCdnaCoordinates("100-200");
    if (result !== "100..200") {
      throw new Error(`Expected '100..200', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Convert colon to .. format").run(async () => {
    const result = normalizeCdnaCoordinates("100:200");
    if (result !== "100..200") {
      throw new Error(`Expected '100..200', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Handle spaces in cDNA coords").run(async () => {
    const result = normalizeCdnaCoordinates("100 - 200");
    if (result !== "100..200") {
      throw new Error(`Expected '100..200', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  // Test species name normalization
  await test("Normalize species case").run(async () => {
    const result = normalizeSpeciesName("Homo_sapiens");
    if (result !== "homo_sapiens") {
      throw new Error(`Expected 'homo_sapiens', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Convert spaces to underscores").run(async () => {
    const result = normalizeSpeciesName("Homo sapiens");
    if (result !== "homo_sapiens") {
      throw new Error(`Expected 'homo_sapiens', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  // Test gene identifier normalization
  await test("Uppercase Ensembl ID").run(async () => {
    const result = normalizeGeneIdentifier("ensg00000141510");
    if (result !== "ENSG00000141510") {
      throw new Error(`Expected 'ENSG00000141510', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Uppercase gene symbol").run(async () => {
    const result = normalizeGeneIdentifier("brca1");
    if (result !== "BRCA1") {
      throw new Error(`Expected 'BRCA1', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  await test("Keep variant ID as-is").run(async () => {
    const result = normalizeGeneIdentifier("rs699");
    if (result !== "rs699") {
      throw new Error(`Expected 'rs699', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  // Test HGVS normalization
  await test("Normalize HGVS spacing").run(async () => {
    const result = normalizeHgvsNotation("17 : g.7579472G>C");
    if (result !== "17:g.7579472G>C") {
      throw new Error(`Expected '17:g.7579472G>C', got '${result}'`);
    }
    console.log(`   ${result}`);
  });

  // Test comprehensive normalization
  await test("Normalize all fields together").run(async () => {
    const input = {
      region: "chr17:43,000,000-44,000,000",
      coordinates: "100-200",
      species: "Homo sapiens",
      gene_symbol: "brca1",
      variant_id: "rs699",
      hgvs_notation: "17 : g.7579472G>C",
    };

    const result = normalizeEnsemblInputs(input);

    if (result.region !== "17:43000000-44000000") {
      throw new Error(`Region normalization failed: ${result.region}`);
    }
    if (result.coordinates !== "100..200") {
      throw new Error(
        `Coordinates normalization failed: ${result.coordinates}`
      );
    }
    if (result.species !== "homo_sapiens") {
      throw new Error(`Species normalization failed: ${result.species}`);
    }
    if (result.gene_symbol !== "BRCA1") {
      throw new Error(
        `Gene symbol normalization failed: ${result.gene_symbol}`
      );
    }
    if (result.hgvs_notation !== "17:g.7579472G>C") {
      throw new Error(`HGVS normalization failed: ${result.hgvs_notation}`);
    }

    console.log(`   All fields normalized correctly`);
  });
}

// Run tests and exit with appropriate code
async function main() {
  try {
    await runNormalizerTests();

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
