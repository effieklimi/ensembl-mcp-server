import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { EnsemblApiClient } from "../utils/ensembl-api.js";
import { normalizeEnsemblInputs } from "../utils/input-normalizer.js";
import { validateToolInput, type ValidationResult } from "../utils/input-validator.js";
import { logger } from "../utils/logger.js";
import { processResponse } from "../utils/response-processor.js";
import { EnsemblError } from "../utils/error-handler.js";

function handleValidationError(toolName: string, validation: ValidationResult) {
  logger.warn("validation_failed", { tool: toolName, message: validation.message });
  return {
    error: validation.message,
    ...(validation.suggestion && { suggestion: validation.suggestion }),
    success: false,
  };
}

export const ensemblClient = new EnsemblApiClient();

/** Shared assembly property for tools that support GRCh37/GRCh38 routing. */
const ASSEMBLY_PROPERTY = {
  type: "string" as const,
  description:
    "Genome assembly version. Use 'GRCh37' (or 'hg19') for human GRCh37 data, 'GRCh38' (or 'hg38', default) for current assembly. Only affects human queries — ignored for other species.",
  enum: ["GRCh38", "GRCh37", "hg38", "hg19"],
};

export const ensemblTools: Tool[] = [
  {
    name: "ensembl_feature_overlap",
    description:
      "Find genomic features (genes, transcripts, regulatory elements) that overlap with a genomic region or specific feature. Automatically handles assembly-specific format variations (GRCh38/hg38, chromosome naming conventions, coordinate systems). Covers /overlap/region and /overlap/id endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Genomic region in format 'chromosome:start-end' (e.g., '17:7565096-7590856', 'X:1000000-2000000', '1:100000-200000'). Use this OR feature_id, not both.",
        },
        feature_id: {
          type: "string",
          description:
            "Feature ID (gene, transcript, etc.) to find overlapping features for (e.g., 'ENSG00000141510', 'ENST00000288602', 'BRCA1'). Use this OR region, not both.",
        },
        species: {
          type: "string",
          description:
            "Species name (e.g., 'homo_sapiens', 'mus_musculus', 'danio_rerio')",
          default: "homo_sapiens",
        },
        feature_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Types of features to include (e.g., ['gene', 'transcript', 'exon'], ['regulatory', 'enhancer'])",
        },
        biotype: {
          type: "string",
          description:
            "Filter by biotype (e.g., 'protein_coding', 'lncRNA', 'miRNA', 'pseudogene')",
        },
        max_results: {
          type: "number",
          description:
            "Maximum number of results to return (default: 50). Use a higher value to see more results.",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      oneOf: [{ required: ["region"] }, { required: ["feature_id"] }],
    },
  },

  {
    name: "ensembl_regulatory",
    description:
      "Get regulatory features, binding matrices, and regulatory annotations. Covers regulatory overlap endpoints and binding matrix data.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Genomic region in format 'chromosome:start-end' (e.g., '17:7565096-7590856', 'X:1000000-2000000', '6:25000000-35000000')",
        },
        protein_id: {
          type: "string",
          description:
            "Protein ID for regulatory features affecting translation (e.g., 'ENSP00000288602', 'ENSP00000350283')",
        },
        binding_matrix_id: {
          type: "string",
          description:
            "Binding matrix stable ID (e.g., 'ENSPFM0001', 'ENSPFM0123')",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
        feature_type: {
          type: "string",
          description:
            "Type of regulatory feature (e.g., 'RegulatoryFeature', 'MotifFeature', 'TF_binding_site')",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      anyOf: [
        { required: ["region"] },
        { required: ["protein_id"] },
        { required: ["binding_matrix_id"] },
      ],
    },
  },

  {
    name: "ensembl_protein_features",
    description:
      "Get protein-level features, domains, and annotations for proteins and translations.",
    inputSchema: {
      type: "object",
      properties: {
        protein_id: {
          type: "string",
          description:
            "Protein/translation ID (e.g., 'ENSP00000288602', 'ENSP00000350283', 'ENSP00000334393')",
        },
        feature_type: {
          type: "string",
          description:
            "Type of protein feature (e.g., 'domain', 'signal_peptide', 'transmembrane', 'low_complexity')",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
      },
      required: ["protein_id"],
    },
  },

  {
    name: "ensembl_meta",
    description:
      "Get server metadata, data releases, species info, and system status. Covers /info/* endpoints and /archive/id for version tracking.",
    inputSchema: {
      type: "object",
      properties: {
        info_type: {
          type: "string",
          enum: [
            "ping",
            "rest",
            "software",
            "data",
            "species",
            "divisions",
            "assembly",
            "biotypes",
            "analysis",
            "external_dbs",
            "variation",
          ],
          description: "Type of information to retrieve",
        },
        species: {
          type: "string",
          description:
            "Species name (required for species-specific info) (e.g., 'homo_sapiens', 'mus_musculus', 'drosophila_melanogaster')",
        },
        archive_id: {
          type: "string",
          description:
            "ID to get version information for (alternative to info_type) (e.g., 'ENSG00000141510', 'rs699')",
        },
        division: {
          type: "string",
          description:
            "Ensembl division name (e.g., 'vertebrates', 'plants', 'fungi', 'metazoa')",
        },
        max_results: {
          type: "number",
          description:
            "Maximum number of results to return for species lists (default: 50).",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      anyOf: [{ required: ["info_type"] }, { required: ["archive_id"] }],
    },
  },

  {
    name: "ensembl_lookup",
    description:
      "Look up genes, transcripts, variants by ID or symbol. Get cross-references and perform ID translation. Covers /lookup/* and /xrefs/* endpoints plus variant_recoder.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "ID or symbol to look up. Pass a single string or an array for batch lookup (e.g., 'BRCA1' or ['BRCA1', 'TP53', 'EGFR']). Batch supports up to 200 identifiers.",
        },
        lookup_type: {
          type: "string",
          enum: ["id", "symbol", "xrefs", "variant_recoder"],
          description: "Type of lookup to perform",
          default: "id",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
        expand: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional data to include (e.g., ['Transcript', 'Exon'], ['Translation'], ['UTR'])",
        },
        external_db: {
          type: "string",
          description:
            "External database name for xrefs lookup (e.g., 'HGNC', 'UniProtKB/Swiss-Prot', 'RefSeq_mRNA')",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      required: ["identifier"],
    },
  },

  {
    name: "ensembl_sequence",
    description:
      "Retrieve DNA, RNA, or protein sequences for genes, transcripts, regions. Covers /sequence/id and /sequence/region endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "Feature ID, genomic region, or an array of either for batch retrieval. Single: 'ENSG00000141510' or '17:7565096-7590856'. Batch: ['ENSG00000141510', 'ENST00000288602']. Up to 200 per request.",
        },
        sequence_type: {
          type: "string",
          enum: ["genomic", "cdna", "cds", "protein"],
          description: "Type of sequence to retrieve",
          default: "genomic",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
        format: {
          type: "string",
          enum: ["json", "fasta"],
          description: "Output format",
          default: "json",
        },
        mask: {
          type: "string",
          enum: ["soft", "hard"],
          description: "Mask repeats (soft=lowercase, hard=N)",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      required: ["identifier"],
    },
  },

  {
    name: "ensembl_mapping",
    description:
      "Map coordinates between different coordinate systems (genomic \u2194 cDNA/CDS/protein) and between genome assemblies. Covers /map/* endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        coordinates: {
          type: "string",
          description:
            "Coordinates to map: '100..200' for cDNA/CDS coords, or 'chr:start-end' for genomic (e.g., '100..300', '1..150', '17:7565096-7590856', 'X:1000000-2000000')",
        },
        feature_id: {
          type: "string",
          description:
            "Feature ID (transcript/translation) for coordinate mapping (e.g., 'ENST00000288602', 'ENSP00000288602')",
        },
        mapping_type: {
          type: "string",
          enum: ["cdna", "cds", "translation", "assembly"],
          description: "Type of coordinate mapping",
        },
        source_assembly: {
          type: "string",
          description:
            "Source assembly name (for assembly mapping) (e.g., 'GRCh37', 'GRCh38')",
        },
        target_assembly: {
          type: "string",
          description:
            "Target assembly name (for assembly mapping) (e.g., 'GRCh38', 'GRCh37')",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      required: ["coordinates", "mapping_type"],
    },
  },

  {
    name: "ensembl_compara",
    description:
      "Comparative genomics: gene trees, homology, species alignments, and evolutionary analysis. Covers /genetree/*, /homology/*, /alignment/* endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        gene_id: {
          type: "string",
          description:
            "Gene ID for homology/gene tree analysis (e.g., 'ENSG00000141510', 'ENSG00000012048')",
        },
        gene_symbol: {
          type: "string",
          description:
            "Gene symbol (alternative to gene_id) (e.g., 'BRCA1', 'TP53', 'EGFR')",
        },
        region: {
          type: "string",
          description:
            "Genomic region for alignments in format 'chr:start-end' (e.g., '17:7565096-7590856', 'X:1000000-2000000', '6:25000000-35000000')",
        },
        analysis_type: {
          type: "string",
          enum: ["homology", "genetree", "cafe_tree", "alignment"],
          description: "Type of comparative analysis",
        },
        species: {
          type: "string",
          description:
            "Species name (e.g., 'homo_sapiens', 'mus_musculus', 'pan_troglodytes')",
          default: "homo_sapiens",
        },
        target_species: {
          type: "string",
          description:
            "Target species for homology search (e.g., 'mus_musculus', 'pan_troglodytes', 'rattus_norvegicus')",
        },
        homology_type: {
          type: "string",
          enum: ["orthologues", "paralogues", "all"],
          description: "Type of homology to retrieve",
          default: "all",
        },
        aligned: {
          type: "boolean",
          description: "Include aligned sequences",
          default: false,
        },
        max_results: {
          type: "number",
          description:
            "Maximum number of results to return (default: 100). Use a higher value to see more results.",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      anyOf: [
        { required: ["gene_id", "analysis_type"] },
        { required: ["gene_symbol", "analysis_type"] },
        { required: ["region", "analysis_type"] },
      ],
    },
  },

  {
    name: "ensembl_variation",
    description:
      "Variant analysis: VEP consequence prediction, variant lookup, LD analysis, phenotype mapping, haplotypes. Covers /variation/*, /vep/*, /ld/*, /phenotype/* endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        variant_id: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "Variant ID(s). Single string or array for batch (e.g., 'rs699' or ['rs699', 'rs1042779']). Up to 200 per request.",
        },
        region: {
          type: "string",
          description:
            "Genomic region in format 'chr:start-end' for variant search (e.g., '17:7565096-7590856', 'X:1000000-2000000', '1:100000-200000')",
        },
        hgvs_notation: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "HGVS notation(s) for VEP analysis. Single string or array for batch VEP (e.g., '17:g.7579472G>C' or ['17:g.7579472G>C', 'ENST00000288602.6:c.1799T>A']). Up to 200 per request.",
        },
        analysis_type: {
          type: "string",
          enum: ["variant_info", "vep", "ld", "phenotype", "haplotypes"],
          description: "Type of variant analysis",
        },
        species: {
          type: "string",
          description: "Species name (e.g., 'homo_sapiens', 'mus_musculus')",
          default: "homo_sapiens",
        },
        consequence_type: {
          type: "string",
          description:
            "Filter by consequence type (e.g., 'missense_variant', 'stop_gained', 'splice_donor_variant')",
        },
        population: {
          type: "string",
          description:
            "Population for LD analysis (e.g., '1000GENOMES:phase_3:EUR', '1000GENOMES:phase_3:AFR', '1000GENOMES:phase_3:ASN')",
        },
        transcript_id: {
          type: "string",
          description:
            "Transcript ID for haplotype analysis (e.g., 'ENST00000288602', 'ENST00000350283')",
        },
        max_results: {
          type: "number",
          description:
            "Maximum number of results to return (default: 50). Use a higher value to see more results.",
        },
        assembly: ASSEMBLY_PROPERTY,
      },
      anyOf: [
        { required: ["variant_id"] },
        { required: ["region"] },
        { required: ["hgvs_notation"] },
      ],
    },
  },

  {
    name: "ensembl_ontotax",
    description:
      "Ontology term search and NCBI taxonomy traversal. Search GO terms, phenotype ontologies, and taxonomic classifications.",
    inputSchema: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description:
            "Ontology term or taxonomy term to search (e.g., 'protein binding', 'cell cycle', 'mitochondrion', 'Homo sapiens')",
        },
        ontology: {
          type: "string",
          enum: ["GO", "EFO", "HP", "MP", "taxonomy"],
          description: "Ontology to search in",
        },
        term_id: {
          type: "string",
          description:
            "Specific ontology term ID (e.g., 'GO:0008150', 'GO:0005515', 'HP:0000001', 'MP:0000001')",
        },
        species: {
          type: "string",
          description:
            "Species for taxonomy search (e.g., 'homo_sapiens', 'mus_musculus', 'drosophila_melanogaster')",
        },
        relation: {
          type: "string",
          enum: ["children", "parents", "ancestors", "descendants"],
          description: "Relationship to explore in ontology",
        },
      },
      anyOf: [
        { required: ["term", "ontology"] },
        { required: ["term_id"] },
        { required: ["species"] },
      ],
    },
  },

];

