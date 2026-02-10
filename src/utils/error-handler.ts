/**
 * Actionable error handling for Ensembl API responses.
 * Maps known error patterns to context-specific suggestions.
 */

export class EnsemblError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly suggestion?: string,
    public readonly example?: string
  ) {
    super(message);
    this.name = "EnsemblError";
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.suggestion && { suggestion: this.suggestion }),
      ...(this.example && { example: this.example }),
      success: false,
    };
  }
}

/**
 * Compute Levenshtein edit distance between two strings.
 */
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

/**
 * Find the closest match from a list of candidates.
 * Returns null if no candidate is within maxDistance.
 */
function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance: number = 3
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

// Known species names and common aliases for fuzzy matching
const KNOWN_SPECIES: string[] = [
  "homo_sapiens",
  "mus_musculus",
  "rattus_norvegicus",
  "danio_rerio",
  "drosophila_melanogaster",
  "caenorhabditis_elegans",
  "saccharomyces_cerevisiae",
  "gallus_gallus",
  "sus_scrofa",
  "bos_taurus",
  "ovis_aries",
  "equus_caballus",
  "canis_lupus_familiaris",
  "felis_catus",
  "pan_troglodytes",
  "gorilla_gorilla",
  "macaca_mulatta",
  "xenopus_tropicalis",
  "takifugu_rubripes",
  "oryzias_latipes",
];

const SPECIES_ALIASES: Record<string, string> = {
  human: "homo_sapiens",
  mouse: "mus_musculus",
  rat: "rattus_norvegicus",
  zebrafish: "danio_rerio",
  zebra_fish: "danio_rerio",
  fruitfly: "drosophila_melanogaster",
  fruit_fly: "drosophila_melanogaster",
  fly: "drosophila_melanogaster",
  worm: "caenorhabditis_elegans",
  c_elegans: "caenorhabditis_elegans",
  yeast: "saccharomyces_cerevisiae",
  chicken: "gallus_gallus",
  pig: "sus_scrofa",
  cow: "bos_taurus",
  sheep: "ovis_aries",
  horse: "equus_caballus",
  dog: "canis_lupus_familiaris",
  cat: "felis_catus",
  chimp: "pan_troglodytes",
  chimpanzee: "pan_troglodytes",
  gorilla: "gorilla_gorilla",
  frog: "xenopus_tropicalis",
  pufferfish: "takifugu_rubripes",
  medaka: "oryzias_latipes",
};

function suggestSpecies(input: string): string | null {
  const lower = input.toLowerCase().replace(/[\s-]/g, "_");

  // Check aliases first (exact match on alias)
  if (SPECIES_ALIASES[lower]) {
    return SPECIES_ALIASES[lower];
  }

  // Fuzzy match against known species
  return findClosestMatch(lower, KNOWN_SPECIES);
}

/**
 * Enrich a raw API error with actionable context.
 */
export function enrichError(
  statusCode: number,
  statusText: string,
  endpoint: string,
  responseBody?: string,
  params?: Record<string, string>
): EnsemblError {
  // --- 429 Rate Limited ---
  if (statusCode === 429) {
    return new EnsemblError(
      "Ensembl API rate limit exceeded.",
      429,
      endpoint,
      "The server will retry automatically if retry logic is enabled. If this persists, space out your requests.",
      undefined
    );
  }

  // --- 503 Service Unavailable ---
  if (statusCode === 503) {
    return new EnsemblError(
      "Ensembl REST API is temporarily unavailable.",
      503,
      endpoint,
      "Check status at https://rest.ensembl.org/info/ping. This is usually resolved within minutes.",
      undefined
    );
  }

  // --- 404 Not Found ---
  if (statusCode === 404) {
    return enrichNotFound(endpoint, responseBody);
  }

  // --- 400 Bad Request ---
  if (statusCode === 400) {
    return enrichBadRequest(endpoint, responseBody, params);
  }

  // --- Generic fallback ---
  return new EnsemblError(
    `Ensembl API error: ${statusCode} ${statusText}`,
    statusCode,
    endpoint
  );
}

