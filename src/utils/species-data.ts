/**
 * Shared species data — single source of truth for species names and aliases.
 * Used by error-handler, input-normalizer, and input-validator.
 */

export const KNOWN_SPECIES: string[] = [
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

export const SPECIES_ALIASES: Record<string, string> = {
  human: "homo_sapiens",
  homo_sapiens_sapiens: "homo_sapiens",
  mouse: "mus_musculus",
  rat: "rattus_norvegicus",
  zebrafish: "danio_rerio",
  zebra_fish: "danio_rerio",
  fruitfly: "drosophila_melanogaster",
  fruit_fly: "drosophila_melanogaster",
  fly: "drosophila_melanogaster",
  drosophila: "drosophila_melanogaster",
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
  macaque: "macaca_mulatta",
  rhesus: "macaca_mulatta",
  frog: "xenopus_tropicalis",
  pufferfish: "takifugu_rubripes",
  medaka: "oryzias_latipes",
};

// ---------------------------------------------------------------------------
// Assembly server routing
// ---------------------------------------------------------------------------

/** Map of assembly names to their Ensembl REST server URLs. */
export const ASSEMBLY_SERVERS: Record<string, string> = {
  GRCh38: "https://rest.ensembl.org",
  GRCh37: "https://grch37.rest.ensembl.org",
};

export const DEFAULT_SERVER = "https://rest.ensembl.org";

/** Map server URLs to short identifiers used as cache key prefixes. */
export const SERVER_IDENTIFIERS: Record<string, string> = {
  "https://rest.ensembl.org": "grch38",
  "https://grch37.rest.ensembl.org": "grch37",
};

/** Assembly aliases — maps common names to canonical assembly names. */
const ASSEMBLY_ALIASES: Record<string, string> = {
  grch38: "GRCh38",
  grch37: "GRCh37",
  hg38: "GRCh38",
  hg19: "GRCh37",
};

/** Endpoints not available on the GRCh37 server. */
export const GRCH37_UNSUPPORTED_ENDPOINTS: RegExp[] = [
  /^\/cafe\//,
  /^\/genetree\//,
  /^\/homology\//,
  /^\/alignment\//,
];

/** Human species names that should route to GRCh37 when requested. */
const HUMAN_SPECIES = new Set(["homo_sapiens", "human"]);

/**
 * Resolve the correct Ensembl REST server URL based on assembly and species.
 * Returns GRCh37 server only for human + GRCh37; all other cases return default.
 */
export function resolveBaseUrl(assembly?: string, species?: string): string {
  if (!assembly) return DEFAULT_SERVER;

  const canonical = ASSEMBLY_ALIASES[assembly.toLowerCase()];
  if (!canonical) return DEFAULT_SERVER;

  if (canonical !== "GRCh37") return DEFAULT_SERVER;

  // GRCh37 only applies to human
  const resolvedSpecies = species
    ? SPECIES_ALIASES[species.toLowerCase()] || species.toLowerCase()
    : "homo_sapiens";

  if (!HUMAN_SPECIES.has(resolvedSpecies)) return DEFAULT_SERVER;

  return ASSEMBLY_SERVERS.GRCh37!;
}

/** Get a short identifier for a server URL (used as cache key prefix). */
export function getServerIdentifier(baseUrl: string): string {
  return SERVER_IDENTIFIERS[baseUrl] ?? "grch38";
}

/**
 * Check if an endpoint is supported on the GRCh37 server.
 * Returns an error message string if unsupported, null if OK.
 */
export function checkGrch37Support(endpoint: string): string | null {
  for (const pattern of GRCH37_UNSUPPORTED_ENDPOINTS) {
    if (pattern.test(endpoint)) {
      return `The GRCh37 server does not support this endpoint (${endpoint}). Comparative genomics data (homology, gene trees, CAFE trees, alignments) is only available on the GRCh38 server. Remove the assembly parameter or use assembly: "GRCh38".`;
    }
  }
  return null;
}
