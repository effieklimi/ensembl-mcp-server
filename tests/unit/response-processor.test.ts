import { describe, it, expect } from "vitest";
import { processResponse } from "../../src/utils/response-processor.js";

describe("processResponse", () => {
  it("returns wrapped raw response when fullResponse is true", () => {
    const data = { foo: "bar" };
    const result = processResponse("ensembl_lookup", data, { fullResponse: true }) as any;
    expect(result.raw_response).toBe(true);
    expect(result.data).toBe(data);
    expect(result.note).toContain("ONLY the JSON");
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

  describe("pagination", () => {
    const makeItems = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `feat_${i}`,
        feature_type: "gene",
        seq_region_name: "17",
        start: i * 1000,
        end: i * 1000 + 999,
        strand: 1,
        biotype: "protein_coding",
        external_name: `Gene${i}`,
      }));

    it("page 1 returns first N items with correct metadata", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 1,
        pageSize: 25,
      }) as any;
      expect(result.metadata.total_results).toBe(100);
      expect(result.metadata.returned).toBe(25);
      expect(result.metadata.page).toBe(1);
      expect(result.metadata.page_size).toBe(25);
      expect(result.metadata.total_pages).toBe(4);
      expect(result.metadata.has_next).toBe(true);
      expect(result.data[0].id).toBe("feat_0");
      expect(result.data[24].id).toBe("feat_24");
    });

    it("page 2 returns correct offset slice", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 2,
        pageSize: 25,
      }) as any;
      expect(result.metadata.page).toBe(2);
      expect(result.metadata.returned).toBe(25);
      expect(result.data[0].id).toBe("feat_25");
      expect(result.data[24].id).toBe("feat_49");
    });

    it("last page has has_next: false", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 4,
        pageSize: 25,
      }) as any;
      expect(result.metadata.page).toBe(4);
      expect(result.metadata.has_next).toBe(false);
      expect(result.metadata.total_pages).toBe(4);
      expect(result.data[0].id).toBe("feat_75");
    });

    it("out-of-range page returns empty data with correct metadata", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 10,
        pageSize: 25,
      }) as any;
      expect(result.metadata.total_results).toBe(100);
      expect(result.metadata.returned).toBe(0);
      expect(result.metadata.total_pages).toBe(4);
      expect(result.metadata.has_next).toBe(false);
      expect(result.data).toEqual([]);
    });

    it("field filtering works with pagination", () => {
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
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 1,
        pageSize: 10,
      }) as any;
      expect(result.data).toHaveLength(10);
      expect(result.data[0]).not.toHaveProperty("extra_field");
      expect(result.data[0]).toHaveProperty("id");
    });

    it("no page/pageSize is backward-compatible", () => {
      const data = makeItems(30);
      // Under default limit of 50, returns raw data
      const result = processResponse("ensembl_feature_overlap", data);
      expect(result).toBe(data);
    });

    it("total_pages edge case: 0 items", () => {
      const data: unknown[] = [];
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 1,
        pageSize: 25,
      }) as any;
      expect(result.metadata.total_results).toBe(0);
      expect(result.metadata.total_pages).toBe(0);
      expect(result.metadata.has_next).toBe(false);
      expect(result.data).toEqual([]);
    });

    it("total_pages edge case: 1 item", () => {
      const data = makeItems(1);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 1,
        pageSize: 25,
      }) as any;
      expect(result.metadata.total_results).toBe(1);
      expect(result.metadata.returned).toBe(1);
      expect(result.metadata.total_pages).toBe(1);
      expect(result.metadata.has_next).toBe(false);
    });

    it("total_pages edge case: exact multiple", () => {
      const data = makeItems(50);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 1,
        pageSize: 25,
      }) as any;
      expect(result.metadata.total_pages).toBe(2);
      expect(result.metadata.has_next).toBe(true);
    });

    it("page_size supersedes max_results", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        maxResults: 10,
        page: 1,
        pageSize: 30,
      }) as any;
      expect(result.metadata.returned).toBe(30);
      expect(result.metadata.page_size).toBe(30);
      expect(result.metadata.total_pages).toBe(4);
    });

    it("works with ensembl_variation", () => {
      const data = Array.from({ length: 80 }, (_, i) => ({
        id: `var_${i}`,
        type: "variant",
      }));
      const result = processResponse("ensembl_variation", data, {
        page: 2,
        pageSize: 20,
      }) as any;
      expect(result.metadata.page).toBe(2);
      expect(result.metadata.total_results).toBe(80);
      expect(result.metadata.returned).toBe(20);
      expect(result.data[0].id).toBe("var_20");
    });

    it("works with ensembl_meta", () => {
      const data = Array.from({ length: 60 }, (_, i) => ({
        name: `species_${i}`,
        common_name: `Species ${i}`,
      }));
      const result = processResponse("ensembl_meta", data, {
        page: 3,
        pageSize: 20,
      }) as any;
      expect(result.metadata.page).toBe(3);
      expect(result.metadata.total_pages).toBe(3);
      expect(result.metadata.has_next).toBe(false);
    });

    it("works with ensembl_regulatory", () => {
      const data = Array.from({ length: 75 }, (_, i) => ({
        id: `reg_${i}`,
        feature_type: "RegulatoryFeature",
      }));
      const result = processResponse("ensembl_regulatory", data, {
        page: 1,
        pageSize: 25,
      }) as any;
      expect(result.metadata.page).toBe(1);
      expect(result.metadata.total_results).toBe(75);
      expect(result.metadata.total_pages).toBe(3);
    });

    it("works with ensembl_compara homology", () => {
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
      const result = processResponse("ensembl_compara", data, {
        page: 2,
        pageSize: 50,
      }) as any;
      expect(result.metadata.page).toBe(2);
      expect(result.metadata.total_results).toBe(150);
      expect(result.metadata.returned).toBe(50);
      expect(result.metadata.has_next).toBe(true);
    });

    it("summary message includes page info when paginated", () => {
      const data = makeItems(100);
      const result = processResponse("ensembl_feature_overlap", data, {
        page: 2,
        pageSize: 25,
      }) as any;
      expect(result.summary).toContain("page 2 of 4");
    });
  });
});
