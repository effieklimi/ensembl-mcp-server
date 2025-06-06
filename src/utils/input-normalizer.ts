/**
 * Input normalization utilities for Ensembl MCP server
 * Handles common format variations that LLMs might produce
 */

export interface NormalizedInput {
  [key: string]: any;
}

/**
 * Normalize genomic region formats
 * Handles: chr17:1000-2000, chromosome17:1000-2000, 17:1000-2000
 * Also handles spaces and comma separators in numbers
 */
export function normalizeGenomicRegion(region: string): string {
  if (!region) return region;

  // Remove any spaces around colons and dashes
  let normalized = region.replace(/\s*:\s*/g, ":").replace(/\s*-\s*/g, "-");

  // Remove comma separators from numbers (e.g., "1,000,000" -> "1000000")
  normalized = normalized.replace(/(\d),(\d)/g, "$1$2");

  // Handle chr/chromosome prefixes - remove them to standardize
  // Use word boundary to ensure we match the complete prefix
  normalized = normalized.replace(/^(chr|chromosome)(?=\d)/i, "");

  return normalized;
}

/**
 * Normalize cDNA/CDS coordinate formats
 * Handles: 100..200, 100-200, 100:200, 100|200, spaces
 */
export function normalizeCdnaCoordinates(coords: string): string {
  if (!coords) return coords;

  // Remove all spaces first
  let normalized = coords.replace(/\s+/g, "");

  // Convert various separators to standard ".." format
  // Handle: 100-200, 100:200, 100|200 -> 100..200
  normalized = normalized.replace(/(\d+)[-:|](\d+)/g, "$1..$2");

  // If it's already in .. format, keep it as is
  return normalized;
}

/**
 * Normalize species names
 * Handles case variations and space/underscore differences
 */
export function normalizeSpeciesName(species: string): string {
  if (!species) return species;

  // Convert to lowercase and replace spaces with underscores
  return species.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Normalize gene symbols and IDs
 * Handles case variations for gene symbols
 */
export function normalizeGeneIdentifier(identifier: string): string {
  if (!identifier) return identifier;

  // If it's an Ensembl ID (starts with ENS), keep original case
  if (/^ENS[A-Z]/i.test(identifier)) {
    return identifier.toUpperCase();
  }

  // For variant IDs (like rs numbers), keep as-is
  if (/^rs\d+$/i.test(identifier) || /^COSM\d+$/i.test(identifier)) {
    return identifier;
  }

  // For gene symbols, convert to uppercase (standard convention)
  // Examples: brca1 -> BRCA1, tp53 -> TP53
  if (/^[A-Za-z][A-Za-z0-9]*$/i.test(identifier)) {
    return identifier.toUpperCase();
  }

  // For other identifiers, keep as-is
  return identifier;
}

/**
 * Normalize HGVS notation
 * Handles spacing and case issues
 */
export function normalizeHgvsNotation(hgvs: string): string {
  if (!hgvs) return hgvs;

  // Remove spaces around colons and dots
  return hgvs.replace(/\s*:\s*/g, ":").replace(/\s*\.\s*/g, ".");
}

/**
 * Main normalization function that processes all inputs
 */
export function normalizeEnsemblInputs(args: any): NormalizedInput {
  const normalized = { ...args };

  // Normalize genomic regions
  if (normalized.region) {
    normalized.region = normalizeGenomicRegion(normalized.region);
  }

  // Normalize cDNA/CDS coordinates
  if (normalized.coordinates) {
    // Check if this looks like cDNA coords (contains .. or is just numbers with separator)
    if (/^\d+[.:\-|]\d+$/.test(normalized.coordinates.replace(/\s/g, ""))) {
      normalized.coordinates = normalizeCdnaCoordinates(normalized.coordinates);
    } else {
      // Might be genomic coordinates
      normalized.coordinates = normalizeGenomicRegion(normalized.coordinates);
    }
  }

  // Normalize species
  if (normalized.species) {
    normalized.species = normalizeSpeciesName(normalized.species);
  }
  if (normalized.target_species) {
    normalized.target_species = normalizeSpeciesName(normalized.target_species);
  }

  // Normalize gene identifiers
  if (normalized.gene_id) {
    normalized.gene_id = normalizeGeneIdentifier(normalized.gene_id);
  }
  if (normalized.gene_symbol) {
    normalized.gene_symbol = normalizeGeneIdentifier(normalized.gene_symbol);
  }
  if (normalized.feature_id) {
    normalized.feature_id = normalizeGeneIdentifier(normalized.feature_id);
  }
  if (normalized.identifier) {
    normalized.identifier = normalizeGeneIdentifier(normalized.identifier);
  }
  if (normalized.variant_id) {
    normalized.variant_id = normalizeGeneIdentifier(normalized.variant_id);
  }
  if (normalized.protein_id) {
    normalized.protein_id = normalizeGeneIdentifier(normalized.protein_id);
  }
  if (normalized.transcript_id) {
    normalized.transcript_id = normalizeGeneIdentifier(
      normalized.transcript_id
    );
  }

  // Normalize HGVS notation
  if (normalized.hgvs_notation) {
    normalized.hgvs_notation = normalizeHgvsNotation(normalized.hgvs_notation);
  }

  return normalized;
}
