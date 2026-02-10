import { describe, it, expect } from "vitest";
import {
  resolveBaseUrl,
  getServerIdentifier,
  checkGrch37Support,
  ASSEMBLY_SERVERS,
  DEFAULT_SERVER,
} from "../../src/utils/species-data.js";

describe("resolveBaseUrl", () => {
  it("returns GRCh37 server for human + GRCh37", () => {
    expect(resolveBaseUrl("GRCh37", "homo_sapiens")).toBe(ASSEMBLY_SERVERS.GRCh37);
  });

  it("returns GRCh37 server for human alias + hg19", () => {
    expect(resolveBaseUrl("hg19", "human")).toBe(ASSEMBLY_SERVERS.GRCh37);
  });

  it("returns GRCh37 server case-insensitively", () => {
    expect(resolveBaseUrl("grch37", "homo_sapiens")).toBe(ASSEMBLY_SERVERS.GRCh37);
  });

  it("returns default server for human + GRCh38", () => {
    expect(resolveBaseUrl("GRCh38", "homo_sapiens")).toBe(DEFAULT_SERVER);
  });

  it("returns default server for human + hg38", () => {
    expect(resolveBaseUrl("hg38", "homo_sapiens")).toBe(DEFAULT_SERVER);
  });

  it("returns default server when no assembly specified", () => {
    expect(resolveBaseUrl(undefined, "homo_sapiens")).toBe(DEFAULT_SERVER);
  });

  it("returns default server when assembly is empty string", () => {
    expect(resolveBaseUrl("", "homo_sapiens")).toBe(DEFAULT_SERVER);
  });

  it("returns default server for non-human species + GRCh37", () => {
    expect(resolveBaseUrl("GRCh37", "mus_musculus")).toBe(DEFAULT_SERVER);
  });

  it("returns default server for non-human species alias + GRCh37", () => {
    expect(resolveBaseUrl("GRCh37", "mouse")).toBe(DEFAULT_SERVER);
  });

  it("defaults to homo_sapiens when species not provided", () => {
    expect(resolveBaseUrl("GRCh37")).toBe(ASSEMBLY_SERVERS.GRCh37);
  });

  it("returns default server for unknown assembly", () => {
    expect(resolveBaseUrl("mm10", "homo_sapiens")).toBe(DEFAULT_SERVER);
  });
});

describe("getServerIdentifier", () => {
  it("returns grch38 for default server", () => {
    expect(getServerIdentifier("https://rest.ensembl.org")).toBe("grch38");
  });

  it("returns grch37 for GRCh37 server", () => {
    expect(getServerIdentifier("https://grch37.rest.ensembl.org")).toBe("grch37");
  });

  it("returns grch38 for unknown server", () => {
    expect(getServerIdentifier("https://unknown.example.com")).toBe("grch38");
  });
});

describe("checkGrch37Support", () => {
  it("returns null for supported endpoints", () => {
    expect(checkGrch37Support("/overlap/region/homo_sapiens/17:7565096-7590856")).toBeNull();
    expect(checkGrch37Support("/lookup/id/ENSG00000141510")).toBeNull();
    expect(checkGrch37Support("/vep/homo_sapiens/id/rs699")).toBeNull();
    expect(checkGrch37Support("/variation/homo_sapiens/rs699")).toBeNull();
    expect(checkGrch37Support("/sequence/id/ENSG00000141510")).toBeNull();
    expect(checkGrch37Support("/info/species")).toBeNull();
    expect(checkGrch37Support("/map/cdna/ENST00000288602/100..200")).toBeNull();
  });

  it("returns error for homology endpoint", () => {
    const result = checkGrch37Support("/homology/id/homo_sapiens/ENSG00000141510");
    expect(result).not.toBeNull();
    expect(result).toContain("does not support");
  });

  it("returns error for genetree endpoint", () => {
    const result = checkGrch37Support("/genetree/id/ENSG00000141510");
    expect(result).not.toBeNull();
    expect(result).toContain("does not support");
  });

  it("returns error for cafe endpoint", () => {
    const result = checkGrch37Support("/cafe/genetree/id/ENSG00000141510");
    expect(result).not.toBeNull();
    expect(result).toContain("does not support");
  });

  it("returns error for alignment endpoint", () => {
    const result = checkGrch37Support("/alignment/region/homo_sapiens/17:7565096-7590856");
    expect(result).not.toBeNull();
    expect(result).toContain("does not support");
  });
});
