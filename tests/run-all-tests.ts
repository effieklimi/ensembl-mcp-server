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
  "test-meta.ts",
  "test-lookup.ts",
  "test-sequence.ts",
  "test-feature-overlap.ts",
  "test-regulatory.ts",
  "test-protein-features.ts",
  "test-mapping.ts",
  "test-compara.ts",
  "test-variation.ts",
  "test-ontotax.ts",
];

const testDescriptions: Record<string, string> = {
  "test-meta.ts": "Server metadata, species info, assemblies",
  "test-lookup.ts": "ID/symbol lookup, cross-references, variant recoding",
  "test-sequence.ts": "DNA/RNA/protein sequence retrieval",
  "test-feature-overlap.ts": "Genomic feature overlap queries",
  "test-regulatory.ts": "Regulatory features and binding matrices",
  "test-protein-features.ts": "Protein domains and functional annotations",
  "test-mapping.ts": "Coordinate transformations and assembly lifts",
  "test-compara.ts": "Comparative genomics: homology, gene trees",
  "test-variation.ts": "Variant analysis, VEP, LD, phenotypes",
  "test-ontotax.ts": "Ontology and taxonomy searches",
};

interface TestResult {
  file: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runTest(testFile: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🚀 Running ${testFile}`);
    console.log(`   ${testDescriptions[testFile]}`);
    console.log(`${"=".repeat(80)}`);

    const testPath = join(__dirname, testFile);
    const child = spawn("tsx", [testPath], {
      stdio: "inherit",
    });

    child.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;
      const status = code === 0 ? "✅ PASSED" : "❌ FAILED";
      console.log(
        `\n${status} - ${testFile} completed in ${duration.toFixed(2)}s`
      );
      resolve({
        file: testFile,
        success: code === 0,
        duration: parseFloat(duration.toFixed(2)),
      });
    });

    child.on("error", (error) => {
      const duration = (Date.now() - startTime) / 1000;
      console.log(
        `\n❌ ERROR - ${testFile} failed with error: ${error.message}`
      );
      resolve({
        file: testFile,
        success: false,
        duration: parseFloat(duration.toFixed(2)),
        error: error.message,
      });
    });
  });
}

async function runAllTests(): Promise<void> {
  const startTime = Date.now();
  console.log("🧬 Ensembl MCP Server - Comprehensive Tool Test Suite");
  console.log(`📊 Running tests for ${testFiles.length} tools\n`);

  const results: TestResult[] = [];

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
    const testName = result.file.replace(".ts", "").padEnd(25);
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

  console.log(`\n💡 To run individual tests: tsx tests/<test-name>.ts`);
  console.log("   Example: tsx tests/test-lookup.ts");

  process.exit(failed > 0 ? 1 : 0);
}

// Run the test suite
runAllTests().catch((error: unknown) => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
