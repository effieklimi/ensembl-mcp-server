import { describe, it, expect } from "vitest";
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
} from "../../src/utils/input-validator.js";

describe("validateEnsemblId", () => {
  it("accepts valid gene ID", () => {
    expect(validateEnsemblId("ENSG00000141510").valid).toBe(true);
  });

  it("accepts valid transcript ID", () => {
    expect(validateEnsemblId("ENST00000288602").valid).toBe(true);
  });

  it("accepts valid protein ID", () => {
    expect(validateEnsemblId("ENSP00000288602").valid).toBe(true);
  });

  it("accepts ID with version", () => {
    expect(validateEnsemblId("ENST00000288602.6").valid).toBe(true);
  });

  it("accepts species-prefixed ID", () => {
    expect(validateEnsemblId("ENSMUSG00000017843").valid).toBe(true);
  });

  it("passes through gene symbols", () => {
    expect(validateEnsemblId("BRCA1").valid).toBe(true);
    expect(validateEnsemblId("TP53").valid).toBe(true);
  });

  it("rejects truncated Ensembl ID", () => {
    const result = validateEnsemblId("ENSG123");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("doesn't match");
  });

  it("rejects malformed Ensembl ID", () => {
    const result = validateEnsemblId("ENSXYZ00000141510");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("doesn't match");
  });

  it("rejects empty string", () => {
    const result = validateEnsemblId("");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("required");
  });
});

describe("validateRegion", () => {
  it("accepts valid region", () => {
    expect(validateRegion("17:7565096-7590856").valid).toBe(true);
  });

  it("accepts X chromosome region", () => {
    expect(validateRegion("X:1000000-2000000").valid).toBe(true);
  });

  it("rejects missing colon", () => {
    const result = validateRegion("17-7565096-7590856");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid region");
  });

  it("rejects commas in numbers", () => {
    const result = validateRegion("17:7,565,096-7,590,856");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid region");
  });

  it("rejects start >= end", () => {
    const result = validateRegion("17:2000-1000");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("must be less than");
  });

  it("rejects equal start and end", () => {
    const result = validateRegion("17:1000-1000");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("must be less than");
  });

  it("warns on large region", () => {
    const result = validateRegion("1:1-10000000");
    expect(result.valid).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message).toContain("Mb");
  });

  it("rejects empty string", () => {
    const result = validateRegion("");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("required");
  });
});

describe("validateSpecies", () => {
  it("accepts known species", () => {
    expect(validateSpecies("homo_sapiens").valid).toBe(true);
  });

  it("accepts known alias", () => {
    expect(validateSpecies("human").valid).toBe(true);
  });

  it("accepts drosophila alias", () => {
    expect(validateSpecies("drosophila").valid).toBe(true);
  });

  it("passes empty string (optional)", () => {
    expect(validateSpecies("").valid).toBe(true);
  });

  it("passes binomial format through", () => {
    expect(validateSpecies("arabidopsis_thaliana").valid).toBe(true);
  });

  it("suggests correction for fuzzy match", () => {
    const result = validateSpecies("humanx");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Did you mean");
    expect(result.message).toContain("homo_sapiens");
  });

  it("suggests correction for close misspelling", () => {
    const result = validateSpecies("muose");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Did you mean");
  });

  it("rejects completely unknown single word", () => {
    const result = validateSpecies("xyzabc");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Unknown species");
  });
});

describe("validateVariantId", () => {
  it("accepts valid rs ID", () => {
    expect(validateVariantId("rs699").valid).toBe(true);
  });

  it("accepts valid COSM ID", () => {
    expect(validateVariantId("COSM476").valid).toBe(true);
  });

  it("accepts valid COSV ID", () => {
    expect(validateVariantId("COSV12345").valid).toBe(true);
  });

  it("passes non-standard variant ID through", () => {
    expect(validateVariantId("some_custom_variant").valid).toBe(true);
  });

  it("rejects malformed rs ID", () => {
    const result = validateVariantId("rs12abc");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("unexpected characters");
  });

  it("rejects malformed COSM ID", () => {
    const result = validateVariantId("COSMabc");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("unexpected characters");
  });

  it("rejects empty string", () => {
    const result = validateVariantId("");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("required");
  });
});

