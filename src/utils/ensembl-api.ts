import type {
  EnsemblGene,
  EnsemblTranscript,
  EnsemblVariant,
  EnsemblSequence,
  EnsemblSpecies,
  GeneSearchParams,
  VariantSearchParams,
  SequenceParams,
} from "../types/ensembl";

interface RateLimiter {
  lastRequestTime: number;
  minInterval: number; // milliseconds between requests
}

export class EnsemblApiClient {
  private readonly baseUrl = "https://rest.ensembl.org";
  private readonly rateLimiter: RateLimiter = {
    lastRequestTime: 0,
    minInterval: 100, // 100ms = 10 requests per second (conservative)
  };

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiter.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimiter.minInterval) {
      const waitTime = this.rateLimiter.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.lastRequestTime = Date.now();
  }

  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Ensembl API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as T;
  }

  private async validateSpecies(species: string): Promise<void> {
    try {
      // Try to get assembly info for the species - this will fail if species is invalid
      await this.makeRequest(`/info/assembly/${species}`);
    } catch (error) {
      throw new Error(`Invalid species: ${species}`);
    }
  }

  // Feature overlap methods
  async getOverlapByRegion(args: any): Promise<any> {
    const { region, species = "homo_sapiens", feature_types, biotype } = args;
    const params: Record<string, string> = {};

    if (feature_types && feature_types.length > 0) {
      params.feature = feature_types.join(",");
    }
    if (biotype) {
      params.biotype = biotype;
    }

    return this.makeRequest(`/overlap/region/${species}/${region}`, params);
  }

  async getOverlapById(args: any): Promise<any> {
    const { feature_id, species = "homo_sapiens", feature_types } = args;
    const params: Record<string, string> = {};

    if (feature_types && feature_types.length > 0) {
      params.feature = feature_types.join(",");
    }

    return this.makeRequest(`/overlap/id/${feature_id}`, params);
  }

  // Regulatory features
  async getRegulatoryFeatures(args: any): Promise<any> {
    const {
      region,
      protein_id,
      binding_matrix_id,
      species = "homo_sapiens",
      feature_type,
    } = args;
    const params: Record<string, string> = {};

    if (feature_type) {
      params.feature = feature_type;
    }

    if (region) {
      return this.makeRequest(`/overlap/region/${species}/${region}`, {
        ...params,
        feature: "RegulatoryFeature",
      });
    } else if (protein_id) {
      return this.makeRequest(`/overlap/translation/${protein_id}`, params);
    } else if (binding_matrix_id) {
      return this.makeRequest(
        `/species/${species}/binding_matrix/${binding_matrix_id}`,
        params
      );
    }

    throw new Error(
      "Either region, protein_id, or binding_matrix_id must be provided"
    );
  }

  // Protein features
  async getProteinFeatures(args: any): Promise<any> {
    const { protein_id, feature_type, species = "homo_sapiens" } = args;

    if (!protein_id) {
      throw new Error("protein_id is required");
    }

    // Validate species if provided and not default
    if (species && species !== "homo_sapiens") {
      await this.validateSpecies(species);
    }

    const params: Record<string, string> = {};

    if (feature_type) {
      params.type = feature_type;
    }

    return this.makeRequest(`/overlap/translation/${protein_id}`, params);
  }

  // Meta information
  async getMetaInfo(args: any): Promise<any> {
    const { info_type, species, archive_id, division } = args;

    if (archive_id) {
      return this.makeRequest(`/archive/id/${archive_id}`);
    }

    switch (info_type) {
      case "ping":
        return this.makeRequest("/info/ping");
      case "rest":
        return this.makeRequest("/info/rest");
      case "software":
        return this.makeRequest("/info/software");
      case "data":
        return this.makeRequest("/info/data");
      case "species":
        return this.makeRequest("/info/species");
      case "divisions":
        return this.makeRequest("/info/divisions");
      case "assembly":
        if (!species) throw new Error("Species required for assembly info");
        return this.makeRequest(`/info/assembly/${species}`);
      case "biotypes":
        if (!species) throw new Error("Species required for biotypes info");
        return this.makeRequest(`/info/biotypes/${species}`);
      case "analysis":
        if (!species) throw new Error("Species required for analysis info");
        return this.makeRequest(`/info/analysis/${species}`);
      case "external_dbs":
        if (!species) throw new Error("Species required for external_dbs info");
        return this.makeRequest(`/info/external_dbs/${species}`);
      case "variation":
        if (!species) throw new Error("Species required for variation info");
        return this.makeRequest(`/info/variation/${species}`);
      default:
        throw new Error(`Unknown info_type: ${info_type}`);
    }
  }

  // Lookup operations
  async performLookup(args: any): Promise<any> {
    const {
      identifier,
      lookup_type = "id",
      species = "homo_sapiens",
      expand,
      external_db,
    } = args;
    const params: Record<string, string> = {};

    if (expand && expand.length > 0) {
      params.expand = expand.join(",");
    }

    switch (lookup_type) {
      case "id":
        return this.makeRequest(`/lookup/id/${identifier}`, params);
      case "symbol":
        return this.makeRequest(
          `/lookup/symbol/${species}/${identifier}`,
          params
        );
      case "xrefs":
        if (external_db) {
          return this.makeRequest(`/xrefs/name/${species}/${identifier}`, {
            external_db,
          });
        }
        return this.makeRequest(`/xrefs/id/${identifier}`);
      case "variant_recoder":
        return this.makeRequest(`/variant_recoder/${species}/${identifier}`);
      default:
        throw new Error(`Unknown lookup_type: ${lookup_type}`);
    }
  }

  // Sequence data (enhanced version of existing getSequence)
  async getSequenceData(args: any): Promise<any> {
    const {
      identifier,
      sequence_type = "genomic",
      species = "homo_sapiens",
      format = "json",
      mask,
    } = args;
    const params: Record<string, string> = {};

    if (mask) {
      params.mask = mask;
    }
    if (format === "fasta") {
      params.content_type = "text/x-fasta";
    }

    // Check if identifier looks like a region (contains :)
    if (identifier.includes(":")) {
      return this.makeRequest(
        `/sequence/region/${species}/${identifier}`,
        params
      );
    } else {
      // It's a feature ID
      const typeParam =
        sequence_type !== "genomic" ? `?type=${sequence_type}` : "";
      return this.makeRequest(`/sequence/id/${identifier}${typeParam}`, params);
    }
  }

  // Coordinate mapping
  async mapCoordinates(args: any): Promise<any> {
    const {
      coordinates,
      feature_id,
      mapping_type,
      source_assembly,
      target_assembly,
      species = "homo_sapiens",
    } = args;

    switch (mapping_type) {
      case "cdna":
        if (!feature_id)
          throw new Error("feature_id required for cDNA mapping");
        return this.makeRequest(`/map/cdna/${feature_id}/${coordinates}`);
      case "cds":
        if (!feature_id) throw new Error("feature_id required for CDS mapping");
        return this.makeRequest(`/map/cds/${feature_id}/${coordinates}`);
      case "translation":
        if (!feature_id)
          throw new Error("feature_id required for translation mapping");
        return this.makeRequest(
          `/map/translation/${feature_id}/${coordinates}`
        );
      case "assembly":
        if (!source_assembly || !target_assembly) {
          throw new Error(
            "source_assembly and target_assembly required for assembly mapping"
          );
        }
        return this.makeRequest(
          `/map/${species}/${source_assembly}/${coordinates}/${target_assembly}`
        );
      default:
        throw new Error(`Unknown mapping_type: ${mapping_type}`);
    }
  }

  // Comparative genomics
  async getComparativeData(args: any): Promise<any> {
    const {
      gene_id,
      gene_symbol,
      region,
      analysis_type,
      species = "homo_sapiens",
      target_species,
      homology_type = "all",
      aligned,
    } = args;
    const params: Record<string, string> = {};

    if (aligned !== undefined) {
      params.aligned = aligned.toString();
    }
    if (target_species) {
      params.target_species = target_species;
    }
    if (homology_type !== "all") {
      params.type = homology_type;
    }

    switch (analysis_type) {
      case "homology":
        if (gene_id) {
          return this.makeRequest(`/homology/id/${species}/${gene_id}`, params);
        } else if (gene_symbol) {
          return this.makeRequest(
            `/homology/symbol/${species}/${gene_symbol}`,
            params
          );
        }
        throw new Error("Either gene_id or gene_symbol required for homology");

      case "genetree":
        if (gene_id) {
          return this.makeRequest(`/genetree/id/${gene_id}`, params);
        } else if (gene_symbol) {
          return this.makeRequest(
            `/genetree/member/symbol/${species}/${gene_symbol}`,
            params
          );
        }
        throw new Error("Either gene_id or gene_symbol required for gene tree");

      case "cafe_tree":
        if (gene_id) {
          return this.makeRequest(`/cafe/genetree/id/${gene_id}`, params);
        } else if (gene_symbol) {
          return this.makeRequest(
            `/cafe/genetree/member/symbol/${species}/${gene_symbol}`,
            params
          );
        }
        throw new Error("Either gene_id or gene_symbol required for cafe tree");

      case "alignment":
        if (!region) throw new Error("region required for alignment");
        return this.makeRequest(
          `/alignment/region/${species}/${region}`,
          params
        );

      default:
        throw new Error(`Unknown analysis_type: ${analysis_type}`);
    }
  }

  // Variation data
  async getVariationData(args: any): Promise<any> {
    const {
      variant_id,
      region,
      hgvs_notation,
      analysis_type,
      species = "homo_sapiens",
      consequence_type,
      population,
      transcript_id,
    } = args;
    const params: Record<string, string> = {};

    if (consequence_type) {
      params.consequence_type = consequence_type;
    }
    if (population) {
      params.population_name = population;
    }

    switch (analysis_type) {
      case "variant_info":
        if (variant_id) {
          return this.makeRequest(
            `/variation/${species}/${variant_id}`,
            params
          );
        } else if (region) {
          return this.makeRequest(`/overlap/region/${species}/${region}`, {
            ...params,
            feature: "variation",
          });
        }
        throw new Error(
          "Either variant_id or region required for variant info"
        );

      case "vep":
        if (hgvs_notation) {
          return this.makeRequest(
            `/vep/${species}/hgvs/${hgvs_notation}`,
            params
          );
        } else if (variant_id) {
          return this.makeRequest(`/vep/${species}/id/${variant_id}`, params);
        } else if (region) {
          // For region-based VEP, we need allele info - this is simplified
          return this.makeRequest(`/vep/${species}/region/${region}/1`, params);
        }
        throw new Error(
          "Either hgvs_notation, variant_id, or region required for VEP"
        );

      case "ld":
        if (!variant_id) throw new Error("variant_id required for LD analysis");
        return this.makeRequest(
          `/ld/${species}/${variant_id}/1000GENOMES:phase_3:EUR`,
          params
        );

      case "phenotype":
        if (variant_id) {
          return this.makeRequest(
            `/phenotype/variant/${species}/${variant_id}`,
            params
          );
        } else if (region) {
          return this.makeRequest(
            `/phenotype/region/${species}/${region}`,
            params
          );
        }
        throw new Error("Either variant_id or region required for phenotype");

      case "haplotypes":
        if (!transcript_id)
          throw new Error("transcript_id required for haplotype analysis");
        return this.makeRequest(
          `/transcript_haplotypes/${species}/${transcript_id}`,
          params
        );

      default:
        throw new Error(`Unknown analysis_type: ${analysis_type}`);
    }
  }

  // Ontology and taxonomy
  async getOntologyTaxonomy(args: any): Promise<any> {
    const { term, ontology, term_id, species, relation } = args;
    const params: Record<string, string> = {};

    if (relation) {
      params.relation = relation;
    }

    if (term_id) {
      return this.makeRequest(`/ontology/id/${term_id}`, params);
    }

    if (ontology === "taxonomy") {
      if (species) {
        return this.makeRequest(`/taxonomy/id/${species}`, params);
      } else if (term) {
        return this.makeRequest(`/taxonomy/name/${term}`, params);
      }
    } else if (ontology && term) {
      return this.makeRequest(`/ontology/name/${term}`, {
        ...params,
        ontology,
      });
    }

    throw new Error(
      "Invalid combination of parameters for ontology/taxonomy search"
    );
  }

  // Gene operations
  async getGeneById(
    geneId: string,
    species: string = "homo_sapiens"
  ): Promise<EnsemblGene> {
    return this.makeRequest<EnsemblGene>(`/lookup/id/${geneId}`, { species });
  }

  async searchGenes(params: GeneSearchParams): Promise<EnsemblGene[]> {
    const {
      species = "homo_sapiens",
      gene_name,
      external_name,
      expand,
    } = params;

    if (gene_name) {
      const queryParams: Record<string, string> = {};
      if (expand && expand.length > 0) {
        queryParams.expand = expand.join(",");
      }

      const results = await this.makeRequest<EnsemblGene[]>(
        `/lookup/symbol/${species}/${gene_name}`,
        queryParams
      );
      return Array.isArray(results) ? results : [results];
    }

    if (external_name) {
      return this.makeRequest<EnsemblGene[]>(
        `/xrefs/symbol/${species}/${external_name}`
      );
    }

    throw new Error("Either gene_name or external_name must be provided");
  }

  // Transcript operations
  async getTranscriptById(transcriptId: string): Promise<EnsemblTranscript> {
    return this.makeRequest<EnsemblTranscript>(`/lookup/id/${transcriptId}`);
  }

  async getTranscriptsForGene(geneId: string): Promise<EnsemblTranscript[]> {
    const gene = await this.makeRequest<EnsemblGene>(`/lookup/id/${geneId}`, {
      expand: "Transcript",
    });
    return (gene as any).Transcript || [];
  }

  // Sequence operations
  async getSequence(params: SequenceParams): Promise<EnsemblSequence> {
    const {
      species = "homo_sapiens",
      region,
      coord_system = "chromosome",
      format = "json",
    } = params;

    if (!region) {
      throw new Error("Region is required for sequence retrieval");
    }

    return this.makeRequest<EnsemblSequence>(
      `/sequence/region/${species}/${region}`,
      {
        coord_system,
        content_type: format === "fasta" ? "text/x-fasta" : "application/json",
      }
    );
  }

  // Variant operations
  async getVariantById(variantId: string): Promise<EnsemblVariant> {
    return this.makeRequest<EnsemblVariant>(`/variation/${variantId}`);
  }

  async getVariantsInRegion(
    params: VariantSearchParams
  ): Promise<EnsemblVariant[]> {
    const { species = "homo_sapiens", region, consequence_type } = params;

    if (!region) {
      throw new Error("Region is required for variant search");
    }

    const queryParams: Record<string, string> = {};
    if (consequence_type) {
      queryParams.consequence_type = consequence_type;
    }

    return this.makeRequest<EnsemblVariant[]>(
      `/variation/${species}/${region}`,
      queryParams
    );
  }

  // Species operations
  async getAllSpecies(): Promise<EnsemblSpecies[]> {
    const response = await this.makeRequest<{ species: EnsemblSpecies[] }>(
      "/info/species"
    );
    return response.species;
  }

  async getSpeciesInfo(species: string): Promise<EnsemblSpecies> {
    const allSpecies = await this.getAllSpecies();
    const found = allSpecies.find(
      (s) => s.name === species || s.common_name === species
    );

    if (!found) {
      throw new Error(`Species '${species}' not found`);
    }

    return found;
  }

  // Assembly and genome info
  async getAssemblyInfo(species: string = "homo_sapiens"): Promise<any> {
    return this.makeRequest(`/info/assembly/${species}`);
  }

  // Cross-references
  async getGeneXrefs(geneId: string): Promise<any[]> {
    return this.makeRequest(`/xrefs/id/${geneId}`);
  }
}
