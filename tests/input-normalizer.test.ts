#!/usr/bin/env node

/**
 * UNIT TESTS for input normalizer
 * Tests format normalization for various Ensembl input types including assembly-aware features
 */

import {
  normalizeAssemblyName,
  normalizeChromosomeName,
  normalizeGenomicRegion,
  normalizeCoordinateSystem,
  normalizeCdnaCoordinates,
  normalizeSpeciesName,
  normalizeGeneIdentifier,
  normalizeHgvsNotation,
  normalizeScaffoldName,
  normalizeEnsemblInputs,
} from "../src/utils/input-normalizer";

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

function assertEqual(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${
        message || "Assertion failed"
      }: expected '${expected}' but got '${actual}'`
    );
  }
}

async function runTests() {
  console.log("🧪 Running Input Normalizer Tests...\n");

  // ========== Assembly Name Tests ==========
  await test("normalizeAssemblyName - GRCh38 variants").run(async () => {
    assertEqual(normalizeAssemblyName("GRCh38"), "GRCh38");
    assertEqual(normalizeAssemblyName("grch38"), "GRCh38");
    assertEqual(normalizeAssemblyName("hg38"), "GRCh38");
    assertEqual(normalizeAssemblyName("HG38"), "GRCh38");
  });

  await test("normalizeAssemblyName - GRCh37 variants").run(async () => {
    assertEqual(normalizeAssemblyName("GRCh37"), "GRCh37");
    assertEqual(normalizeAssemblyName("grch37"), "GRCh37");
    assertEqual(normalizeAssemblyName("hg19"), "GRCh37");
    assertEqual(normalizeAssemblyName("HG19"), "GRCh37");
  });

  // ========== Chromosome Name Tests ==========
  await test("normalizeChromosomeName - chr prefixes").run(async () => {
    assertEqual(normalizeChromosomeName("chr17"), "17");
    assertEqual(normalizeChromosomeName("chromosome17"), "17");
    assertEqual(normalizeChromosomeName("CHR17"), "17");
    assertEqual(normalizeChromosomeName("17"), "17");
  });

  await test("normalizeChromosomeName - mitochondrial variations").run(
    async () => {
      assertEqual(normalizeChromosomeName("MT"), "MT");
      assertEqual(normalizeChromosomeName("M"), "MT");
      assertEqual(normalizeChromosomeName("chrM"), "MT");
      assertEqual(normalizeChromosomeName("chrMT"), "MT");
      assertEqual(normalizeChromosomeName("mitochondrial"), "MT");
      assertEqual(normalizeChromosomeName("mito"), "MT");
    }
  );

  await test("normalizeChromosomeName - sex chromosomes").run(async () => {
    assertEqual(normalizeChromosomeName("X"), "X");
    assertEqual(normalizeChromosomeName("chrX"), "X");
    assertEqual(normalizeChromosomeName("Y"), "Y");
    assertEqual(normalizeChromosomeName("chrY"), "Y");
  });

  await test("normalizeChromosomeName - pseudoautosomal regions").run(
    async () => {
      assertEqual(normalizeChromosomeName("PAR1"), "PAR1");
      assertEqual(normalizeChromosomeName("PAR_1"), "PAR1");
      assertEqual(normalizeChromosomeName("PAR#1"), "PAR1");
      assertEqual(normalizeChromosomeName("PAR2"), "PAR2");
    }
  );

  // ========== Genomic Region Tests ==========
  await test("normalizeGenomicRegion - basic formats").run(async () => {
    assertEqual(
      normalizeGenomicRegion("chr17:43000000-44000000"),
      "17:43000000-44000000"
    );
    assertEqual(
      normalizeGenomicRegion("chromosome17:43000000-44000000"),
      "17:43000000-44000000"
    );
    assertEqual(
      normalizeGenomicRegion("17:43000000-44000000"),
      "17:43000000-44000000"
    );
  });

  await test("normalizeGenomicRegion - with spaces").run(async () => {
    assertEqual(
      normalizeGenomicRegion("17 : 43000000 - 44000000"),
      "17:43000000-44000000"
    );
    assertEqual(
      normalizeGenomicRegion("chr17 : 43000000 - 44000000"),
      "17:43000000-44000000"
    );
  });

  await test("normalizeGenomicRegion - with assembly context").run(async () => {
    assertEqual(
      normalizeGenomicRegion("chrMT:1000-2000", "GRCh38"),
      "MT:1000-2000"
    );
    assertEqual(
      normalizeGenomicRegion("chrX:1000000-2000000", "GRCh37"),
      "X:1000000-2000000"
    );
  });

  // ========== Coordinate System Tests ==========
  await test("normalizeCoordinateSystem - zero to one based").run(async () => {
    const result = normalizeCoordinateSystem(99, 200, "zero-based");
    assertEqual(result.start, 100);
    assertEqual(result.end, 200);
  });

  await test("normalizeCoordinateSystem - one based unchanged").run(
    async () => {
      const result = normalizeCoordinateSystem(100, 200, "one-based");
      assertEqual(result.start, 100);
      assertEqual(result.end, 200);
    }
  );

  // ========== cDNA Coordinates Tests ==========
  await test("normalizeCdnaCoordinates - various formats").run(async () => {
    assertEqual(normalizeCdnaCoordinates("100..200"), "100-200");
    assertEqual(normalizeCdnaCoordinates("c.100..200"), "100-200");
    assertEqual(normalizeCdnaCoordinates("100 to 200"), "100-200");
    assertEqual(normalizeCdnaCoordinates("100→200"), "100-200");
  });

  // ========== Species Name Tests ==========
  await test("normalizeSpeciesName - common mappings").run(async () => {
    assertEqual(normalizeSpeciesName("human"), "homo_sapiens");
    assertEqual(normalizeSpeciesName("mouse"), "mus_musculus");
    assertEqual(normalizeSpeciesName("fruit fly"), "drosophila_melanogaster");
    assertEqual(normalizeSpeciesName("worm"), "caenorhabditis_elegans");
  });

  await test("normalizeSpeciesName - assembly context defaults").run(
    async () => {
      assertEqual(normalizeSpeciesName("", "GRCh38"), "homo_sapiens");
      assertEqual(normalizeSpeciesName("", "hg19"), "homo_sapiens");
    }
  );

  // ========== Gene Identifier Tests ==========
  await test("normalizeGeneIdentifier - preserve case sensitivity").run(
    async () => {
      assertEqual(normalizeGeneIdentifier("TP53"), "TP53");
      assertEqual(normalizeGeneIdentifier("BRCA1"), "BRCA1");
      assertEqual(normalizeGeneIdentifier("  EGFR  "), "EGFR");
    }
  );

  await test("normalizeGeneIdentifier - variant IDs unchanged").run(
    async () => {
      assertEqual(normalizeGeneIdentifier("rs699"), "rs699");
      assertEqual(normalizeGeneIdentifier("COSM476"), "COSM476");
      assertEqual(
        normalizeGeneIdentifier("ENSP00000288602"),
        "ENSP00000288602"
      );
    }
  );

  // ========== HGVS Notation Tests ==========
  await test("normalizeHgvsNotation - basic formatting").run(async () => {
    assertEqual(
      normalizeHgvsNotation("NM_000546.6 : c.215C>G"),
      "NM_000546.6:c.215C>G"
    );
    assertEqual(
      normalizeHgvsNotation("NM_000546.6 > c.215C>G"),
      "NM_000546.6>c.215C>G"
    );
  });

  await test("normalizeHgvsNotation - assembly-specific references").run(
    async () => {
      assertEqual(
        normalizeHgvsNotation("NM_000546:c.215C>G", "GRCh38"),
        "NM_000546.6:c.215C>G"
      );
      assertEqual(
        normalizeHgvsNotation("NM_000546.6:c.215C>G", "GRCh37"),
        "NM_000546.5:c.215C>G"
      );
    }
  );

  // ========== Scaffold Name Tests ==========
  await test("normalizeScaffoldName - patch naming").run(async () => {
    assertEqual(
      normalizeScaffoldName("CHR_HSCHR1_1_CTG1", "GRCh38"),
      "chr1_patch_1_CTG1"
    );
    assertEqual(
      normalizeScaffoldName("ALT_REF_LOCI_1_scaffold", "GRCh38"),
      "ALT_REF_LOCI_1:scaffold"
    );
  });

  // ========== Integration Tests ==========
  await test("normalizeEnsemblInputs - full integration").run(async () => {
    const input = {
      assembly: "hg38",
      species: "human",
      region: "chr17:43,000,000-44,000,000",
      gene_id: "  TP53  ",
      hgvs: "NM_000546 : c.215C>G",
    };

    const result = normalizeEnsemblInputs(input);

    assertEqual(result.assembly, "GRCh38");
    assertEqual(result.species, "homo_sapiens");
    assertEqual(result.region, "17:43000000-44000000");
    assertEqual(result.gene_id, "TP53");
    assertEqual(result.hgvs, "NM_000546.6:c.215C>G");
  });

  await test("normalizeEnsemblInputs - coordinate system conversion").run(
    async () => {
      const input = {
        start: 99,
        end: 200,
        coordinate_system: "zero-based",
      };

      const result = normalizeEnsemblInputs(input);

      assertEqual(result.start, 100);
      assertEqual(result.end, 200);
      assertEqual(result.coordinate_system, undefined); // Should be removed
    }
  );

  // ========== Summary ==========
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📋 Total: ${totalTests}`);

  if (failedTests === 0) {
    console.log(`\n🎉 All tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n💥 ${failedTests} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(console.error);
