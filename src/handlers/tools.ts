import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { EnsemblApiClient } from "../utils/ensembl-api.js";

const ensemblClient = new EnsemblApiClient();

export const ensemblTools: Tool[] = [
  {
    name: "ensembl_feature_overlap",
    description:
      "Find genomic features (genes, transcripts, regulatory elements) that overlap with a genomic region or specific feature. Covers /overlap/region and /overlap/id endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Genomic region in format 'chromosome:start-end' (e.g., '17:7565096-7590856'). Use this OR feature_id, not both.",
        },
        feature_id: {
          type: "string",
          description:
            "Feature ID (gene, transcript, etc.) to find overlapping features for. Use this OR region, not both.",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        feature_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Types of features to include (e.g., ['gene', 'transcript', 'exon'])",
        },
        biotype: {
          type: "string",
          description: "Filter by biotype (e.g., 'protein_coding', 'lncRNA')",
        },
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
          description: "Genomic region in format 'chromosome:start-end'",
        },
        protein_id: {
          type: "string",
          description:
            "Protein ID for regulatory features affecting translation",
        },
        binding_matrix_id: {
          type: "string",
          description: "Binding matrix stable ID",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        feature_type: {
          type: "string",
          description:
            "Type of regulatory feature (e.g., 'RegulatoryFeature', 'MotifFeature')",
        },
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
          description: "Protein/translation ID (e.g., ENSP00000288602)",
        },
        feature_type: {
          type: "string",
          description:
            "Type of protein feature (e.g., 'domain', 'signal_peptide')",
        },
        species: {
          type: "string",
          description: "Species name",
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
          description: "Species name (required for species-specific info)",
        },
        archive_id: {
          type: "string",
          description:
            "ID to get version information for (alternative to info_type)",
        },
        division: {
          type: "string",
          description: "Ensembl division name (e.g., 'vertebrates', 'plants')",
        },
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
          type: "string",
          description:
            "ID or symbol to look up (gene, transcript, variant, etc.)",
        },
        lookup_type: {
          type: "string",
          enum: ["id", "symbol", "xrefs", "variant_recoder"],
          description: "Type of lookup to perform",
          default: "id",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        expand: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional data to include (e.g., ['Transcript', 'Exon'])",
        },
        external_db: {
          type: "string",
          description: "External database name for xrefs lookup",
        },
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
          type: "string",
          description:
            "Feature ID (gene, transcript, etc.) OR genomic region (chr:start-end)",
        },
        sequence_type: {
          type: "string",
          enum: ["genomic", "cdna", "cds", "protein"],
          description: "Type of sequence to retrieve",
          default: "genomic",
        },
        species: {
          type: "string",
          description: "Species name",
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
      },
      required: ["identifier"],
    },
  },

  {
    name: "ensembl_mapping",
    description:
      "Map coordinates between different coordinate systems (genomic ↔ cDNA/CDS/protein) and between genome assemblies. Covers /map/* endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        coordinates: {
          type: "string",
          description:
            "Coordinates to map (e.g., '100..200' for cDNA/CDS coords, or 'chr:start-end' for genomic)",
        },
        feature_id: {
          type: "string",
          description:
            "Feature ID (transcript/translation) for coordinate mapping",
        },
        mapping_type: {
          type: "string",
          enum: ["cdna", "cds", "translation", "assembly"],
          description: "Type of coordinate mapping",
        },
        source_assembly: {
          type: "string",
          description: "Source assembly name (for assembly mapping)",
        },
        target_assembly: {
          type: "string",
          description: "Target assembly name (for assembly mapping)",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
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
          description: "Gene ID for homology/gene tree analysis",
        },
        gene_symbol: {
          type: "string",
          description: "Gene symbol (alternative to gene_id)",
        },
        region: {
          type: "string",
          description: "Genomic region for alignments (chr:start-end)",
        },
        analysis_type: {
          type: "string",
          enum: ["homology", "genetree", "cafe_tree", "alignment"],
          description: "Type of comparative analysis",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        target_species: {
          type: "string",
          description: "Target species for homology search",
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
          type: "string",
          description: "Variant ID (e.g., rs699) or HGVS notation",
        },
        region: {
          type: "string",
          description: "Genomic region (chr:start-end) for variant search",
        },
        hgvs_notation: {
          type: "string",
          description: "HGVS notation for VEP analysis",
        },
        analysis_type: {
          type: "string",
          enum: ["variant_info", "vep", "ld", "phenotype", "haplotypes"],
          description: "Type of variant analysis",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        consequence_type: {
          type: "string",
          description: "Filter by consequence type",
        },
        population: {
          type: "string",
          description:
            "Population for LD analysis (e.g., '1000GENOMES:phase_3:EUR')",
        },
        transcript_id: {
          type: "string",
          description: "Transcript ID for haplotype analysis",
        },
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
          description: "Ontology term or taxonomy term to search",
        },
        ontology: {
          type: "string",
          enum: ["GO", "EFO", "HP", "MP", "taxonomy"],
          description: "Ontology to search in",
        },
        term_id: {
          type: "string",
          description: "Specific ontology term ID (e.g., GO:0008150)",
        },
        species: {
          type: "string",
          description: "Species for taxonomy search",
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

// Tool execution handlers
export async function handleFeatureOverlap(args: any) {
  try {
    if (args.region) {
      return await ensemblClient.getOverlapByRegion(args);
    } else if (args.feature_id) {
      return await ensemblClient.getOverlapById(args);
    }
    throw new Error("Either region or feature_id must be provided");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleRegulatory(args: any) {
  try {
    return await ensemblClient.getRegulatoryFeatures(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleProteinFeatures(args: any) {
  try {
    return await ensemblClient.getProteinFeatures(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleMeta(args: any) {
  try {
    return await ensemblClient.getMetaInfo(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleLookup(args: any) {
  try {
    return await ensemblClient.performLookup(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleSequence(args: any) {
  try {
    return await ensemblClient.getSequenceData(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleMapping(args: any) {
  try {
    return await ensemblClient.mapCoordinates(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleCompara(args: any) {
  try {
    return await ensemblClient.getComparativeData(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleVariation(args: any) {
  try {
    return await ensemblClient.getVariationData(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleOntoTax(args: any) {
  try {
    return await ensemblClient.getOntologyTaxonomy(args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}
