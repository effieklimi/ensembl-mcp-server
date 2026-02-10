import { describe, it, expect } from "vitest";
import { processResponse } from "../../src/utils/response-processor.js";

describe("processResponse", () => {
  it("returns data unchanged when fullResponse is true", () => {
    const data = { foo: "bar" };
    expect(processResponse("ensembl_lookup", data, { fullResponse: true })).toBe(data);
  });

  it("passes through error responses", () => {
    const data = { error: "not found", success: false };
    expect(processResponse("ensembl_lookup", data)).toBe(data);
  });

  describe("sequence truncation", () => {
    it("truncates long string sequences", () => {
      const longSeq = "A".repeat(20000);
      const result = processResponse("ensembl_sequence", longSeq) as string;
      expect(result).toContain("[truncated");
      expect(result.length).toBeLessThan(longSeq.length);
    });

    it("truncates object with long seq property", () => {
      const data = { id: "ENST00000288602", seq: "A".repeat(20000) };
      const result = processResponse("ensembl_sequence", data) as any;
      expect(result.seq).toContain("[truncated");
      expect(result._original_length).toBe(20000);
    });

    it("leaves short sequences unchanged", () => {
      const data = { id: "ENST00000288602", seq: "ATCG" };
      const result = processResponse("ensembl_sequence", data) as any;
      expect(result.seq).toBe("ATCG");
    });
  });

  describe("feature overlap", () => {
    it("truncates large arrays with field selection", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: `feat_${i}`,
        feature_type: "gene",
        seq_region_name: "17",
        start: i * 1000,
        end: i * 1000 + 999,
        strand: 1,
        biotype: "protein_coding",
        external_name: `Gene${i}`,
        extra_field: "should_be_removed",
      }));

      const result = processResponse("ensembl_feature_overlap", data) as any;
      expect(result.metadata.total_results).toBe(100);
      expect(result.metadata.returned).toBe(50);
      expect(result.metadata.truncated).toBe(true);
      expect(result.summary).toContain("100");
      // field selection applied
      expect(result.data[0]).not.toHaveProperty("extra_field");
      expect(result.data[0]).toHaveProperty("id");
    });

    it("returns data unchanged when under limit", () => {
      const data = [{ id: "feat_1", feature_type: "gene" }];
      expect(processResponse("ensembl_feature_overlap", data)).toBe(data);
    });
  });

  describe("meta species", () => {
    it("truncates large species list", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        name: `species_${i}`,
        common_name: `Species ${i}`,
        assembly: "GRCh38",
        taxonomy_id: 9606 + i,
        display_name: `Species ${i}`,
      }));

      const result = processResponse("ensembl_meta", data) as any;
      expect(result.metadata.total_results).toBe(100);
      expect(result.metadata.returned).toBe(50);
      expect(result.metadata.truncated).toBe(true);
    });
  });

  describe("compara gene tree", () => {
    it("flattens gene tree structure", () => {
      const data = {
        tree: {
          children: [
            {
              taxonomy: { scientific_name: "Homo sapiens" },
              gene: { external_name: "TP53" },
              id: "ENSG00000141510",
              sequence: { id: "ENSP00000269305" },
            },
            {
              taxonomy: { scientific_name: "Mus musculus" },
              gene: { external_name: "Trp53" },
              id: "ENSMUSG00000059552",
              sequence: { id: "ENSMUSP00000071902" },
            },
          ],
        },
      };

      const result = processResponse("ensembl_compara", data) as any;
      expect(result.metadata.total_results).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].species).toBe("Homo sapiens");
      expect(result.data[0].gene_symbol).toBe("TP53");
    });
  });

  describe("compara homology", () => {
    it("extracts homologies from nested structure", () => {
      const data = {
        data: [
          {
            homologies: Array.from({ length: 150 }, (_, i) => ({
              type: "ortholog",
              target: { id: `ENSG${i}`, species: `species_${i}` },
            })),
          },
        ],
      };

      const result = processResponse("ensembl_compara", data) as any;
      expect(result.metadata.total_results).toBe(150);
      expect(result.metadata.returned).toBe(100);
      expect(result.metadata.truncated).toBe(true);
    });
  });

  describe("variation VEP", () => {
    it("processes VEP consequences", () => {
      const data = [
        {
          id: "rs699",
          most_severe_consequence: "missense_variant",
          transcript_consequences: [
            {
              gene_symbol: "AGT",
              gene_id: "ENSG00000135744",
              transcript_id: "ENST00000366667",
              consequence_terms: ["missense_variant"],
              impact: "MODERATE",
              biotype: "protein_coding",
              amino_acids: "M/T",
              codons: "aTg/aCg",
              extra_field: "removed",
            },
          ],
          extra: "removed",
        },
      ];

      const result = processResponse("ensembl_variation", data) as any;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("rs699");
      expect(result.data[0].most_severe_consequence).toBe("missense_variant");
      expect(result.data[0].transcript_consequences[0].gene_symbol).toBe("AGT");
      expect(result.data[0].transcript_consequences[0]).not.toHaveProperty("extra_field");
    });
  });

  it("passes through unknown tool data unchanged", () => {
    const data = { anything: "goes" };
    expect(processResponse("unknown_tool", data)).toBe(data);
  });
});
