#!/usr/bin/env node

/**
 * UNIT TESTS for input validator
 * Tests pre-flight validation for Ensembl MCP tools
 */

import {
  validateEnsemblId,
  validateRegion,
  validateSpecies,
  validateVariantId,
  validateHgvsNotation,
  validateProteinId,
  validateSequenceType,
  validateBatchArray,
  validateToolInput,
} from "../src/utils/input-validator.js";

// Test framework (matches existing pattern)
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name: string) {
  return {
    async run(testFunction: () => Promise<void>) {
      totalTests++;
      console.log(`\n  ${name}`);
      try {
        await testFunction();
        passedTests++;
        console.log(`  PASS`);
      } catch (error: unknown) {
        failedTests++;
        console.log(
          `  FAIL - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertValid(result: { valid: boolean; message?: string }): void {
  if (!result.valid) {
    throw new Error(`Expected valid but got: ${result.message}`);
  }
}

function assertInvalid(
  result: { valid: boolean; message?: string },
  expectedSubstring?: string
): void {
  if (result.valid) {
    throw new Error("Expected invalid but got valid");
  }
  if (expectedSubstring && !result.message?.includes(expectedSubstring)) {
    throw new Error(
      `Expected message to contain '${expectedSubstring}' but got: '${result.message}'`
    );
  }
}

async function runTests() {
  console.log("Running Input Validator Tests...\n");

  // ========== validateEnsemblId ==========
  console.log("--- validateEnsemblId ---");

  await test("valid Ensembl gene ID").run(async () => {
    assertValid(validateEnsemblId("ENSG00000141510"));
  });

  await test("valid Ensembl transcript ID").run(async () => {
    assertValid(validateEnsemblId("ENST00000288602"));
  });

  await test("valid Ensembl protein ID").run(async () => {
    assertValid(validateEnsemblId("ENSP00000288602"));
  });

  await test("valid Ensembl ID with version").run(async () => {
    assertValid(validateEnsemblId("ENST00000288602.6"));
  });

  await test("valid species-prefixed Ensembl ID").run(async () => {
    assertValid(validateEnsemblId("ENSMUSG00000017843"));
  });

  await test("gene symbol passes through").run(async () => {
    assertValid(validateEnsemblId("BRCA1"));
  });

  await test("gene symbol TP53 passes through").run(async () => {
    assertValid(validateEnsemblId("TP53"));
  });

  await test("truncated Ensembl ID rejected").run(async () => {
    assertInvalid(validateEnsemblId("ENSG123"), "doesn't match");
  });

  await test("malformed Ensembl ID rejected").run(async () => {
    assertInvalid(validateEnsemblId("ENSXYZ00000141510"), "doesn't match");
  });

  await test("empty string rejected").run(async () => {
    assertInvalid(validateEnsemblId(""), "required");
  });

  // ========== validateRegion ==========
  console.log("\n--- validateRegion ---");

  await test("valid region").run(async () => {
    assertValid(validateRegion("17:7565096-7590856"));
  });

  await test("valid X chromosome region").run(async () => {
    assertValid(validateRegion("X:1000000-2000000"));
  });

  await test("invalid region format - missing colon").run(async () => {
    assertInvalid(validateRegion("17-7565096-7590856"), "Invalid region");
  });

  await test("invalid region format - commas in numbers").run(async () => {
    assertInvalid(validateRegion("17:7,565,096-7,590,856"), "Invalid region");
  });

  await test("start >= end rejected").run(async () => {
    assertInvalid(validateRegion("17:2000-1000"), "must be less than");
  });

  await test("equal start and end rejected").run(async () => {
    assertInvalid(validateRegion("17:1000-1000"), "must be less than");
  });

  await test("large region passes with warning").run(async () => {
    const result = validateRegion("1:1-10000000");
    assert(result.valid === true, "Should be valid");
    assert(result.message !== undefined, "Should have a warning message");
    assert(result.message!.includes("Mb"), "Warning should mention size");
  });

  await test("empty string rejected").run(async () => {
    assertInvalid(validateRegion(""), "required");
  });

  // ========== validateSpecies ==========
  console.log("\n--- validateSpecies ---");

  await test("known species passes").run(async () => {
    assertValid(validateSpecies("homo_sapiens"));
  });

  await test("known alias passes").run(async () => {
    assertValid(validateSpecies("human"));
  });

  await test("drosophila alias passes").run(async () => {
    assertValid(validateSpecies("drosophila"));
  });

  await test("empty/null species passes (optional)").run(async () => {
    assertValid(validateSpecies(""));
  });

  await test("binomial format passes through").run(async () => {
    assertValid(validateSpecies("arabidopsis_thaliana"));
  });

  await test("fuzzy match suggests correction").run(async () => {
    const result = validateSpecies("humanx");
    assertInvalid(result, "Did you mean");
    assert(
      result.message!.includes("homo_sapiens"),
      "Should suggest homo_sapiens in message"
    );
  });

  await test("close misspelling gets suggestion").run(async () => {
    const result = validateSpecies("muose");
    assertInvalid(result, "Did you mean");
  });

  await test("completely unknown single word rejected").run(async () => {
    assertInvalid(validateSpecies("xyzabc"), "Unknown species");
  });

  // ========== validateVariantId ==========
  console.log("\n--- validateVariantId ---");

  await test("valid rs ID").run(async () => {
    assertValid(validateVariantId("rs699"));
  });

  await test("valid COSM ID").run(async () => {
    assertValid(validateVariantId("COSM476"));
  });

  await test("valid COSV ID").run(async () => {
    assertValid(validateVariantId("COSV12345"));
  });

  await test("non-standard variant ID passes through").run(async () => {
    assertValid(validateVariantId("some_custom_variant"));
  });

  await test("malformed rs ID rejected").run(async () => {
    assertInvalid(validateVariantId("rs12abc"), "unexpected characters");
  });

  await test("malformed COSM ID rejected").run(async () => {
    assertInvalid(validateVariantId("COSMabc"), "unexpected characters");
  });

  await test("empty string rejected").run(async () => {
    assertInvalid(validateVariantId(""), "required");
  });

  // ========== validateHgvsNotation ==========
  console.log("\n--- validateHgvsNotation ---");

  await test("valid HGVS notation").run(async () => {
    assertValid(validateHgvsNotation("ENST00000288602.6:c.1799T>A"));
  });

  await test("valid genomic HGVS").run(async () => {
    assertValid(validateHgvsNotation("17:g.7579472G>C"));
  });

  await test("missing colon rejected").run(async () => {
    assertInvalid(validateHgvsNotation("ENST00000288602"), "doesn't look like");
  });

  await test("empty string rejected").run(async () => {
    assertInvalid(validateHgvsNotation(""), "required");
  });

  // ========== validateProteinId ==========
  console.log("\n--- validateProteinId ---");

  await test("valid protein ID").run(async () => {
    assertValid(validateProteinId("ENSP00000288602"));
  });

  await test("gene ID rejected as protein").run(async () => {
    assertInvalid(validateProteinId("ENSG00000141510"), "not a protein ID");
  });

  await test("non-Ensembl ID passes through").run(async () => {
    assertValid(validateProteinId("P04637"));
  });

  await test("empty string rejected").run(async () => {
    assertInvalid(validateProteinId(""), "required");
  });

  // ========== validateSequenceType ==========
  console.log("\n--- validateSequenceType ---");

  await test("valid types pass").run(async () => {
    assertValid(validateSequenceType("genomic"));
    assertValid(validateSequenceType("cdna"));
    assertValid(validateSequenceType("cds"));
    assertValid(validateSequenceType("protein"));
  });

  await test("invalid type rejected").run(async () => {
    assertInvalid(validateSequenceType("mrna"), "Invalid sequence type");
    assert(
      validateSequenceType("mrna").suggestion!.includes("genomic, cdna, cds, protein"),
      "Should list valid types"
    );
  });

  await test("empty/null passes (optional)").run(async () => {
    assertValid(validateSequenceType(""));
  });

  // ========== validateBatchArray ==========
  console.log("\n--- validateBatchArray ---");

  await test("valid batch array").run(async () => {
    assertValid(
      validateBatchArray(["rs699", "rs1042779"], validateVariantId, "variant_id")
    );
  });

  await test("empty array rejected").run(async () => {
    assertInvalid(
      validateBatchArray([], validateVariantId, "variant_id"),
      "must not be empty"
    );
  });

  await test("oversized array rejected").run(async () => {
    const big = Array.from({ length: 201 }, (_, i) => `rs${i}`);
    assertInvalid(
      validateBatchArray(big, validateVariantId, "variant_id"),
      "maximum is 200"
    );
  });

  await test("partially invalid array reports errors").run(async () => {
    const result = validateBatchArray(
      ["rs699", "rs12abc", "rs100"],
      validateVariantId,
      "variant_id"
    );
    assertInvalid(result, "Invalid items");
    assert(result.message!.includes("[1]"), "Should identify index of bad item");
  });

  await test("non-array rejected").run(async () => {
    assertInvalid(
      validateBatchArray("not_array" as any, validateVariantId, "variant_id"),
      "must be an array"
    );
  });

  // ========== validateToolInput — per-tool ==========
  console.log("\n--- validateToolInput (per-tool) ---");

  await test("ensembl_lookup — missing identifier").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_lookup", {}),
      "'identifier' is required"
    );
  });

  await test("ensembl_lookup — truncated Ensembl ID").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_lookup", { identifier: "ENSG123" }),
      "doesn't match"
    );
  });

  await test("ensembl_lookup — valid gene symbol").run(async () => {
    assertValid(
      validateToolInput("ensembl_lookup", { identifier: "BRCA1" })
    );
  });

  await test("ensembl_lookup — bad species").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_lookup", {
        identifier: "BRCA1",
        species: "humanx",
      }),
      "Did you mean"
    );
  });

  await test("ensembl_feature_overlap — missing both region and feature_id").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_feature_overlap", { species: "homo_sapiens" }),
      "Either 'region' or 'feature_id'"
    );
  });

  await test("ensembl_feature_overlap — valid region").run(async () => {
    assertValid(
      validateToolInput("ensembl_feature_overlap", { region: "17:7565096-7590856" })
    );
  });

  await test("ensembl_sequence — invalid sequence_type").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_sequence", {
        identifier: "ENSG00000141510",
        sequence_type: "mrna",
      }),
      "Invalid sequence type"
    );
  });

  await test("ensembl_sequence — valid request").run(async () => {
    assertValid(
      validateToolInput("ensembl_sequence", {
        identifier: "ENSG00000141510",
        sequence_type: "protein",
      })
    );
  });

  await test("ensembl_variation — missing all required params").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_variation", { species: "homo_sapiens" }),
      "One of 'variant_id'"
    );
  });

  await test("ensembl_variation — valid variant").run(async () => {
    assertValid(
      validateToolInput("ensembl_variation", { variant_id: "rs699" })
    );
  });

  await test("ensembl_variation — bad species").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_variation", {
        variant_id: "rs699",
        species: "humanx",
      }),
      "Did you mean"
    );
  });

  await test("ensembl_variation — batch variant IDs").run(async () => {
    assertValid(
      validateToolInput("ensembl_variation", {
        variant_id: ["rs699", "rs1042779"],
      })
    );
  });

  await test("ensembl_variation — batch with bad items").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_variation", {
        variant_id: ["rs699", "rsABC"],
      }),
      "Invalid items"
    );
  });

  await test("ensembl_meta — missing required params").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_meta", {}),
      "Either 'info_type' or 'archive_id'"
    );
  });

  await test("ensembl_meta — invalid info_type").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_meta", { info_type: "invalid_type" }),
      "Invalid info_type"
    );
  });

  await test("ensembl_meta — valid info_type").run(async () => {
    assertValid(
      validateToolInput("ensembl_meta", { info_type: "species" })
    );
  });

  await test("ensembl_mapping — missing coordinates").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_mapping", { mapping_type: "cdna" }),
      "'coordinates' is required"
    );
  });

  await test("ensembl_mapping — invalid mapping_type").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_mapping", {
        coordinates: "100..200",
        mapping_type: "invalid",
      }),
      "Invalid mapping_type"
    );
  });

  await test("ensembl_compara — missing required params").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_compara", { analysis_type: "homology" }),
      "One of 'gene_id'"
    );
  });

  await test("ensembl_compara — valid request").run(async () => {
    assertValid(
      validateToolInput("ensembl_compara", {
        gene_id: "ENSG00000141510",
        analysis_type: "homology",
      })
    );
  });

  await test("ensembl_protein_features — missing protein_id").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_protein_features", {}),
      "'protein_id' is required"
    );
  });

  await test("ensembl_protein_features — gene ID rejected").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_protein_features", {
        protein_id: "ENSG00000141510",
      }),
      "not a protein ID"
    );
  });

  await test("ensembl_regulatory — missing all params").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_regulatory", {}),
      "One of 'region'"
    );
  });

  await test("ensembl_ontotax — missing all params").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_ontotax", {}),
      "One of 'term'"
    );
  });

  await test("ensembl_ontotax — term without ontology").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_ontotax", { term: "protein binding" }),
      "'ontology' is required"
    );
  });

  await test("ensembl_ontotax — invalid ontology").run(async () => {
    assertInvalid(
      validateToolInput("ensembl_ontotax", {
        term: "protein binding",
        ontology: "INVALID",
      }),
      "Invalid ontology"
    );
  });

  await test("ensembl_ontotax — valid request").run(async () => {
    assertValid(
      validateToolInput("ensembl_ontotax", {
        term: "protein binding",
        ontology: "GO",
      })
    );
  });

  await test("unknown tool passes through").run(async () => {
    assertValid(validateToolInput("unknown_tool", { anything: "goes" }));
  });

  // ========== Summary ==========
  console.log(`\nTest Results:`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Total: ${totalTests}`);

  if (failedTests === 0) {
    console.log(`\nAll tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n${failedTests} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(console.error);
