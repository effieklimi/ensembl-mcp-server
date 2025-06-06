/**
 * Input normalization utilities for Ensembl MCP server
 * Handles common format variations that LLMs might produce
 */

export interface NormalizedInput {
  [key: string]: any;
}

/**
 * Normalize assembly names to their canonical forms
 * Handles GRCh38 vs hg38, GRCh37 vs hg19, etc.
 */
export function normalizeAssemblyName(assembly: string): string {
  if (!assembly) return assembly;

  const normalized = assembly.toLowerCase().trim();

  // GRCh38/hg38 equivalents
  if (normalized.includes("grch38") || normalized.includes("hg38")) {
    return "GRCh38";
  }

  // GRCh37/hg19 equivalents
  if (normalized.includes("grch37") || normalized.includes("hg19")) {
    return "GRCh37";
  }

  // Return original if no mapping found
  return assembly;
}

/**
 * Normalize chromosome names for assembly-specific differences
 * Handles mitochondrial chromosome variations and sex chromosome formats
 */
export function normalizeChromosomeName(
  chr: string,
  assembly?: string
): string {
  if (!chr) return chr;

  let normalized = chr.trim();

  // Remove chr/chromosome prefixes first
  normalized = normalized.replace(/^(chr|chromosome)(?=\d|[XYM])/i, "");

  // Handle mitochondrial chromosome variations
  if (/^(MT|M|chrM|chrMT|mitochondrial|mito)$/i.test(normalized)) {
    // Different assemblies use different conventions
    if (assembly === "GRCh37") return "MT";
    if (assembly === "GRCh38") return "MT";
    return "MT"; // Default to MT
  }

  // Normalize sex chromosomes
  if (/^(X|chrX)$/i.test(normalized)) return "X";
  if (/^(Y|chrY)$/i.test(normalized)) return "Y";

  // Handle pseudoautosomal regions
  if (/^(PAR1|PAR_1|PAR#1)$/i.test(normalized)) return "PAR1";
  if (/^(PAR2|PAR_2|PAR#2)$/i.test(normalized)) return "PAR2";

  return normalized;
}

/**
 * Normalize genomic region formats with assembly awareness
 * Handles: chr17:1000-2000, chromosome17:1000-2000, 17:1000-2000
 * Also handles spaces, comma separators, and assembly-specific naming
 */
export function normalizeGenomicRegion(
  region: string,
  assembly?: string
): string {
  if (!region) return region;

  // Remove any spaces around colons and dashes
  let normalized = region.replace(/\s*:\s*/g, ":").replace(/\s*-\s*/g, "-");

  // Remove comma separators from numbers (e.g., "1,000,000" -> "1000000")
  normalized = normalized.replace(/(\d),(\d)/g, "$1$2");

  // Split into chromosome and position parts
  const parts = normalized.split(":");
  if (parts.length === 2 && parts[0]) {
    const chr = normalizeChromosomeName(parts[0], assembly);
    return `${chr}:${parts[1]}`;
  }

  return normalized;
}

/**
 * Normalize coordinate systems (0-based vs 1-based)
 * Note: Ensembl typically uses 1-based coordinates
 */
export function normalizeCoordinateSystem(
  start: number,
  end: number,
  fromSystem: "zero-based" | "one-based" = "one-based"
): { start: number; end: number } {
  if (fromSystem === "zero-based") {
    // Convert from 0-based to 1-based (Ensembl standard)
    return {
      start: start + 1,
      end: end, // End coordinates are typically exclusive in 0-based, inclusive in 1-based
    };
  }

  return { start, end };
}

/**
 * Normalize cDNA coordinates formats
 * Handles: 100..200, 100-200, c.100-200, etc.
 */
export function normalizeCdnaCoordinates(coords: string): string {
  if (!coords) return coords;

  let normalized = coords.trim();

  // Remove 'c.' prefix if present
  normalized = normalized.replace(/^c\./, "");

  // Convert .. to - for range notation
  normalized = normalized.replace(/\.\./g, "-");

  // Handle various range separators
  normalized = normalized.replace(/\s*(to|→|–|—)\s*/g, "-");

  return normalized;
}

/**
 * Normalize species names with assembly context
 * Handles various formats and includes assembly-specific defaults
 */
export function normalizeSpeciesName(
  species: string,
  assembly?: string
): string {
  if (!species) {
    // Return default based on assembly
    if (assembly?.includes("GRCh") || assembly?.includes("hg")) {
      return "homo_sapiens";
    }
    return species;
  }

  const normalized = species.toLowerCase().replace(/[\s-]/g, "_");

  // Common species mappings
  const speciesMap: { [key: string]: string } = {
    human: "homo_sapiens",
    homo_sapiens: "homo_sapiens",
    homo_sapiens_sapiens: "homo_sapiens",
    mouse: "mus_musculus",
    mus_musculus: "mus_musculus",
    rat: "rattus_norvegicus",
    rattus_norvegicus: "rattus_norvegicus",
    zebrafish: "danio_rerio",
    danio_rerio: "danio_rerio",
    fruit_fly: "drosophila_melanogaster",
    drosophila_melanogaster: "drosophila_melanogaster",
    drosophila: "drosophila_melanogaster",
    worm: "caenorhabditis_elegans",
    c_elegans: "caenorhabditis_elegans",
    caenorhabditis_elegans: "caenorhabditis_elegans",
    yeast: "saccharomyces_cerevisiae",
    saccharomyces_cerevisiae: "saccharomyces_cerevisiae",
  };

  return speciesMap[normalized] || normalized;
}

/**
 * Normalize gene symbols and IDs with assembly context
 * Handles case variations and assembly-specific gene naming
 */
export function normalizeGeneIdentifier(
  identifier: string,
  assembly?: string
): string {
  if (!identifier) return identifier;

  const trimmed = identifier.trim();

  // Don't normalize if it looks like a variant ID (starts with rs, COSM, etc.)
  if (/^(rs\d+|COSM\d+|ENSP\d+|ENST\d+)$/i.test(trimmed)) {
    return trimmed;
  }

  // For most gene symbols, preserve original case but trim whitespace
  // Some genes are case-sensitive (e.g., TP53 vs tp53)
  return trimmed;
}

/**
 * Normalize HGVS notation with assembly awareness
 * Handles various HGVS formats and assembly-specific reference sequences
 */
export function normalizeHgvsNotation(hgvs: string, assembly?: string): string {
  if (!hgvs) return hgvs;

  let normalized = hgvs.trim();

  // Handle spaces around operators
  normalized = normalized.replace(/\s*([>:])\s*/g, "$1");

  // Normalize reference sequence prefixes based on assembly
  if (assembly === "GRCh38") {
    // Update common GRCh37 reference sequences to GRCh38 equivalents
    normalized = normalized.replace(/^NM_000546/, "NM_000546.6"); // Example for TP53
  } else if (assembly === "GRCh37") {
    // Ensure GRCh37 format
    normalized = normalized.replace(/^NM_000546\.\d+/, "NM_000546.5"); // Example for TP53
  }

  return normalized;
}

/**
 * Normalize patch/scaffold naming conventions
 * Handles assembly patches, alternate loci, and scaffold naming
 */
export function normalizeScaffoldName(
  scaffold: string,
  assembly?: string
): string {
  if (!scaffold) return scaffold;

  let normalized = scaffold.trim();

  // Handle patch nomenclature
  if (assembly === "GRCh38") {
    // Normalize patch naming (e.g., CHR_HSCHR1_1_CTG1 -> standardized form)
    normalized = normalized.replace(/^CHR_HSCHR(\d+)_/, "chr$1_patch_");
  }

  // Handle alternate loci naming
  normalized = normalized.replace(/^(ALT_REF_LOCI_\d+)_/, "$1:");

  return normalized;
}

/**
 * Main normalization function that applies all relevant normalizations
 */
export function normalizeEnsemblInputs(inputs: any): any {
  const normalized = { ...inputs };

  // Normalize assembly first as it affects other normalizations
  if (normalized.assembly) {
    normalized.assembly = normalizeAssemblyName(normalized.assembly);
  }

  // Normalize species with assembly context
  if (normalized.species) {
    normalized.species = normalizeSpeciesName(
      normalized.species,
      normalized.assembly
    );
  }

  // Normalize genomic regions with assembly context
  if (normalized.region) {
    normalized.region = normalizeGenomicRegion(
      normalized.region,
      normalized.assembly
    );
  }

  // Normalize cDNA coordinates
  if (normalized.cdna_coords) {
    normalized.cdna_coords = normalizeCdnaCoordinates(normalized.cdna_coords);
  }

  // Normalize gene identifiers
  if (normalized.gene_id || normalized.feature_id) {
    const geneField = normalized.gene_id ? "gene_id" : "feature_id";
    normalized[geneField] = normalizeGeneIdentifier(
      normalized[geneField],
      normalized.assembly
    );
  }

  // Normalize HGVS notation
  if (normalized.hgvs) {
    normalized.hgvs = normalizeHgvsNotation(
      normalized.hgvs,
      normalized.assembly
    );
  }

  // Normalize scaffold names
  if (normalized.scaffold) {
    normalized.scaffold = normalizeScaffoldName(
      normalized.scaffold,
      normalized.assembly
    );
  }

  // Handle coordinate system normalization if specified
  if (normalized.start && normalized.end && normalized.coordinate_system) {
    const coords = normalizeCoordinateSystem(
      Number(normalized.start),
      Number(normalized.end),
      normalized.coordinate_system
    );
    normalized.start = coords.start;
    normalized.end = coords.end;
    delete normalized.coordinate_system; // Remove the hint after using it
  }

  return normalized;
}
