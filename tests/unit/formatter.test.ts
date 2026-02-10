import { describe, it, expect } from "vitest";
import { formatToolResponse } from "../../src/utils/formatter.js";

describe("formatToolResponse", () => {
  it("formats error responses without source line", () => {
    const data = { error: "Not found", suggestion: "Check ID", example: "ENSG...", success: false as const };
    const result = formatToolResponse("ensembl_lookup", data);
    expect(result).toContain("Error: Not found");
    expect(result).toContain("Suggestion: Check ID");
    expect(result).toContain("Example: ENSG...");
    expect(result).not.toContain("Source:");
  });

  it("unwraps ProcessedResponse and prepends summary", () => {
    const data = {
      summary: "Found 100 features",
      metadata: { total_results: 100, returned: 50, truncated: true },
      data: [{ id: "feat_1", feature_type: "gene", external_name: "TP53", biotype: "protein_coding" }],
    };
    const result = formatToolResponse("ensembl_feature_overlap", data);
    expect(result).toContain("Found 100 features");
    expect(result).toContain("feat_1");
    expect(result).toContain("Source:");
  });

  describe("ensembl_lookup", () => {
    it("formats single gene lookup", () => {
      const data = {
        id: "ENSG00000141510",
        display_name: "TP53",
        species: "homo_sapiens",
        object_type: "Gene",
        biotype: "protein_coding",
        seq_region_name: "17",
        start: 7661779,
        end: 7687538,
        strand: -1,
      };
      const result = formatToolResponse("ensembl_lookup", data);
      expect(result).toContain("## TP53");
      expect(result).toContain("ENSG00000141510");
      expect(result).toContain("homo_sapiens");
      expect(result).toContain("Source:");
    });

    it("formats xrefs as table", () => {
      const data = [
        { dbname: "HGNC", primary_id: "11998", display_id: "TP53", description: "" },
        { dbname: "Uniprot", primary_id: "P04637", display_id: "P53_HUMAN", description: "" },
      ];
      const result = formatToolResponse("ensembl_lookup", data, { lookup_type: "xrefs", identifier: "ENSG00000141510" });
      expect(result).toContain("Cross-references");
      expect(result).toContain("HGNC");
      expect(result).toContain("Uniprot");
    });
  });

  describe("ensembl_sequence", () => {
    it("formats as FASTA", () => {
      const data = { id: "ENST00000288602", seq: "ATCGATCG", desc: "test sequence" };
      const result = formatToolResponse("ensembl_sequence", data);
      expect(result).toContain(">ENST00000288602");
      expect(result).toContain("ATCGATCG");
    });

    it("wraps FASTA lines at 60 chars", () => {
      const seq = "A".repeat(120);
      const data = { id: "test", seq };
      const result = formatToolResponse("ensembl_sequence", data);
      const lines = result.split("\n");
      // header + 2 sequence lines + source
      expect(lines[1]).toHaveLength(60);
      expect(lines[2]).toHaveLength(60);
    });
  });

  describe("ensembl_meta", () => {
    it("formats ping response", () => {
      const data = { ping: 1 };
      const result = formatToolResponse("ensembl_meta", data, { info_type: "ping" });
      expect(result).toContain("OK");
    });

    it("formats ping down", () => {
      const data = { ping: 0 };
      const result = formatToolResponse("ensembl_meta", data, { info_type: "ping" });
      expect(result).toContain("DOWN");
    });
  });

  describe("ensembl_variation", () => {
    it("formats single variant info", () => {
      const data = {
        name: "rs699",
        source: "dbSNP",
        minor_allele: "T",
        MAF: 0.3,
        most_severe_consequence: "missense_variant",
        mappings: [
          { seq_region_name: "1", start: 230710048, end: 230710048, allele_string: "C/T", strand: 1, assembly_name: "GRCh38" },
        ],
      };
      const result = formatToolResponse("ensembl_variation", data, { analysis_type: "variant_info" });
      expect(result).toContain("## Variant: rs699");
      expect(result).toContain("dbSNP");
      expect(result).toContain("Genomic mappings");
    });
  });

  describe("ensembl_feature_overlap", () => {
    it("formats as table", () => {
      const data = [
        { id: "ENSG00000141510", feature_type: "gene", external_name: "TP53", biotype: "protein_coding", seq_region_name: "17", start: 7661779, end: 7687538, strand: -1 },
      ];
      const result = formatToolResponse("ensembl_feature_overlap", data, { region: "17:7661779-7687538" });
      expect(result).toContain("Overlapping Features");
      expect(result).toContain("TP53");
    });

    it("handles empty array", () => {
      const result = formatToolResponse("ensembl_feature_overlap", []);
      expect(result).toContain("no overlapping features");
    });
  });

  describe("ensembl_mapping", () => {
    it("formats coordinate mappings", () => {
      const data = {
        mappings: [
          {
            original: { seq_region_name: "17", start: 100, end: 200 },
            mapped: { seq_region_name: "17", start: 50000, end: 50100, strand: 1, assembly: "GRCh38" },
          },
        ],
      };
      const result = formatToolResponse("ensembl_mapping", data);
      expect(result).toContain("Coordinate Mapping");
      expect(result).toContain("GRCh38");
    });

    it("handles empty mappings", () => {
      const result = formatToolResponse("ensembl_mapping", { mappings: [] });
      expect(result).toContain("no coordinate mappings");
    });
  });

  it("falls back to JSON for unknown tool", () => {
    const data = { custom: "data" };
    const result = formatToolResponse("unknown_tool", data);
    expect(result).toContain('"custom"');
    expect(result).toContain("Source:");
  });
});
