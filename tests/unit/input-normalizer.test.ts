import { describe, it, expect } from "vitest";
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
} from "../../src/utils/input-normalizer.js";

describe("normalizeAssemblyName", () => {
  it("normalizes GRCh38 variants", () => {
    expect(normalizeAssemblyName("GRCh38")).toBe("GRCh38");
    expect(normalizeAssemblyName("grch38")).toBe("GRCh38");
    expect(normalizeAssemblyName("hg38")).toBe("GRCh38");
    expect(normalizeAssemblyName("HG38")).toBe("GRCh38");
  });

  it("normalizes GRCh37 variants", () => {
    expect(normalizeAssemblyName("GRCh37")).toBe("GRCh37");
    expect(normalizeAssemblyName("grch37")).toBe("GRCh37");
    expect(normalizeAssemblyName("hg19")).toBe("GRCh37");
    expect(normalizeAssemblyName("HG19")).toBe("GRCh37");
  });
});

describe("normalizeChromosomeName", () => {
  it("strips chr prefixes", () => {
    expect(normalizeChromosomeName("chr17")).toBe("17");
    expect(normalizeChromosomeName("chromosome17")).toBe("17");
    expect(normalizeChromosomeName("CHR17")).toBe("17");
    expect(normalizeChromosomeName("17")).toBe("17");
  });

  it("normalizes mitochondrial variations", () => {
    expect(normalizeChromosomeName("MT")).toBe("MT");
    expect(normalizeChromosomeName("M")).toBe("MT");
    expect(normalizeChromosomeName("chrM")).toBe("MT");
    expect(normalizeChromosomeName("chrMT")).toBe("MT");
    expect(normalizeChromosomeName("mitochondrial")).toBe("MT");
    expect(normalizeChromosomeName("mito")).toBe("MT");
  });

  it("normalizes sex chromosomes", () => {
    expect(normalizeChromosomeName("X")).toBe("X");
    expect(normalizeChromosomeName("chrX")).toBe("X");
    expect(normalizeChromosomeName("Y")).toBe("Y");
    expect(normalizeChromosomeName("chrY")).toBe("Y");
  });

  it("normalizes pseudoautosomal regions", () => {
    expect(normalizeChromosomeName("PAR1")).toBe("PAR1");
    expect(normalizeChromosomeName("PAR_1")).toBe("PAR1");
    expect(normalizeChromosomeName("PAR#1")).toBe("PAR1");
    expect(normalizeChromosomeName("PAR2")).toBe("PAR2");
  });
});

describe("normalizeGenomicRegion", () => {
  it("normalizes basic formats", () => {
    expect(normalizeGenomicRegion("chr17:43000000-44000000")).toBe("17:43000000-44000000");
    expect(normalizeGenomicRegion("chromosome17:43000000-44000000")).toBe("17:43000000-44000000");
    expect(normalizeGenomicRegion("17:43000000-44000000")).toBe("17:43000000-44000000");
  });

  it("strips spaces", () => {
    expect(normalizeGenomicRegion("17 : 43000000 - 44000000")).toBe("17:43000000-44000000");
    expect(normalizeGenomicRegion("chr17 : 43000000 - 44000000")).toBe("17:43000000-44000000");
  });

  it("works with assembly context", () => {
    expect(normalizeGenomicRegion("chrMT:1000-2000", "GRCh38")).toBe("MT:1000-2000");
    expect(normalizeGenomicRegion("chrX:1000000-2000000", "GRCh37")).toBe("X:1000000-2000000");
  });
});

describe("normalizeCoordinateSystem", () => {
  it("converts zero-based to one-based", () => {
    const result = normalizeCoordinateSystem(99, 200, "zero-based");
    expect(result.start).toBe(100);
    expect(result.end).toBe(200);
  });

  it("leaves one-based unchanged", () => {
    const result = normalizeCoordinateSystem(100, 200, "one-based");
    expect(result.start).toBe(100);
    expect(result.end).toBe(200);
  });
});