function enrichNotFound(endpoint: string, responseBody?: string): EnsemblError {
  // Lookup by ID
  const idMatch = endpoint.match(/\/lookup\/id\/(.+?)(?:\?|$)/);
  if (idMatch) {
    const id = idMatch[1];
    let suggestion =
      "Ensembl stable IDs follow patterns like ENSG[0-9]{11} (gene), ENST[0-9]{11} (transcript), ENSP[0-9]{11} (protein). Verify the ID or use ensembl_lookup with lookup_type='symbol' to search by gene name.";

    // Check for common ID format issues
    if (id && !/^ENS[A-Z]{0,3}[GTRPE]\d{11}$/i.test(id)) {
      suggestion = `ID '${id}' does not match the expected Ensembl stable ID format. ${suggestion}`;
    }

    return new EnsemblError(
      `ID '${id}' not found.`,
      404,
      endpoint,
      suggestion,
      "ensembl_lookup with identifier='ENSG00000141510'"
    );
  }

  // Lookup by symbol
  const symbolMatch = endpoint.match(
    /\/lookup\/symbol\/([^/]+)\/(.+?)(?:\?|$)/
  );
  if (symbolMatch) {
    const [, species, symbol] = symbolMatch;
    return new EnsemblError(
      `Gene symbol '${symbol}' not found for ${species}.`,
      404,
      endpoint,
      `Check spelling. Gene symbols are typically uppercase for human (e.g., 'BRCA1', 'TP53'). Use ensembl_lookup with lookup_type='symbol'.`,
      `ensembl_lookup with identifier='BRCA1', lookup_type='symbol', species='${species}'`
    );
  }

  // Variation lookup
  const varMatch = endpoint.match(/\/variation\/([^/]+)\/(.+?)(?:\?|$)/);
  if (varMatch) {
    const [, species, variantId] = varMatch;
    return new EnsemblError(
      `Variant '${variantId}' not found for ${species}.`,
      404,
      endpoint,
      "Verify the variant ID. dbSNP IDs start with 'rs' (e.g., 'rs699'). COSMIC IDs start with 'COSM'.",
      "ensembl_variation with variant_id='rs699', analysis_type='variant_info'"
    );
  }

  // Generic 404
  return new EnsemblError(
    `Resource not found: ${endpoint}`,
    404,
    endpoint,
    "Verify the identifier exists in the current Ensembl release. Use ensembl_meta with info_type='data' to check the current release version."
  );
}

function enrichBadRequest(
  endpoint: string,
  responseBody?: string,
  params?: Record<string, string>
): EnsemblError {
  const body = responseBody ?? "";

  // Bad region format
  if (endpoint.includes("/overlap/region") || endpoint.includes("/sequence/region")) {
    const regionMatch = endpoint.match(/\/region\/[^/]+\/(.+?)(?:\?|$)/);
    const region = regionMatch?.[1] ?? "";

    // Check for commas in coordinates
    if (region.includes(",")) {
      return new EnsemblError(
        `Invalid region format '${region}'.`,
        400,
        endpoint,
        "Remove commas from coordinates and use format 'chromosome:start-end'.",
        "region='17:7565096-7590856'"
      );
    }

    return new EnsemblError(
      `Invalid region '${region}'.`,
      400,
      endpoint,
      "Use format 'chromosome:start-end' (e.g., '17:7565096-7590856'). Coordinates must be positive integers with start < end.",
      "region='17:7565096-7590856'"
    );
  }

  // Species-related errors
  const speciesMatch = endpoint.match(
    /\/(?:info\/assembly|info\/biotypes|info\/analysis|info\/external_dbs|info\/variation|overlap\/region|lookup\/symbol|vep|variation|ld|phenotype|sequence\/region)\/([^/]+)/
  );
  if (speciesMatch && speciesMatch[1] && body.toLowerCase().includes("species")) {
    const species = speciesMatch[1];
    const suggestion = suggestSpecies(species);
    const didYouMean = suggestion
      ? ` Did you mean '${suggestion}'?`
      : "";

    return new EnsemblError(
      `Species '${species}' not recognized.${didYouMean}`,
      400,
      endpoint,
      `Use ensembl_meta with info_type='species' to list all available species. Species names use underscore format (e.g., 'homo_sapiens', 'mus_musculus').`,
      "ensembl_meta with info_type='species'"
    );
  }

  // CDS/cDNA mapping missing feature_id
  if (endpoint.includes("/map/cds") || endpoint.includes("/map/cdna")) {
    return new EnsemblError(
      "Coordinate mapping requires a valid transcript or translation ID.",
      400,
      endpoint,
      "Provide a feature_id (transcript ID like 'ENST00000288602' or translation ID like 'ENSP00000288602') along with the coordinates.",
      "ensembl_mapping with coordinates='100..300', feature_id='ENST00000288602', mapping_type='cdna'"
    );
  }

  // VEP errors
  if (endpoint.includes("/vep/")) {
    return new EnsemblError(
      `Invalid VEP request.`,
      400,
      endpoint,
      "For VEP by variant ID, use an rsID (e.g., 'rs699'). For VEP by HGVS, use standard HGVS notation (e.g., '17:g.7579472G>C' or 'ENST00000288602.6:c.1799T>A').",
      "ensembl_variation with variant_id='rs699', analysis_type='vep'"
    );
  }

  // Generic 400
  return new EnsemblError(
    `Bad request: ${body || endpoint}`,
    400,
    endpoint,
    "Check that all parameter values are correctly formatted. Review the tool description for expected input formats."
  );
}

/**
 * Enrich a species validation error with fuzzy-match suggestions.
 */
export function enrichSpeciesError(species: string): EnsemblError {
  const suggestion = suggestSpecies(species);
  const didYouMean = suggestion ? ` Did you mean '${suggestion}'?` : "";

  return new EnsemblError(
    `Invalid species: '${species}'.${didYouMean}`,
    400,
    `/info/assembly/${species}`,
    "Use ensembl_meta with info_type='species' to list all available species. Species names use underscore format (e.g., 'homo_sapiens', 'mus_musculus').",
    "ensembl_meta with info_type='species'"
  );
}
