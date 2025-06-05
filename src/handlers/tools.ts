import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { EnsemblApiClient } from "../utils/ensembl-api.js";

const ensemblClient = new EnsemblApiClient();

export const ensemblTools: Tool[] = [
  {
    name: "get_gene_info",
    description:
      "Get detailed information about a gene by its Ensembl ID or symbol",
    inputSchema: {
      type: "object",
      properties: {
        gene_identifier: {
          type: "string",
          description:
            "Gene ID (e.g., ENSG00000157764) or gene symbol (e.g., BRAF)",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        include_transcripts: {
          type: "boolean",
          description: "Whether to include transcript information",
          default: false,
        },
      },
      required: ["gene_identifier"],
    },
  },

  {
    name: "search_genes",
    description: "Search for genes by symbol or external name",
    inputSchema: {
      type: "object",
      properties: {
        gene_name: {
          type: "string",
          description: "Gene symbol to search for (e.g., TP53, BRCA1)",
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
      },
      required: ["gene_name"],
    },
  },

  {
    name: "get_sequence",
    description: "Get DNA sequence for a genomic region",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            'Genomic region in format "chromosome:start-end" (e.g., "17:7565096-7590856")',
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        format: {
          type: "string",
          description: "Output format",
          enum: ["json", "fasta"],
          default: "json",
        },
      },
      required: ["region"],
    },
  },

  {
    name: "get_variants_in_region",
    description: "Get genetic variants in a genomic region",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            'Genomic region in format "chromosome:start-end" (e.g., "17:7565096-7590856")',
        },
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
        consequence_type: {
          type: "string",
          description:
            'Filter by consequence type (e.g., "missense_variant", "stop_gained")',
        },
      },
      required: ["region"],
    },
  },

  {
    name: "get_variant_info",
    description: "Get detailed information about a specific variant",
    inputSchema: {
      type: "object",
      properties: {
        variant_id: {
          type: "string",
          description: "Variant ID (e.g., rs699, rs1800562)",
        },
      },
      required: ["variant_id"],
    },
  },

  {
    name: "get_transcript_info",
    description: "Get information about a transcript",
    inputSchema: {
      type: "object",
      properties: {
        transcript_id: {
          type: "string",
          description: "Transcript ID (e.g., ENST00000288602)",
        },
      },
      required: ["transcript_id"],
    },
  },

  {
    name: "list_species",
    description: "Get list of all available species in Ensembl",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "get_species_info",
    description: "Get detailed information about a species",
    inputSchema: {
      type: "object",
      properties: {
        species: {
          type: "string",
          description:
            "Species name (e.g., homo_sapiens, mus_musculus) or common name (e.g., human, mouse)",
        },
      },
      required: ["species"],
    },
  },

  {
    name: "get_assembly_info",
    description: "Get genome assembly information for a species",
    inputSchema: {
      type: "object",
      properties: {
        species: {
          type: "string",
          description: "Species name",
          default: "homo_sapiens",
        },
      },
      required: [],
    },
  },

  {
    name: "get_gene_xrefs",
    description: "Get external database references for a gene",
    inputSchema: {
      type: "object",
      properties: {
        gene_id: {
          type: "string",
          description: "Gene ID (e.g., ENSG00000157764)",
        },
      },
      required: ["gene_id"],
    },
  },
];

// Tool execution handlers
export async function handleGetGeneInfo(args: any) {
  const {
    gene_identifier,
    species = "homo_sapiens",
    include_transcripts = false,
  } = args;

  try {
    // Check if it's an Ensembl ID or gene symbol
    const isEnsemblId = gene_identifier.startsWith("ENSG");

    let gene;
    if (isEnsemblId) {
      gene = await ensemblClient.getGeneById(gene_identifier, species);
    } else {
      const results = await ensemblClient.searchGenes({
        gene_name: gene_identifier,
        species,
      });
      if (results.length === 0) {
        throw new Error(`Gene '${gene_identifier}' not found`);
      }
      gene = results[0];
    }

    let transcripts = null;
    if (include_transcripts && gene?.id) {
      transcripts = await ensemblClient.getTranscriptsForGene(gene.id);
    }

    return {
      gene,
      transcripts,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleSearchGenes(args: any) {
  const { gene_name, species = "homo_sapiens" } = args;

  try {
    const results = await ensemblClient.searchGenes({ gene_name, species });
    return {
      genes: results,
      count: results.length,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetSequence(args: any) {
  const { region, species = "homo_sapiens", format = "json" } = args;

  try {
    const sequence = await ensemblClient.getSequence({
      region,
      species,
      format,
    });
    return {
      sequence,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetVariantsInRegion(args: any) {
  const { region, species = "homo_sapiens", consequence_type } = args;

  try {
    const variants = await ensemblClient.getVariantsInRegion({
      region,
      species,
      consequence_type,
    });
    return {
      variants,
      count: variants.length,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetVariantInfo(args: any) {
  const { variant_id } = args;

  try {
    const variant = await ensemblClient.getVariantById(variant_id);
    return {
      variant,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetTranscriptInfo(args: any) {
  const { transcript_id } = args;

  try {
    const transcript = await ensemblClient.getTranscriptById(transcript_id);
    return {
      transcript,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleListSpecies() {
  try {
    const species = await ensemblClient.getAllSpecies();
    return {
      species: species.slice(0, 50), // Limit to first 50 for readability
      total_count: species.length,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetSpeciesInfo(args: any) {
  const { species } = args;

  try {
    const speciesInfo = await ensemblClient.getSpeciesInfo(species);
    return {
      species: speciesInfo,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetAssemblyInfo(args: any) {
  const { species = "homo_sapiens" } = args;

  try {
    const assembly = await ensemblClient.getAssemblyInfo(species);
    return {
      assembly,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleGetGeneXrefs(args: any) {
  const { gene_id } = args;

  try {
    const xrefs = await ensemblClient.getGeneXrefs(gene_id);
    return {
      xrefs,
      count: xrefs.length,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}