function handleError(tool: string, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  logger.error("tool_error", { tool, error: msg });
  if (error instanceof EnsemblError) {
    return error.toJSON();
  }
  return { error: msg, success: false };
}

// Tool execution handlers
export async function handleFeatureOverlap(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_feature_overlap", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_feature_overlap", validation);
    logger.info("tool_call", { tool: "ensembl_feature_overlap", args: normalizedArgs });
    let result;
    if (normalizedArgs.region) {
      result = await ensemblClient.getOverlapByRegion(normalizedArgs);
    } else if (normalizedArgs.feature_id) {
      result = await ensemblClient.getOverlapById(normalizedArgs);
    } else {
      throw new Error("Either region or feature_id must be provided");
    }
    return processResponse("ensembl_feature_overlap", result, {
      maxResults: args.max_results,
    });
  } catch (error) {
    return handleError("ensembl_feature_overlap", error);
  }
}

export async function handleRegulatory(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_regulatory", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_regulatory", validation);
    logger.info("tool_call", { tool: "ensembl_regulatory", args: normalizedArgs });
    const result = await ensemblClient.getRegulatoryFeatures(normalizedArgs);
    return processResponse("ensembl_regulatory", result, {
      maxResults: args.max_results,
    });
  } catch (error) {
    return handleError("ensembl_regulatory", error);
  }
}

