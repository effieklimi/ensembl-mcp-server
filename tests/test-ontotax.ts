#!/usr/bin/env node

/**
 * UNIT TESTS for ensembl_ontotax tool
 * Tests ontology term search and NCBI taxonomy queries
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

async function runOntoTaxTests(): Promise<void> {
  console.log("🔬 UNIT TESTS: ensembl_ontotax tool\n");

  // Positive tests (should pass)
  await test("Search GO terms for apoptosis").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term: "apoptosis",
      ontology: "GO",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected array of GO terms");
    }
    console.log(`   Found ${result.length} GO terms`);
  });

  await test("Search GO terms for DNA repair").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term: "DNA repair",
      ontology: "GO",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected array of GO terms");
    }
    console.log(`   Found ${result.length} DNA repair terms`);
  });

  await test("Get specific GO term details").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term_id: "GO:0006915",
    });

    if (!result) {
      throw new Error("Expected GO term result");
    }
    console.log(`   Retrieved GO:0006915 details`);
  });

  await test("Search SO terms for transcript").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term: "transcript",
      ontology: "SO",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected SO term results");
    }
    console.log(`   Found ${result.length} SO transcript terms`);
  });

  await test("Get taxonomy info for human").run(async () => {
    const result = await client.getOntologyTaxonomy({
      ontology: "taxonomy",
      species: "9606",
    });

    if (!result || !result.scientific_name) {
      throw new Error("Expected human taxonomy result");
    }
    if (result.scientific_name !== "Homo sapiens") {
      throw new Error(`Expected Homo sapiens, got ${result.scientific_name}`);
    }
    console.log(`   Species: ${result.scientific_name}`);
  });

  await test("Get taxonomy info for mouse").run(async () => {
    const result = await client.getOntologyTaxonomy({
      ontology: "taxonomy",
      species: "10090",
    });

    if (!result || !result.scientific_name) {
      throw new Error("Expected mouse taxonomy result");
    }
    if (result.scientific_name !== "Mus musculus") {
      throw new Error(`Expected Mus musculus, got ${result.scientific_name}`);
    }
    console.log(`   Species: ${result.scientific_name}`);
  });

  await test("Search taxonomy by name").run(async () => {
    const result = await client.getOntologyTaxonomy({
      ontology: "taxonomy",
      term: "Homo sapiens",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected taxonomy search results");
    }
    console.log(`   Found ${result.length} taxonomy results`);
  });

  await test("Search MONDO disease terms").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term: "diabetes",
      ontology: "MONDO",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected MONDO term results");
    }
    console.log(`   Found ${result.length} MONDO diabetes terms`);
  });

  await test("Search HP phenotype terms").run(async () => {
    const result = await client.getOntologyTaxonomy({
      term: "seizure",
      ontology: "HP",
    });

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("Expected HP term results");
    }
    console.log(`   Found ${result.length} HP seizure terms`);
  });

  // Negative tests (should fail and we expect them to)
  console.log("\n🚫 Testing error conditions (these should fail):");

  await test("Invalid ontology ID", false).run(async () => {
    await client.getOntologyTaxonomy({
      term_id: "GO:9999999",
    });
  });

  await test("Invalid taxonomy ID", false).run(async () => {
    await client.getOntologyTaxonomy({
      ontology: "taxonomy",
      species: "9999999",
    });
  });

  await test("Empty search term", false).run(async () => {
    await client.getOntologyTaxonomy({
      term: "",
      ontology: "GO",
    });
  });

  await test("Missing required parameters", false).run(async () => {
    await client.getOntologyTaxonomy({});
  });
}

// Run tests and exit with appropriate code
async function main(): Promise<void> {
  try {
    await runOntoTaxTests();

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
