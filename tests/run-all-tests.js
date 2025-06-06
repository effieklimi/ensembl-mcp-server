#!/usr/bin/env node

/**
 * Master test runner for all Ensembl MCP tools
 * Runs comprehensive tests for all 10 tools and provides summary
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  "test-meta.js",
  "test-lookup.js",
  "test-sequence.js",
  "test-feature-overlap.js",
  "test-regulatory.js",
  "test-protein-features.js",
  "test-mapping.js",
  "test-compara.js",
  "test-variation.js",
  "test-ontotax.js",
];

const testDescriptions = {
  "test-meta.js": "Server metadata, species info, assemblies",
  "test-lookup.js": "ID/symbol lookup, cross-references, variant recoding",
  "test-sequence.js": "DNA/RNA/protein sequence retrieval",
  "test-feature-overlap.js": "Genomic feature overlap queries",
  "test-regulatory.js": "Regulatory features and binding matrices",
  "test-protein-features.js": "Protein domains and functional annotations",
  "test-mapping.js": "Coordinate transformations and assembly lifts",
  "test-compara.js": "Comparative genomics: homology, gene trees",
  "test-variation.js": "Variant analysis, VEP, LD, phenotypes",
  "test-ontotax.js": "Ontology and taxonomy searches",
};

async function runTest(testFile) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🚀 Running ${testFile}`);
    console.log(`   ${testDescriptions[testFile]}`);
    console.log(`${"=".repeat(80)}`);

    const testPath = join(__dirname, testFile);
    const child = spawn("node", [testPath], {
      stdio: "inherit",
      env: { ...process.env, NODE_OPTIONS: "--loader=ts-node/esm" },
    });

    child.on("close", (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const status = code === 0 ? "✅ PASSED" : "❌ FAILED";
      console.log(`\n${status} - ${testFile} completed in ${duration}s`);
      resolve({
        file: testFile,
        success: code === 0,
        duration: parseFloat(duration),
      });
    });

    child.on("error", (error) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `\n❌ ERROR - ${testFile} failed with error: ${error.message}`
      );
      resolve({
        file: testFile,
        success: false,
        duration: parseFloat(duration),
        error: error.message,
      });
    });
  });
}

async function runAllTests() {
  const startTime = Date.now();
  console.log("🧬 Ensembl MCP Server - Comprehensive Tool Test Suite");
  console.log(`📊 Running tests for ${testFiles.length} tools\n`);

  const results = [];

  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }

  // Summary report
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n${"=".repeat(80)}`);
  console.log("📊 TEST SUMMARY REPORT");
  console.log(`${"=".repeat(80)}`);
  console.log(`Total tests run: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalDuration}s`);
  console.log(
    `📈 Success rate: ${((passed / results.length) * 100).toFixed(1)}%`
  );

  console.log(`\n📋 Individual Test Results:`);
  results.forEach((result) => {
    const status = result.success ? "✅" : "❌";
    const duration = result.duration.toFixed(2).padStart(6);
    const testName = result.file.replace(".js", "").padEnd(25);
    console.log(`  ${status} ${testName} ${duration}s`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  if (failed > 0) {
    console.log(
      `\n⚠️  ${failed} test(s) failed. Check the output above for details.`
    );
    console.log("   Common issues:");
    console.log("   - Network connectivity to rest.ensembl.org");
    console.log("   - Rate limiting (tests include delays)");
    console.log("   - Invalid test data or API changes");
  } else {
    console.log(
      `\n🎉 All tests passed! The Ensembl MCP server is working correctly.`
    );
  }

  console.log(`\n💡 To run individual tests: node tests/<test-name>.js`);
  console.log("   Example: node tests/test-lookup.js");

  process.exit(failed > 0 ? 1 : 0);
}

// Run the test suite
runAllTests().catch((error) => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