export async function handleProteinFeatures(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_protein_features", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_protein_features", validation);
    logger.info("tool_call", { tool: "ensembl_protein_features", args: normalizedArgs });
    return await ensemblClient.getProteinFeatures(normalizedArgs);
  } catch (error) {
    return handleError("ensembl_protein_features", error);
  }
}

export async function handleMeta(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_meta", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_meta", validation);
    logger.info("tool_call", { tool: "ensembl_meta", args: normalizedArgs });
    const result = await ensemblClient.getMetaInfo(normalizedArgs);
    return processResponse("ensembl_meta", result, {
      maxResults: args.max_results,
    });
  } catch (error) {
    return handleError("ensembl_meta", error);
  }
}

export async function handleLookup(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_lookup", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_lookup", validation);
    const { identifier } = normalizedArgs;

    // Batch mode: identifier is an array
    if (Array.isArray(identifier)) {
      const { lookup_type = "id", species = "homo_sapiens", assembly } = normalizedArgs;
      logger.info("tool_call", {
        tool: "ensembl_lookup",
        mode: "batch",
        args: { lookup_type, species, count: identifier.length },
      });

      if (identifier.length === 0) {
        throw new Error("identifier array must not be empty");
      }

      if (lookup_type === "symbol") {
        return await ensemblClient.batchLookupSymbols(species, identifier, assembly);
      } else {
        return await ensemblClient.batchLookupIds(identifier, assembly);
      }
    }

    // Single mode
    logger.info("tool_call", { tool: "ensembl_lookup", args: normalizedArgs });
    return await ensemblClient.performLookup(normalizedArgs);
  } catch (error) {
    return handleError("ensembl_lookup", error);
  }
}