describe("normalizeCdnaCoordinates", () => {
  it("normalizes various formats", () => {
    expect(normalizeCdnaCoordinates("100..200")).toBe("100-200");
    expect(normalizeCdnaCoordinates("c.100..200")).toBe("100-200");
    expect(normalizeCdnaCoordinates("100 to 200")).toBe("100-200");
  });
});

describe("normalizeSpeciesName", () => {
  it("maps common names", () => {
    expect(normalizeSpeciesName("human")).toBe("homo_sapiens");
    expect(normalizeSpeciesName("mouse")).toBe("mus_musculus");
    expect(normalizeSpeciesName("fruit fly")).toBe("drosophila_melanogaster");
    expect(normalizeSpeciesName("worm")).toBe("caenorhabditis_elegans");
  });

  it("defaults species from assembly context", () => {
    expect(normalizeSpeciesName("", "GRCh38")).toBe("homo_sapiens");
    expect(normalizeSpeciesName("", "hg19")).toBe("homo_sapiens");
  });
});

describe("normalizeGeneIdentifier", () => {
  it("preserves case sensitivity", () => {
    expect(normalizeGeneIdentifier("TP53")).toBe("TP53");
    expect(normalizeGeneIdentifier("BRCA1")).toBe("BRCA1");
    expect(normalizeGeneIdentifier("  EGFR  ")).toBe("EGFR");
  });

  it("leaves variant IDs unchanged", () => {
    expect(normalizeGeneIdentifier("rs699")).toBe("rs699");
    expect(normalizeGeneIdentifier("COSM476")).toBe("COSM476");
    expect(normalizeGeneIdentifier("ENSP00000288602")).toBe("ENSP00000288602");
  });
});

describe("normalizeHgvsNotation", () => {
  it("normalizes basic formatting", () => {
    expect(normalizeHgvsNotation("NM_000546.6 : c.215C>G")).toBe("NM_000546.6:c.215C>G");
    expect(normalizeHgvsNotation("NM_000546.6 > c.215C>G")).toBe("NM_000546.6>c.215C>G");
  });

  it("handles assembly-specific references", () => {
    expect(normalizeHgvsNotation("NM_000546:c.215C>G", "GRCh38")).toBe("NM_000546.6:c.215C>G");
    expect(normalizeHgvsNotation("NM_000546.6:c.215C>G", "GRCh37")).toBe("NM_000546.5:c.215C>G");
  });
});

describe("normalizeScaffoldName", () => {
  it("normalizes patch naming", () => {
    expect(normalizeScaffoldName("CHR_HSCHR1_1_CTG1", "GRCh38")).toBe("chr1_patch_1_CTG1");
    expect(normalizeScaffoldName("ALT_REF_LOCI_1_scaffold", "GRCh38")).toBe("ALT_REF_LOCI_1:scaffold");
  });
});

describe("normalizeEnsemblInputs", () => {
  it("normalizes a full set of inputs", () => {
    const input = {
      assembly: "hg38",
      species: "human",
      region: "chr17:43,000,000-44,000,000",
      gene_id: "  TP53  ",
      hgvs: "NM_000546 : c.215C>G",
    };

    const result = normalizeEnsemblInputs(input);

    expect(result.assembly).toBe("GRCh38");
    expect(result.species).toBe("homo_sapiens");
    expect(result.region).toBe("17:43000000-44000000");
    expect(result.gene_id).toBe("TP53");
    expect(result.hgvs).toBe("NM_000546.6:c.215C>G");
  });

  it("converts coordinate systems", () => {
    const input = {
      start: 99,
      end: 200,
      coordinate_system: "zero-based",
    };

    const result = normalizeEnsemblInputs(input);

    expect(result.start).toBe(100);
    expect(result.end).toBe(200);
    expect(result.coordinate_system).toBeUndefined();
  });
});
