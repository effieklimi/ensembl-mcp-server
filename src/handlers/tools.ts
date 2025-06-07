import type { Tool } from "@modelcontextprotocol/sdk/types";
import { EnsemblApiClient } from "../utils/ensembl-api";
import { normalizeEnsemblInputs } from "../utils/input-normalizer";

const ensemblClient = new EnsemblApiClient();

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
            "ID or symbol to look up (gene, transcript, variant, etc.) (e.g., 'ENSG00000141510', 'BRCA1', 'rs699', 'ENST00000288602')",
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
            "Feature ID (gene, transcript, etc.) OR genomic region in format 'chr:start-end' (e.g., 'ENSG00000141510', 'ENST00000288602', '17:7565096-7590856', 'X:1000000-2000000')",
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
          description:
            "Variant ID (e.g., 'rs699', 'rs1042779', 'COSM476') or HGVS notation (e.g., '17:g.7579472G>C')",
        },
        region: {
          type: "string",
          description:
            "Genomic region in format 'chr:start-end' for variant search (e.g., '17:7565096-7590856', 'X:1000000-2000000', '1:100000-200000')",
        },
        hgvs_notation: {
          type: "string",
          description:
            "HGVS notation for VEP analysis (e.g., '17:g.7579472G>C', 'ENST00000288602.6:c.1799T>A', 'NM_007294.3:c.1799T>A')",
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

// Tool execution handlers
export async function handleFeatureOverlap(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    if (normalizedArgs.region) {
      return await ensemblClient.getOverlapByRegion(normalizedArgs);
    } else if (normalizedArgs.feature_id) {
      return await ensemblClient.getOverlapById(normalizedArgs);
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
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getRegulatoryFeatures(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleProteinFeatures(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getProteinFeatures(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleMeta(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getMetaInfo(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleLookup(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.performLookup(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleSequence(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getSequenceData(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleMapping(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.mapCoordinates(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleCompara(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getComparativeData(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleVariation(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getVariationData(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

export async function handleOntoTax(args: any) {
  try {
    const normalizedArgs = normalizeEnsemblInputs(args);
    return await ensemblClient.getOntologyTaxonomy(normalizedArgs);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}
