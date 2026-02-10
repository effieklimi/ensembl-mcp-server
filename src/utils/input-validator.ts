/**
 * Pre-flight input validation for Ensembl MCP tools.
 * Catches invalid inputs locally before they hit the API.
 */

import { KNOWN_SPECIES, SPECIES_ALIASES } from "./species-data.js";

export interface ValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
}

const VALID: ValidationResult = { valid: true };

// ---------------------------------------------------------------------------
// Fuzzy matching (local copy to avoid coupling with error-handler)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }
  return dp[m]![n]!;
}

function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance = 3
): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;
  const lower = input.toLowerCase();
  for (const candidate of candidates) {
    const dist = levenshtein(lower, candidate.toLowerCase());
    if (dist < bestDistance && dist <= maxDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }
  return bestMatch;
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

/**
 * Validate Ensembl stable IDs. Only rejects strings starting with "ENS" that
 * don't match the expected pattern. Gene symbols like BRCA1 pass through.
 */
export function validateEnsemblId(id: string): ValidationResult {
  if (!id || typeof id !== "string") {
    return { valid: false, message: "Identifier is required." };
  }
  if (/^ENS/i.test(id) && !/^ENS[A-Z]{0,3}[GTRPE]\d{11}(\.\d+)?$/i.test(id)) {
    return {
      valid: false,
      message: `'${id}' looks like an Ensembl ID but doesn't match the expected format.`,
      suggestion:
        "Ensembl stable IDs follow patterns like ENSG00000141510 (gene), ENST00000288602 (transcript), ENSP00000288602 (protein). Check the ID length (11 digits after the type letter).",
    };
  }
  return VALID;
}

/**
 * Validate genomic region format: chromosome:start-end.
 * Large regions (>5Mb) pass with a warning.
 */
export function validateRegion(region: string): ValidationResult {
  if (!region || typeof region !== "string") {
    return { valid: false, message: "Region is required." };
  }
  if (!/^[\w.]+:\d+-\d+$/.test(region)) {
    return {
      valid: false,
      message: `Invalid region format '${region}'.`,
      suggestion:
        "Use format 'chromosome:start-end' (e.g., '17:7565096-7590856'). Remove commas from numbers and ensure start < end.",
    };
  }
  const parts = region.match(/^[\w.]+:(\d+)-(\d+)$/);
  if (parts) {
    const start = parseInt(parts[1]!, 10);
    const end = parseInt(parts[2]!, 10);
    if (start >= end) {
      return {
        valid: false,
        message: `Region start (${start}) must be less than end (${end}).`,
        suggestion: "Swap start and end coordinates.",
      };
    }
    const size = end - start;
    if (size > 5_000_000) {
      return {
        valid: true,
        message: `Region spans ${(size / 1_000_000).toFixed(1)}Mb — this is a large query and may be slow or truncated.`,
      };
    }
  }
  return VALID;
}

/**
 * Validate species name. Known species and aliases pass immediately.
 * Binomial-format names (genus_species) pass through since the known list
 * isn't exhaustive. Unknown single-word names get fuzzy matching.
 */
export function validateSpecies(species: string): ValidationResult {
  if (!species || typeof species !== "string") {
    return VALID; // species is often optional with a default
  }
  const lower = species.toLowerCase().replace(/[\s-]/g, "_");

  // Exact match on known species or alias
  if (KNOWN_SPECIES.includes(lower) || SPECIES_ALIASES[lower]) {
    return VALID;
  }

  // Binomial format (contains underscore with at least two parts) — let it through
  if (/^[a-z]+_[a-z]+/.test(lower)) {
    return VALID;
  }

  // Single word that isn't a known alias — try fuzzy match
  const allCandidates = [...Object.keys(SPECIES_ALIASES), ...KNOWN_SPECIES];
  const closest = findClosestMatch(lower, allCandidates);
  const resolved = closest
    ? SPECIES_ALIASES[closest] || closest
    : null;

  if (resolved) {
    return {
      valid: false,
      message: `Unknown species '${species}'. Did you mean '${resolved}'?`,
      suggestion: "Use ensembl_meta with info_type='species' to list all available species.",
    };
  }

  return {
    valid: false,
    message: `Unknown species '${species}'.`,
    suggestion:
      "Species names use underscore format (e.g., 'homo_sapiens', 'mus_musculus'). Use ensembl_meta with info_type='species' to list all available species.",
  };
}

/**
 * Validate variant IDs. Only rejects strings starting with rs/COS that
 * don't match expected patterns. Other formats pass through.
 */
export function validateVariantId(id: string): ValidationResult {
  if (!id || typeof id !== "string") {
    return { valid: false, message: "Variant ID is required." };
  }
  if (/^rs/i.test(id) && !/^rs\d+$/i.test(id)) {
    return {
      valid: false,
      message: `'${id}' looks like a dbSNP ID but has unexpected characters after 'rs'.`,
      suggestion: "dbSNP IDs should be 'rs' followed by digits only (e.g., 'rs699').",
    };
  }
  if (/^COS[MV]/i.test(id) && !/^COS[MV]\d+$/i.test(id)) {
    return {
      valid: false,
      message: `'${id}' looks like a COSMIC ID but has unexpected characters.`,
      suggestion: "COSMIC IDs should be 'COSM' or 'COSV' followed by digits (e.g., 'COSM476').",
    };
  }
  return VALID;
}

/**
 * Validate HGVS notation. Loose check for colon + variant descriptor.
 * Only rejects clearly malformed strings.
 */
export function validateHgvsNotation(hgvs: string): ValidationResult {
  if (!hgvs || typeof hgvs !== "string") {
    return { valid: false, message: "HGVS notation is required." };
  }
  // Must contain a colon separating reference from variant, or a genomic-style notation like 17:g.123A>G
  if (!hgvs.includes(":")) {
    return {
      valid: false,
      message: `'${hgvs}' doesn't look like valid HGVS notation.`,
      suggestion:
        "HGVS notation requires a ':' separator (e.g., 'ENST00000288602.6:c.1799T>A' or '17:g.7579472G>C').",
    };
  }
  return VALID;
}

/**
 * Validate protein IDs. Delegates to validateEnsemblId + ENSP prefix check.
 */
export function validateProteinId(id: string): ValidationResult {
  if (!id || typeof id !== "string") {
    return { valid: false, message: "Protein ID is required." };
  }
  // If it looks like an Ensembl ID, validate it specifically
  if (/^ENS/i.test(id)) {
    const base = validateEnsemblId(id);
    if (!base.valid) return base;
    if (!/^ENS[A-Z]{0,3}P\d{11}/i.test(id)) {
      return {
        valid: false,
        message: `'${id}' is a valid Ensembl ID but not a protein ID.`,
        suggestion:
          "Protein IDs use the 'P' type letter (e.g., 'ENSP00000288602'). Gene IDs use 'G', transcript IDs use 'T'.",
      };
    }
  }
  return VALID;
}

/**
 * Validate sequence type against allowed values.
 */
export function validateSequenceType(type: string): ValidationResult {
  const allowed = ["genomic", "cdna", "cds", "protein"];
  if (!type || typeof type !== "string") return VALID; // optional with default
  if (!allowed.includes(type.toLowerCase())) {
    return {
      valid: false,
      message: `Invalid sequence type '${type}'.`,
      suggestion: `Valid types: ${allowed.join(", ")}`,
    };
  }
  return VALID;
}

/**
 * Validate an array of items using a per-item validator.
 * Length 1-200, caps reported errors at 10.
 */
export function validateBatchArray(
  items: any[],
  validator: (item: any) => ValidationResult,
  name: string
): ValidationResult {
  if (!Array.isArray(items)) {
    return { valid: false, message: `${name} must be an array.` };
  }
  if (items.length === 0) {
    return { valid: false, message: `${name} array must not be empty.` };
  }
  if (items.length > 200) {
    return {
      valid: false,
      message: `${name} array has ${items.length} items — maximum is 200.`,
      suggestion: "Split into multiple requests of up to 200 items each.",
    };
  }
  const errors: string[] = [];
  for (let i = 0; i < items.length && errors.length < 10; i++) {
    const result = validator(items[i]);
    if (!result.valid) {
      errors.push(`[${i}] ${result.message}`);
    }
  }
  if (errors.length > 0) {
    return {
      valid: false,
      message: `Invalid items in ${name}: ${errors.join("; ")}`,
      suggestion: "Fix the listed items and retry.",
    };
  }
  return VALID;
}

// ---------------------------------------------------------------------------
// Per-tool validation functions
// ---------------------------------------------------------------------------

function validateFeatureOverlap(args: Record<string, any>): ValidationResult {
  if (!args.region && !args.feature_id) {
    return {
      valid: false,
      message: "Either 'region' or 'feature_id' must be provided.",
      suggestion: "Provide a region (e.g., '17:7565096-7590856') or a feature ID (e.g., 'ENSG00000141510').",
    };
  }
  if (args.region) {
    const r = validateRegion(args.region);
    if (!r.valid) return r;
  }
  if (args.feature_id && typeof args.feature_id === "string") {
    const r = validateEnsemblId(args.feature_id);
    if (!r.valid) return r;
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateRegulatory(args: Record<string, any>): ValidationResult {
  if (!args.region && !args.protein_id && !args.binding_matrix_id) {
    return {
      valid: false,
      message: "One of 'region', 'protein_id', or 'binding_matrix_id' is required.",
    };
  }
  if (args.region) {
    const r = validateRegion(args.region);
    if (!r.valid) return r;
  }
  if (args.protein_id) {
    const r = validateProteinId(args.protein_id);
    if (!r.valid) return r;
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateProteinFeaturesInput(args: Record<string, any>): ValidationResult {
  if (!args.protein_id) {
    return { valid: false, message: "'protein_id' is required." };
  }
  const r = validateProteinId(args.protein_id);
  if (!r.valid) return r;
  if (args.species) {
    const s = validateSpecies(args.species);
    if (!s.valid) return s;
  }
  return VALID;
}

function validateMeta(args: Record<string, any>): ValidationResult {
  if (!args.info_type && !args.archive_id) {
    return {
      valid: false,
      message: "Either 'info_type' or 'archive_id' is required.",
    };
  }
  if (args.info_type) {
    const allowed = [
      "ping", "rest", "software", "data", "species", "divisions",
      "assembly", "biotypes", "analysis", "external_dbs", "variation",
    ];
    if (!allowed.includes(args.info_type)) {
      return {
        valid: false,
        message: `Invalid info_type '${args.info_type}'.`,
        suggestion: `Valid types: ${allowed.join(", ")}`,
      };
    }
  }
  if (args.archive_id) {
    const r = validateEnsemblId(args.archive_id);
    if (!r.valid) return r;
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateLookup(args: Record<string, any>): ValidationResult {
  if (args.identifier == null) {
    return { valid: false, message: "'identifier' is required." };
  }
  if (Array.isArray(args.identifier)) {
    const r = validateBatchArray(args.identifier, validateEnsemblId, "identifier");
    if (!r.valid) return r;
  } else {
    const r = validateEnsemblId(args.identifier);
    if (!r.valid) return r;
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateSequence(args: Record<string, any>): ValidationResult {
  if (args.identifier == null) {
    return { valid: false, message: "'identifier' is required." };
  }
  if (args.sequence_type) {
    const r = validateSequenceType(args.sequence_type);
    if (!r.valid) return r;
  }
  if (Array.isArray(args.identifier)) {
    // Batch — items can be IDs or regions; validate each based on content
    const validator = (item: any) => {
      if (typeof item === "string" && item.includes(":")) {
        return validateRegion(item);
      }
      return validateEnsemblId(item);
    };
    const r = validateBatchArray(args.identifier, validator, "identifier");
    if (!r.valid) return r;
  } else if (typeof args.identifier === "string") {
    if (args.identifier.includes(":")) {
      const r = validateRegion(args.identifier);
      if (!r.valid) return r;
    } else {
      const r = validateEnsemblId(args.identifier);
      if (!r.valid) return r;
    }
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateMapping(args: Record<string, any>): ValidationResult {
  if (!args.coordinates) {
    return { valid: false, message: "'coordinates' is required." };
  }
  if (!args.mapping_type) {
    return { valid: false, message: "'mapping_type' is required." };
  }
  const allowedTypes = ["cdna", "cds", "translation", "assembly"];
  if (!allowedTypes.includes(args.mapping_type)) {
    return {
      valid: false,
      message: `Invalid mapping_type '${args.mapping_type}'.`,
      suggestion: `Valid types: ${allowedTypes.join(", ")}`,
    };
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateCompara(args: Record<string, any>): ValidationResult {
  if (!args.gene_id && !args.gene_symbol && !args.region) {
    return {
      valid: false,
      message: "One of 'gene_id', 'gene_symbol', or 'region' is required.",
    };
  }
  if (!args.analysis_type) {
    return { valid: false, message: "'analysis_type' is required." };
  }
  const allowedTypes = ["homology", "genetree", "cafe_tree", "alignment"];
  if (!allowedTypes.includes(args.analysis_type)) {
    return {
      valid: false,
      message: `Invalid analysis_type '${args.analysis_type}'.`,
      suggestion: `Valid types: ${allowedTypes.join(", ")}`,
    };
  }
  if (args.gene_id) {
    const r = validateEnsemblId(args.gene_id);
    if (!r.valid) return r;
  }
  if (args.region) {
    const r = validateRegion(args.region);
    if (!r.valid) return r;
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  if (args.target_species) {
    const r = validateSpecies(args.target_species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateVariation(args: Record<string, any>): ValidationResult {
  if (!args.variant_id && !args.region && !args.hgvs_notation) {
    return {
      valid: false,
      message: "One of 'variant_id', 'region', or 'hgvs_notation' is required.",
    };
  }
  if (args.variant_id) {
    if (Array.isArray(args.variant_id)) {
      const r = validateBatchArray(args.variant_id, validateVariantId, "variant_id");
      if (!r.valid) return r;
    } else {
      const r = validateVariantId(args.variant_id);
      if (!r.valid) return r;
    }
  }
  if (args.region) {
    const r = validateRegion(args.region);
    if (!r.valid) return r;
  }
  if (args.hgvs_notation) {
    if (Array.isArray(args.hgvs_notation)) {
      const r = validateBatchArray(args.hgvs_notation, validateHgvsNotation, "hgvs_notation");
      if (!r.valid) return r;
    } else {
      const r = validateHgvsNotation(args.hgvs_notation);
      if (!r.valid) return r;
    }
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

function validateOntoTax(args: Record<string, any>): ValidationResult {
  if (!args.term && !args.term_id && !args.species) {
    return {
      valid: false,
      message: "One of 'term' (with 'ontology'), 'term_id', or 'species' is required.",
    };
  }
  if (args.term && !args.ontology) {
    return {
      valid: false,
      message: "'ontology' is required when searching by 'term'.",
      suggestion: "Valid ontologies: GO, EFO, HP, MP, taxonomy",
    };
  }
  if (args.ontology) {
    const allowed = ["GO", "EFO", "HP", "MP", "taxonomy"];
    if (!allowed.includes(args.ontology)) {
      return {
        valid: false,
        message: `Invalid ontology '${args.ontology}'.`,
        suggestion: `Valid ontologies: ${allowed.join(", ")}`,
      };
    }
  }
  if (args.species) {
    const r = validateSpecies(args.species);
    if (!r.valid) return r;
  }
  return VALID;
}

// ---------------------------------------------------------------------------
// Tool-aware dispatcher
// ---------------------------------------------------------------------------

const TOOL_VALIDATORS: Record<string, (args: Record<string, any>) => ValidationResult> = {
  ensembl_feature_overlap: validateFeatureOverlap,
  ensembl_regulatory: validateRegulatory,
  ensembl_protein_features: validateProteinFeaturesInput,
  ensembl_meta: validateMeta,
  ensembl_lookup: validateLookup,
  ensembl_sequence: validateSequence,
  ensembl_mapping: validateMapping,
  ensembl_compara: validateCompara,
  ensembl_variation: validateVariation,
  ensembl_ontotax: validateOntoTax,
};

export function validateToolInput(
  toolName: string,
  args: Record<string, any>
): ValidationResult {
  const validator = TOOL_VALIDATORS[toolName];
  if (!validator) return VALID;
  return validator(args);
}
