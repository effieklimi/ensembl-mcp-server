import { describe, it, expect } from "vitest";
import { EnsemblError, enrichError, enrichSpeciesError } from "../../src/utils/error-handler.js";

describe("EnsemblError", () => {
  it("serializes to JSON with suggestion and example", () => {
    const err = new EnsemblError("Not found", 404, "/lookup/id/X", "Check the ID", "use ENSG...");
    const json = err.toJSON();
    expect(json).toEqual({
      error: "Not found",
      suggestion: "Check the ID",
      example: "use ENSG...",
      success: false,
    });
  });

  it("omits undefined suggestion/example from JSON", () => {
    const err = new EnsemblError("Server error", 500, "/info/ping");
    const json = err.toJSON();
    expect(json).toEqual({ error: "Server error", success: false });
    expect(json).not.toHaveProperty("suggestion");
    expect(json).not.toHaveProperty("example");
  });
});

describe("enrichError", () => {
  it("handles 429 rate limit", () => {
    const err = enrichError(429, "Too Many Requests", "/lookup/id/BRCA1");
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain("rate limit");
  });

  it("handles 503 service unavailable", () => {
    const err = enrichError(503, "Service Unavailable", "/info/ping");
    expect(err.statusCode).toBe(503);
    expect(err.message).toContain("temporarily unavailable");
    expect(err.suggestion).toContain("ping");
  });

  it("enriches 404 for lookup by ID", () => {
    const err = enrichError(404, "Not Found", "/lookup/id/ENSG99999999");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("ENSG99999999");
    expect(err.message).toContain("not found");
    expect(err.suggestion).toContain("ENSG");
  });

  it("enriches 404 for lookup by symbol", () => {
    const err = enrichError(404, "Not Found", "/lookup/symbol/homo_sapiens/FAKEGENE");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("FAKEGENE");
    expect(err.suggestion).toContain("BRCA1");
  });

  it("enriches 404 for variation lookup", () => {
    const err = enrichError(404, "Not Found", "/variation/homo_sapiens/rs9999999999");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("rs9999999999");
    expect(err.suggestion).toContain("rs");
  });

  it("enriches 404 generic", () => {
    const err = enrichError(404, "Not Found", "/some/unknown/endpoint");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("not found");
  });

  it("enriches 400 bad region with commas", () => {
    const err = enrichError(400, "Bad Request", "/overlap/region/homo_sapiens/17:7,565,096-7,590,856");
    expect(err.statusCode).toBe(400);
    expect(err.suggestion).toContain("Remove commas");
  });

  it("enriches 400 bad region generic", () => {
    const err = enrichError(400, "Bad Request", "/overlap/region/homo_sapiens/badformat");
    expect(err.statusCode).toBe(400);
    expect(err.suggestion).toContain("chromosome:start-end");
  });

  it("enriches 400 species error with suggestion", () => {
    const err = enrichError(400, "Bad Request", "/info/assembly/humna", "species not found");
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("humna");
  });

  it("enriches 400 VEP error", () => {
    const err = enrichError(400, "Bad Request", "/vep/homo_sapiens/id/bad_input");
    expect(err.statusCode).toBe(400);
    expect(err.suggestion).toContain("VEP");
  });

  it("enriches 400 CDS mapping", () => {
    const err = enrichError(400, "Bad Request", "/map/cds/ENST00000288602/100..200");
    expect(err.statusCode).toBe(400);
    expect(err.suggestion).toContain("transcript");
  });

  it("returns generic error for unknown status codes", () => {
    const err = enrichError(502, "Bad Gateway", "/info/ping");
    expect(err.statusCode).toBe(502);
    expect(err.message).toContain("502");
  });
});

describe("enrichSpeciesError", () => {
  it("suggests close match", () => {
    const err = enrichSpeciesError("homo_sapien");
    expect(err.message).toContain("homo_sapien");
    expect(err.message).toContain("Did you mean");
  });

  it("returns error without suggestion for unknown species", () => {
    const err = enrichSpeciesError("xyzxyzxyz");
    expect(err.message).toContain("xyzxyzxyz");
    expect(err.suggestion).toContain("ensembl_meta");
  });
});