export async function handleSequence(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_sequence", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_sequence", validation);
    const { identifier } = normalizedArgs;

    // Batch mode: identifier is an array
    if (Array.isArray(identifier)) {
      const { sequence_type = "genomic", species = "homo_sapiens", assembly } = normalizedArgs;
      logger.info("tool_call", {
        tool: "ensembl_sequence",
        mode: "batch",
        args: { sequence_type, species, count: identifier.length },
      });

      if (identifier.length === 0) {
        throw new Error("identifier array must not be empty");
      }

      // Detect if identifiers are genomic regions (contain ':')
      const isRegion = identifier[0]?.includes(":");
      if (isRegion) {
        const normalizedRegions = identifier.map(
          (r: string) => normalizeEnsemblInputs({ region: r }).region
        );
        return await ensemblClient.batchSequenceRegions(species, normalizedRegions, assembly);
      } else {
        const type = sequence_type !== "genomic" ? sequence_type : undefined;
        return await ensemblClient.batchSequenceIds(identifier, type, assembly);
      }
    }

    // Single mode
    logger.info("tool_call", { tool: "ensembl_sequence", args: normalizedArgs });
    const result = await ensemblClient.getSequenceData(normalizedArgs);
    return processResponse("ensembl_sequence", result);
  } catch (error) {
    return handleError("ensembl_sequence", error);
  }
}