describe("validateHgvsNotation", () => {
  it("accepts valid HGVS notation", () => {
    expect(validateHgvsNotation("ENST00000288602.6:c.1799T>A").valid).toBe(true);
  });

  it("accepts valid genomic HGVS", () => {
    expect(validateHgvsNotation("17:g.7579472G>C").valid).toBe(true);
  });

  it("rejects missing colon", () => {
    const result = validateHgvsNotation("ENST00000288602");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("doesn't look like");
  });

  it("rejects empty string", () => {
    const result = validateHgvsNotation("");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("required");
  });
});

describe("validateProteinId", () => {
  it("accepts valid protein ID", () => {
    expect(validateProteinId("ENSP00000288602").valid).toBe(true);
  });

  it("rejects gene ID as protein", () => {
    const result = validateProteinId("ENSG00000141510");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("not a protein ID");
  });

  it("passes non-Ensembl ID through", () => {
    expect(validateProteinId("P04637").valid).toBe(true);
  });

  it("rejects empty string", () => {
    const result = validateProteinId("");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("required");
  });
});

describe("validateSequenceType", () => {
  it("accepts valid types", () => {
    expect(validateSequenceType("genomic").valid).toBe(true);
    expect(validateSequenceType("cdna").valid).toBe(true);
    expect(validateSequenceType("cds").valid).toBe(true);
    expect(validateSequenceType("protein").valid).toBe(true);
  });

  it("rejects invalid type with suggestion", () => {
    const result = validateSequenceType("mrna");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid sequence type");
    expect(result.suggestion).toContain("genomic, cdna, cds, protein");
  });

  it("passes empty string (optional)", () => {
    expect(validateSequenceType("").valid).toBe(true);
  });
});

describe("validateBatchArray", () => {
  it("accepts valid batch array", () => {
    expect(validateBatchArray(["rs699", "rs1042779"], validateVariantId, "variant_id").valid).toBe(true);
  });

  it("rejects empty array", () => {
    const result = validateBatchArray([], validateVariantId, "variant_id");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("must not be empty");
  });

  it("rejects oversized array", () => {
    const big = Array.from({ length: 201 }, (_, i) => `rs${i}`);
    const result = validateBatchArray(big, validateVariantId, "variant_id");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("maximum is 200");
  });

  it("reports partially invalid items", () => {
    const result = validateBatchArray(["rs699", "rs12abc", "rs100"], validateVariantId, "variant_id");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid items");
    expect(result.message).toContain("[1]");
  });

  it("rejects non-array", () => {
    const result = validateBatchArray("not_array" as any, validateVariantId, "variant_id");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("must be an array");
  });
});

