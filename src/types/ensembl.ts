// Core Ensembl API response types

export interface EnsemblGene {
  id: string;
  object_type: string;
  species: string;
  seq_region_name: string;
  start: number;
  end: number;
  strand: number;
  display_name: string;
  description?: string;
  biotype: string;
  canonical_transcript?: string;
}

export interface EnsemblTranscript {
  id: string;
  parent: string;
  object_type: string;
  species: string;
  seq_region_name: string;
  start: number;
  end: number;
  strand: number;
  display_name: string;
  biotype: string;
  is_canonical?: boolean;
}

export interface EnsemblVariant {
  id: string;
  seq_region_name: string;
  start: number;
  end: number;
  strand: number;
  alleles: string[];
  most_severe_consequence: string;
  clinical_significance?: string[];
}

export interface EnsemblSequence {
  id: string;
  desc: string;
  molecule: string;
  seq: string;
}

export interface EnsemblSpecies {
  name: string;
  common_name: string;
  display_name: string;
  division: string;
  taxonomy_id: number;
  assembly: {
    name: string;
    default: string;
  };
}

export interface EnsemblGenomicRegion {
  seq_region_name: string;
  start: number;
  end: number;
  strand?: number;
  coord_system?: string;
}

// API response wrappers
export interface EnsemblApiResponse<T> {
  data: T;
  error?: string;
}

// Search parameters
export interface GeneSearchParams {
  species?: string;
  gene_id?: string;
  gene_name?: string;
  external_name?: string;
  expand?: string[];
}

export interface VariantSearchParams {
  species?: string;
  variant_id?: string;
  region?: string;
  consequence_type?: string;
}

export interface SequenceParams {
  species?: string;
  region?: string;
  coord_system?: string;
  format?: "fasta" | "json";
}