export async function handleMapping(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_mapping", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_mapping", validation);
    logger.info("tool_call", { tool: "ensembl_mapping", args: normalizedArgs });
    return await ensemblClient.mapCoordinates(normalizedArgs);
  } catch (error) {
    return handleError("ensembl_mapping", error);
  }
}

export async function handleCompara(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_compara", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_compara", validation);
    logger.info("tool_call", { tool: "ensembl_compara", args: normalizedArgs });
    const result = await ensemblClient.getComparativeData(normalizedArgs);
    return processResponse("ensembl_compara", result, {
      maxResults: args.max_results,
    });
  } catch (error) {
    return handleError("ensembl_compara", error);
  }
}

export async function handleVariation(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_variation", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_variation", validation);
    const { variant_id, hgvs_notation, species = "homo_sapiens", assembly } = normalizedArgs;

    // Batch mode: variant_id is an array
    if (Array.isArray(variant_id)) {
      logger.info("tool_call", {
        tool: "ensembl_variation",
        mode: "batch",
        args: { analysis_type: normalizedArgs.analysis_type, species, count: variant_id.length },
      });

      if (variant_id.length === 0) {
        throw new Error("variant_id array must not be empty");
      }

      if (normalizedArgs.analysis_type === "vep") {
        return await ensemblClient.batchVepIds(species, variant_id, assembly);
      } else {
        return await ensemblClient.batchVariationIds(species, variant_id, assembly);
      }
    }

    // Batch mode: hgvs_notation is an array
    if (Array.isArray(hgvs_notation)) {
      logger.info("tool_call", {
        tool: "ensembl_variation",
        mode: "batch",
        args: { analysis_type: "vep_hgvs", species, count: hgvs_notation.length },
      });

      if (hgvs_notation.length === 0) {
        throw new Error("hgvs_notation array must not be empty");
      }

      return await ensemblClient.batchVepHgvs(species, hgvs_notation, assembly);
    }

    // Single mode
    logger.info("tool_call", { tool: "ensembl_variation", args: normalizedArgs });
    const result = await ensemblClient.getVariationData(normalizedArgs);
    return processResponse("ensembl_variation", result, {
      maxResults: args.max_results,
    });
  } catch (error) {
    return handleError("ensembl_variation", error);
  }
}

export async function handleOntoTax(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    const validation = validateToolInput("ensembl_ontotax", normalizedArgs);
    if (!validation.valid) return handleValidationError("ensembl_ontotax", validation);
    logger.info("tool_call", { tool: "ensembl_ontotax", args: normalizedArgs });
    return await ensemblClient.getOntologyTaxonomy(normalizedArgs);
  } catch (error) {
    return handleError("ensembl_ontotax", error);
  }
}

