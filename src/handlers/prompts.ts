import { logger } from "../utils/logger.js";

interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

export const ensemblPrompts: PromptDefinition[] = [
  {
    name: "analyze-variant",
    description:
      "Multi-step variant analysis workflow: look up a variant, run VEP annotation, check phenotype associations, and review population frequencies.",
    arguments: [
      {
        name: "variant_id",
        description: "Variant identifier (e.g., 'rs699', 'rs1042779')",
        required: true,
      },
      {
        name: "species",
        description: "Species name (default: homo_sapiens)",
        required: false,
      },
    ],
  },
  {
    name: "compare-orthologs",
    description:
      "Cross-species ortholog comparison: look up a gene, retrieve homologs, and compare across species.",
    arguments: [
      {
        name: "gene",
        description:
          "Gene identifier or symbol (e.g., 'BRCA1', 'ENSG00000012048')",
        required: true,
      },
      {
        name: "species",
        description: "Source species (default: homo_sapiens)",
        required: false,
      },
      {
        name: "target_species",
        description:
          "Target species for comparison (e.g., 'mus_musculus')",
        required: false,
      },
    ],
  },
  {
    name: "region-survey",
    description:
      "Comprehensive genomic region survey: find overlapping features, regulatory elements, and variants in a region.",
    arguments: [
      {
        name: "region",
        description:
          "Genomic region in chr:start-end format (e.g., '17:7565096-7590856')",
        required: true,
      },
      {
        name: "species",
        description: "Species name (default: homo_sapiens)",
        required: false,
      },
    ],
  },
  {
    name: "gene-report",
    description:
      "Comprehensive gene report: look up gene details, list transcripts, get protein features, and find homologs.",
    arguments: [
      {
        name: "gene",
        description:
          "Gene identifier or symbol (e.g., 'TP53', 'ENSG00000141510')",
        required: true,
      },
      {
        name: "species",
        description: "Species name (default: homo_sapiens)",
        required: false,
      },
    ],
  },
];

function makeMessage(text: string) {
  return { role: "user" as const, content: { type: "text" as const, text } };
}

export function handleGetPrompt(
  name: string,
  args: Record<string, string>
) {
  logger.info("prompt_get", { name, args });

  switch (name) {
    case "analyze-variant":
      return buildAnalyzeVariant(args);
    case "compare-orthologs":
      return buildCompareOrthologs(args);
    case "region-survey":
      return buildRegionSurvey(args);
    case "gene-report":
      return buildGeneReport(args);
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

function buildAnalyzeVariant(args: Record<string, string>) {
  const { variant_id, species = "homo_sapiens" } = args;
  if (!variant_id) throw new Error("variant_id is required");

  return {
    messages: [
      makeMessage(
        `Look up variant ${variant_id} using the ensembl_variation tool with analysis_type 'variant_info' and species '${species}'. Report the variant's location, alleles, and minor allele frequency.`
      ),
      makeMessage(
        `Now run VEP annotation on variant ${variant_id} using ensembl_variation with analysis_type 'vep' and species '${species}'. Summarize the predicted consequences for each transcript, noting any missense, nonsense, or splice-site effects.`
      ),
      makeMessage(
        `Check for phenotype associations for ${variant_id} using ensembl_variation with analysis_type 'phenotype' and species '${species}'. List any associated diseases, traits, or clinical significance annotations.`
      ),
      makeMessage(
        `Summarize the clinical significance of ${variant_id}: combine the variant details, VEP consequences, and phenotype associations into a concise report. Highlight whether this variant is likely benign, pathogenic, or of uncertain significance based on the available evidence.`
      ),
    ],
  };
}

function buildCompareOrthologs(args: Record<string, string>) {
  const {
    gene,
    species = "homo_sapiens",
    target_species,
  } = args;
  if (!gene) throw new Error("gene is required");

  const targetClause = target_species
    ? ` with target_species '${target_species}'`
    : "";

  const lookupType = gene.startsWith("ENS") ? "id" : "symbol";

  return {
    messages: [
      makeMessage(
        `Look up gene ${gene} using ensembl_lookup with lookup_type '${lookupType}' and species '${species}'. Note the Ensembl gene ID, genomic location, and biotype.`
      ),
      makeMessage(
        `Retrieve orthologs for ${gene} using ensembl_compara with analysis_type 'homology', species '${species}', and homology_type 'orthologues'${targetClause}. List the orthologous genes with their species, percent identity, and gene order conservation score.`
      ),
      makeMessage(
        `Compare the protein sequences: for the top orthologs found, use ensembl_sequence with sequence_type 'protein' to retrieve protein sequences for the source and target genes. Note conserved domains and sequence divergence.`
      ),
      makeMessage(
        `Summarize the cross-species comparison for ${gene}: which species have clear orthologs, how conserved is the protein, and are there any notable differences or lineage-specific duplications?`
      ),
    ],
  };
}

function buildRegionSurvey(args: Record<string, string>) {
  const { region, species = "homo_sapiens" } = args;
  if (!region) throw new Error("region is required");

  return {
    messages: [
      makeMessage(
        `Find all genes and transcripts overlapping region ${region} using ensembl_feature_overlap with species '${species}' and feature_types ['gene', 'transcript']. List the genes with their biotypes and strand orientation.`
      ),
      makeMessage(
        `Now find regulatory features in region ${region} using ensembl_regulatory with species '${species}'. Report any promoters, enhancers, CTCF binding sites, or other regulatory elements.`
      ),
      makeMessage(
        `Search for known variants in region ${region} using ensembl_variation with analysis_type 'variant_info' and species '${species}'. Summarize the variant density and highlight any clinically significant variants.`
      ),
      makeMessage(
        `Provide an integrated summary of region ${region}: combine the gene content, regulatory landscape, and variant profile into an overview. Highlight anything notable — gene-dense or gene-desert regions, regulatory hotspots, or clusters of pathogenic variants.`
      ),
    ],
  };
}

function buildGeneReport(args: Record<string, string>) {
  const { gene, species = "homo_sapiens" } = args;
  if (!gene) throw new Error("gene is required");

  const lookupType = gene.startsWith("ENS") ? "id" : "symbol";

  return {
    messages: [
      makeMessage(
        `Look up gene ${gene} using ensembl_lookup with lookup_type '${lookupType}', species '${species}', and expand ['Transcript']. Report the gene ID, location, biotype, description, and list all transcripts with their biotypes and lengths.`
      ),
      makeMessage(
        `For the canonical transcript of ${gene}, retrieve protein features using ensembl_protein_features. List domains (Pfam, InterPro), signal peptides, transmembrane regions, and any other annotated features.`
      ),
      makeMessage(
        `Find homologs of ${gene} using ensembl_compara with analysis_type 'homology' and species '${species}'. Summarize orthologs across key model organisms (mouse, rat, zebrafish, fly, worm) with percent identity.`
      ),
      makeMessage(
        `Compile a comprehensive gene report for ${gene}: include gene summary, transcript isoforms, protein domain architecture, cross-species conservation, and any notable features or clinical relevance.`
      ),
    ],
  };
}