describe("validateToolInput", () => {
  it("ensembl_lookup - rejects missing identifier", () => {
    const result = validateToolInput("ensembl_lookup", {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("'identifier' is required");
  });

  it("ensembl_lookup - rejects truncated Ensembl ID", () => {
    const result = validateToolInput("ensembl_lookup", { identifier: "ENSG123" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("doesn't match");
  });

  it("ensembl_lookup - accepts valid gene symbol", () => {
    expect(validateToolInput("ensembl_lookup", { identifier: "BRCA1" }).valid).toBe(true);
  });

  it("ensembl_lookup - rejects bad species", () => {
    const result = validateToolInput("ensembl_lookup", { identifier: "BRCA1", species: "humanx" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Did you mean");
  });

  it("ensembl_feature_overlap - rejects missing region and feature_id", () => {
    const result = validateToolInput("ensembl_feature_overlap", { species: "homo_sapiens" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Either 'region' or 'feature_id'");
  });

  it("ensembl_feature_overlap - accepts valid region", () => {
    expect(validateToolInput("ensembl_feature_overlap", { region: "17:7565096-7590856" }).valid).toBe(true);
  });

  it("ensembl_sequence - rejects invalid sequence_type", () => {
    const result = validateToolInput("ensembl_sequence", { identifier: "ENSG00000141510", sequence_type: "mrna" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid sequence type");
  });

  it("ensembl_sequence - accepts valid request", () => {
    expect(validateToolInput("ensembl_sequence", { identifier: "ENSG00000141510", sequence_type: "protein" }).valid).toBe(true);
  });

  it("ensembl_variation - rejects missing required params", () => {
    const result = validateToolInput("ensembl_variation", { species: "homo_sapiens" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("One of 'variant_id'");
  });

  it("ensembl_variation - accepts valid variant", () => {
    expect(validateToolInput("ensembl_variation", { variant_id: "rs699" }).valid).toBe(true);
  });

  it("ensembl_variation - rejects bad species", () => {
    const result = validateToolInput("ensembl_variation", { variant_id: "rs699", species: "humanx" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Did you mean");
  });

  it("ensembl_variation - accepts batch variant IDs", () => {
    expect(validateToolInput("ensembl_variation", { variant_id: ["rs699", "rs1042779"] }).valid).toBe(true);
  });

  it("ensembl_variation - rejects batch with bad items", () => {
    const result = validateToolInput("ensembl_variation", { variant_id: ["rs699", "rsABC"] });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid items");
  });

  it("ensembl_meta - rejects missing required params", () => {
    const result = validateToolInput("ensembl_meta", {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Either 'info_type' or 'archive_id'");
  });

  it("ensembl_meta - rejects invalid info_type", () => {
    const result = validateToolInput("ensembl_meta", { info_type: "invalid_type" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid info_type");
  });

  it("ensembl_meta - accepts valid info_type", () => {
    expect(validateToolInput("ensembl_meta", { info_type: "species" }).valid).toBe(true);
  });

  it("ensembl_mapping - rejects missing coordinates", () => {
    const result = validateToolInput("ensembl_mapping", { mapping_type: "cdna" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("'coordinates' is required");
  });

  it("ensembl_mapping - rejects invalid mapping_type", () => {
    const result = validateToolInput("ensembl_mapping", { coordinates: "100..200", mapping_type: "invalid" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid mapping_type");
  });

  it("ensembl_compara - rejects missing required params", () => {
    const result = validateToolInput("ensembl_compara", { analysis_type: "homology" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("One of 'gene_id'");
  });

  it("ensembl_compara - accepts valid request", () => {
    expect(validateToolInput("ensembl_compara", { gene_id: "ENSG00000141510", analysis_type: "homology" }).valid).toBe(true);
  });

  it("ensembl_protein_features - rejects missing protein_id", () => {
    const result = validateToolInput("ensembl_protein_features", {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("'protein_id' is required");
  });

  it("ensembl_protein_features - rejects gene ID", () => {
    const result = validateToolInput("ensembl_protein_features", { protein_id: "ENSG00000141510" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("not a protein ID");
  });

  it("ensembl_regulatory - rejects missing all params", () => {
    const result = validateToolInput("ensembl_regulatory", {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("One of 'region'");
  });

  it("ensembl_ontotax - rejects missing all params", () => {
    const result = validateToolInput("ensembl_ontotax", {});
    expect(result.valid).toBe(false);
    expect(result.message).toContain("One of 'term'");
  });

  it("ensembl_ontotax - rejects term without ontology", () => {
    const result = validateToolInput("ensembl_ontotax", { term: "protein binding" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("'ontology' is required");
  });

  it("ensembl_ontotax - rejects invalid ontology", () => {
    const result = validateToolInput("ensembl_ontotax", { term: "protein binding", ontology: "INVALID" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid ontology");
  });

  it("ensembl_ontotax - accepts valid request", () => {
    expect(validateToolInput("ensembl_ontotax", { term: "protein binding", ontology: "GO" }).valid).toBe(true);
  });

  it("passes unknown tool through", () => {
    expect(validateToolInput("unknown_tool", { anything: "goes" }).valid).toBe(true);
  });
});
