import type {
  EnsemblGene,
  EnsemblTranscript,
  EnsemblVariant,
  EnsemblSequence,
  EnsemblSpecies,
  GeneSearchParams,
  VariantSearchParams,
  SequenceParams,
} from "../types/ensembl.js";

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
