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
import { logger } from "./logger.js";
import { enrichError, enrichSpeciesError, EnsemblError } from "./error-handler.js";
import { ResponseCache } from "./cache.js";
import {
  resolveBaseUrl,
  getServerIdentifier,
  checkGrch37Support,
  DEFAULT_SERVER,
} from "./species-data.js";

interface RateLimiter {
  lastRequestTime: number;
  minInterval: number; // milliseconds between requests
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: Set<number>;
}

export class EnsemblApiClient {
  private readonly defaultBaseUrl = DEFAULT_SERVER;
  private readonly rateLimiter: RateLimiter = {
    lastRequestTime: 0,
    minInterval: 100, // 100ms = 10 requests per second (conservative)
  };
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableStatuses: new Set([429, 500, 502, 503, 504]),
  };
  private readonly cache = new ResponseCache();
  private releaseVersions = new Map<string, string>();
  private releaseVersionPromises = new Map<string, Promise<string>>();

  private async getReleaseVersion(baseUrl?: string): Promise<string> {
    const server = baseUrl ?? this.defaultBaseUrl;
    const cached = this.releaseVersions.get(server);
    if (cached) return cached;
    // Avoid parallel fetches during startup
    const inflight = this.releaseVersionPromises.get(server);
    if (inflight) return inflight;

    const promise = (async () => {
      let version: string;
      try {
        await this.enforceRateLimit();
        const url = `${server}/info/data`;
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        if (response.ok) {
          const data = (await response.json()) as { releases: number[] };
          version = String(data.releases?.[0] ?? "unknown");
        } else {
          version = "unknown";
        }
      } catch {
        version = "unknown";
      }
      this.releaseVersions.set(server, version);
      logger.info("release_version_fetched", { server, version });
      return version;
    })();

    this.releaseVersionPromises.set(server, promise);
    return promise;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiter.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimiter.minInterval) {
      const waitTime = this.rateLimiter.minInterval - timeSinceLastRequest;
      logger.debug("rate_limit_wait", { wait_ms: waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.lastRequestTime = Date.now();
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    endpoint: string
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          return response;
        }

        // Non-retryable status — fail immediately with enriched error
        if (!this.retryConfig.retryableStatuses.has(response.status)) {
          const responseBody = await response.text().catch(() => "");
          throw enrichError(
            response.status,
            response.statusText,
            endpoint,
            responseBody
          );
        }

        // All retries exhausted on a retryable status
        if (attempt === this.retryConfig.maxRetries) {
          throw new Error(
            `Ensembl API error: ${response.status} ${response.statusText} (after ${attempt + 1} attempts)`
          );
        }

        // Respect Retry-After header (Ensembl sends this on 429)
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(
              this.retryConfig.baseDelay * Math.pow(2, attempt),
              this.retryConfig.maxDelay
            );
        const jitter = Math.random() * delay * 0.25;

        logger.warn("api_retry", {
          endpoint,
          attempt: attempt + 1,
          max_retries: this.retryConfig.maxRetries,
          status: response.status,
          delay_ms: Math.round(delay + jitter),
        });

        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        lastError = new Error(`${response.status} ${response.statusText}`);
      } catch (error) {
        // EnsemblError from enrichError — not retryable, rethrow
        if (error instanceof EnsemblError) {
          throw error;
        }

        // Network errors (timeout, DNS, connection reset) are retryable
        if (
          error instanceof TypeError ||
          (error as any)?.name === "TimeoutError" ||
          (error as any)?.code === "ABORT_ERR"
        ) {
          if (attempt === this.retryConfig.maxRetries) {
            throw new Error(
              `Ensembl API request to ${endpoint} failed after ${attempt + 1} attempts: ${(error as Error).message}`
            );
          }

          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          const jitter = Math.random() * delay * 0.25;

          logger.warn("api_retry_network", {
            endpoint,
            attempt: attempt + 1,
            max_retries: this.retryConfig.maxRetries,
            error: (error as Error).message,
            delay_ms: Math.round(delay + jitter),
          });

          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          lastError = error as Error;
          continue;
        }
        // Unknown errors — rethrow
        throw error;
      }
    }

    throw new Error(
      `Ensembl API request to ${endpoint} failed after ${this.retryConfig.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, string>,
    baseUrl?: string
  ): Promise<T> {
    const server = baseUrl ?? this.defaultBaseUrl;
    const serverPrefix = getServerIdentifier(server);

    // Check cache before rate limiting or network call
    const releaseVersion = await this.getReleaseVersion(server);
    const cacheKey = this.cache.buildKey(releaseVersion, endpoint, params, serverPrefix);
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    await this.enforceRateLimit();

    const url = new URL(`${server}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
    }

    const start = Date.now();
    logger.debug("api_request_start", { endpoint, params, server });

    const response = await this.fetchWithRetry(
      url.toString(),
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      endpoint
    );

    logger.info("api_request_complete", {
      endpoint,
      server,
      status: response.status,
      duration_ms: Date.now() - start,
    });

    const data = (await response.json()) as T;

    // Store in cache with endpoint-appropriate TTL
    const ttl = this.cache.getTtlForEndpoint(endpoint);
    this.cache.set(cacheKey, data, releaseVersion, ttl);

    return data;
  }

  private async makePostRequest<T>(
    endpoint: string,
    body: object,
    params?: Record<string, string>,
    baseUrl?: string
  ): Promise<T> {
    const server = baseUrl ?? this.defaultBaseUrl;
    await this.enforceRateLimit();

    const url = new URL(`${server}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
    }

    const start = Date.now();
    logger.debug("api_post_request_start", { endpoint, params, server });

    const response = await this.fetchWithRetry(
      url.toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
      endpoint
    );

    logger.info("api_post_request_complete", {
      endpoint,
      server,
      status: response.status,
      duration_ms: Date.now() - start,
    });

    return response.json() as T;
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private static readonly BATCH_LIMIT = 200;

  /**
   * Resolve the correct server for a set of tool arguments + endpoint.
   * Throws EnsemblError if the endpoint is unsupported on GRCh37.
   */
  private resolveServerForArgs(
    args: { assembly?: string; species?: string },
    endpoint: string
  ): string {
    const server = resolveBaseUrl(args.assembly, args.species);
    if (server !== this.defaultBaseUrl) {
      const unsupportedMsg = checkGrch37Support(endpoint);
      if (unsupportedMsg) {
        throw new EnsemblError(
          unsupportedMsg,
          400,
          endpoint,
          'Remove the assembly parameter or use assembly: "GRCh38" to access this data.'
        );
      }
    }
    return server;
  }

  private async validateSpecies(species: string, baseUrl?: string): Promise<void> {
    try {
      // Try to get assembly info for the species - this will fail if species is invalid
      await this.makeRequest(`/info/assembly/${species}`, undefined, baseUrl);
    } catch (error) {
      // If it's already an EnsemblError from makeRequest, rethrow as a species-specific one
      throw enrichSpeciesError(species);
    }
  }

  // Feature overlap methods
  async getOverlapByRegion(args: any): Promise<any> {
    const { region, species = "homo_sapiens", feature_types, biotype, assembly } = args;
    const endpoint = `/overlap/region/${species}/${region}`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const params: Record<string, string> = {};

    if (feature_types && feature_types.length > 0) {
      params.feature = feature_types.join(",");
    }
    if (biotype) {
      params.biotype = biotype;
    }

    return this.makeRequest(endpoint, params, baseUrl);
  }

  async getOverlapById(args: any): Promise<any> {
    const { feature_id, species = "homo_sapiens", feature_types, assembly } = args;
    const endpoint = `/overlap/id/${feature_id}`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const params: Record<string, string> = {};

    if (feature_types && feature_types.length > 0) {
      params.feature = feature_types.join(",");
    }

    return this.makeRequest(endpoint, params, baseUrl);
  }

  // Regulatory features
  async getRegulatoryFeatures(args: any): Promise<any> {
    const {
      region,
      protein_id,
      binding_matrix_id,
      species = "homo_sapiens",
      feature_type,
      assembly,
    } = args;
    const params: Record<string, string> = {};

    if (feature_type) {
      params.feature = feature_type;
    }

    if (region) {
      const endpoint = `/overlap/region/${species}/${region}`;
      const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
      return this.makeRequest(endpoint, {
        ...params,
        feature: "RegulatoryFeature",
      }, baseUrl);
    } else if (protein_id) {
      const endpoint = `/overlap/translation/${protein_id}`;
      const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
      return this.makeRequest(endpoint, params, baseUrl);
    } else if (binding_matrix_id) {
      const endpoint = `/species/${species}/binding_matrix/${binding_matrix_id}`;
      const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
      return this.makeRequest(endpoint, params, baseUrl);
    }

    throw new Error(
      "Either region, protein_id, or binding_matrix_id must be provided"
    );
  }

  // Protein features (assembly-independent — protein IDs don't vary by assembly)
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
    const { info_type, species, archive_id, division, assembly } = args;
    // Resolve server — meta endpoints are generally available on both servers
    const baseUrl = resolveBaseUrl(assembly, species);

    if (archive_id) {
      return this.makeRequest(`/archive/id/${archive_id}`, undefined, baseUrl);
    }

    switch (info_type) {
      case "ping":
        return this.makeRequest("/info/ping", undefined, baseUrl);
      case "rest":
        return this.makeRequest("/info/rest", undefined, baseUrl);
      case "software":
        return this.makeRequest("/info/software", undefined, baseUrl);
      case "data":
        return this.makeRequest("/info/data", undefined, baseUrl);
      case "species":
        return this.makeRequest("/info/species", undefined, baseUrl);
      case "divisions":
        return this.makeRequest("/info/divisions", undefined, baseUrl);
      case "assembly":
        if (!species) throw new Error("Species required for assembly info");
        return this.makeRequest(`/info/assembly/${species}`, undefined, baseUrl);
      case "biotypes":
        if (!species) throw new Error("Species required for biotypes info");
        return this.makeRequest(`/info/biotypes/${species}`, undefined, baseUrl);
      case "analysis":
        if (!species) throw new Error("Species required for analysis info");
        return this.makeRequest(`/info/analysis/${species}`, undefined, baseUrl);
      case "external_dbs":
        if (!species) throw new Error("Species required for external_dbs info");
        return this.makeRequest(`/info/external_dbs/${species}`, undefined, baseUrl);
      case "variation":
        if (!species) throw new Error("Species required for variation info");
        return this.makeRequest(`/info/variation/${species}`, undefined, baseUrl);
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
      assembly,
    } = args;
    const params: Record<string, string> = {};

    if (expand && expand.length > 0) {
      params.expand = expand.join(",");
    }

    switch (lookup_type) {
      case "id": {
        const endpoint = `/lookup/id/${identifier}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, params, baseUrl);
      }
      case "symbol": {
        const endpoint = `/lookup/symbol/${species}/${identifier}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, params, baseUrl);
      }
      case "xrefs": {
        if (external_db) {
          const endpoint = `/xrefs/name/${species}/${identifier}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, { external_db }, baseUrl);
        }
        const endpoint = `/xrefs/id/${identifier}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
      case "variant_recoder": {
        const endpoint = `/variant_recoder/${species}/${identifier}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
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
      assembly,
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
      const endpoint = `/sequence/region/${species}/${identifier}`;
      const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
      return this.makeRequest(endpoint, params, baseUrl);
    } else {
      // It's a feature ID
      const typeParam =
        sequence_type !== "genomic" ? `?type=${sequence_type}` : "";
      const endpoint = `/sequence/id/${identifier}${typeParam}`;
      const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
      return this.makeRequest(endpoint, params, baseUrl);
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
      assembly,
    } = args;

    switch (mapping_type) {
      case "cdna": {
        if (!feature_id)
          throw new Error("feature_id required for cDNA mapping");
        const endpoint = `/map/cdna/${feature_id}/${coordinates}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
      case "cds": {
        if (!feature_id) throw new Error("feature_id required for CDS mapping");
        const endpoint = `/map/cds/${feature_id}/${coordinates}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
      case "translation": {
        if (!feature_id)
          throw new Error("feature_id required for translation mapping");
        const endpoint = `/map/translation/${feature_id}/${coordinates}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
      case "assembly": {
        if (!source_assembly || !target_assembly) {
          throw new Error(
            "source_assembly and target_assembly required for assembly mapping"
          );
        }
        // For assembly mapping, use source_assembly for server routing
        const serverAssembly = assembly ?? source_assembly;
        const endpoint = `/map/${species}/${source_assembly}/${coordinates}/${target_assembly}`;
        const baseUrl = this.resolveServerForArgs({ assembly: serverAssembly, species }, endpoint);
        return this.makeRequest(endpoint, undefined, baseUrl);
      }
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
      assembly,
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
      case "homology": {
        if (gene_id) {
          const endpoint = `/homology/id/${species}/${gene_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (gene_symbol) {
          const endpoint = `/homology/symbol/${species}/${gene_symbol}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        }
        throw new Error("Either gene_id or gene_symbol required for homology");
      }

      case "genetree": {
        if (gene_id) {
          const endpoint = `/genetree/id/${gene_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (gene_symbol) {
          const endpoint = `/genetree/member/symbol/${species}/${gene_symbol}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        }
        throw new Error("Either gene_id or gene_symbol required for gene tree");
      }

      case "cafe_tree": {
        if (gene_id) {
          const endpoint = `/cafe/genetree/id/${gene_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (gene_symbol) {
          const endpoint = `/cafe/genetree/member/symbol/${species}/${gene_symbol}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        }
        throw new Error("Either gene_id or gene_symbol required for cafe tree");
      }

      case "alignment": {
        if (!region) throw new Error("region required for alignment");
        const endpoint = `/alignment/region/${species}/${region}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, params, baseUrl);
      }

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
      assembly,
    } = args;
    const params: Record<string, string> = {};

    if (consequence_type) {
      params.consequence_type = consequence_type;
    }
    if (population) {
      params.population_name = population;
    }

    switch (analysis_type) {
      case "variant_info": {
        if (variant_id) {
          const endpoint = `/variation/${species}/${variant_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (region) {
          const endpoint = `/overlap/region/${species}/${region}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, {
            ...params,
            feature: "variation",
          }, baseUrl);
        }
        throw new Error(
          "Either variant_id or region required for variant info"
        );
      }

      case "vep": {
        if (hgvs_notation) {
          const endpoint = `/vep/${species}/hgvs/${hgvs_notation}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (variant_id) {
          const endpoint = `/vep/${species}/id/${variant_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (region) {
          // For region-based VEP, we need allele info - this is simplified
          const endpoint = `/vep/${species}/region/${region}/1`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        }
        throw new Error(
          "Either hgvs_notation, variant_id, or region required for VEP"
        );
      }

      case "ld": {
        if (!variant_id) throw new Error("variant_id required for LD analysis");
        const endpoint = `/ld/${species}/${variant_id}/1000GENOMES:phase_3:EUR`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, params, baseUrl);
      }

      case "phenotype": {
        if (variant_id) {
          const endpoint = `/phenotype/variant/${species}/${variant_id}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        } else if (region) {
          const endpoint = `/phenotype/region/${species}/${region}`;
          const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
          return this.makeRequest(endpoint, params, baseUrl);
        }
        throw new Error("Either variant_id or region required for phenotype");
      }

      case "haplotypes": {
        if (!transcript_id)
          throw new Error("transcript_id required for haplotype analysis");
        const endpoint = `/transcript_haplotypes/${species}/${transcript_id}`;
        const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
        return this.makeRequest(endpoint, params, baseUrl);
      }

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

  // Batch operations

  async batchLookupIds(ids: string[], assembly?: string): Promise<Record<string, any>> {
    const endpoint = "/lookup/id";
    const baseUrl = this.resolveServerForArgs({ assembly }, endpoint);
    const chunks = this.chunk(ids, EnsemblApiClient.BATCH_LIMIT);
    const results: Record<string, any> = {};
    for (const chunk of chunks) {
      const response = await this.makePostRequest<Record<string, any>>(
        endpoint,
        { ids: chunk },
        undefined,
        baseUrl
      );
      Object.assign(results, response);
    }
    return results;
  }

  async batchLookupSymbols(
    species: string,
    symbols: string[],
    assembly?: string
  ): Promise<Record<string, any>> {
    const endpoint = `/lookup/symbol/${species}`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const chunks = this.chunk(symbols, EnsemblApiClient.BATCH_LIMIT);
    const results: Record<string, any> = {};
    for (const chunk of chunks) {
      const response = await this.makePostRequest<Record<string, any>>(
        endpoint,
        { symbols: chunk },
        undefined,
        baseUrl
      );
      Object.assign(results, response);
    }
    return results;
  }

  async batchSequenceIds(
    ids: string[],
    type?: string,
    assembly?: string
  ): Promise<any[]> {
    const endpoint = "/sequence/id";
    const baseUrl = this.resolveServerForArgs({ assembly }, endpoint);
    const params: Record<string, string> = {};
    if (type) params.type = type;
    const chunks = this.chunk(ids, EnsemblApiClient.BATCH_LIMIT);
    const results: any[] = [];
    for (const chunk of chunks) {
      const response = await this.makePostRequest<any[]>(
        endpoint,
        { ids: chunk },
        params,
        baseUrl
      );
      results.push(...response);
    }
    return results;
  }

  async batchSequenceRegions(
    species: string,
    regions: string[],
    assembly?: string
  ): Promise<any[]> {
    const endpoint = `/sequence/region/${species}`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const chunks = this.chunk(regions, EnsemblApiClient.BATCH_LIMIT);
    const results: any[] = [];
    for (const chunk of chunks) {
      const response = await this.makePostRequest<any[]>(
        endpoint,
        { regions: chunk },
        undefined,
        baseUrl
      );
      results.push(...response);
    }
    return results;
  }

  async batchVepIds(species: string, ids: string[], assembly?: string): Promise<any[]> {
    const endpoint = `/vep/${species}/id`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const chunks = this.chunk(ids, EnsemblApiClient.BATCH_LIMIT);
    const results: any[] = [];
    for (const chunk of chunks) {
      const response = await this.makePostRequest<any[]>(
        endpoint,
        { ids: chunk },
        undefined,
        baseUrl
      );
      results.push(...response);
    }
    return results;
  }

  async batchVepHgvs(
    species: string,
    notations: string[],
    assembly?: string
  ): Promise<any[]> {
    const endpoint = `/vep/${species}/hgvs`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const chunks = this.chunk(notations, EnsemblApiClient.BATCH_LIMIT);
    const results: any[] = [];
    for (const chunk of chunks) {
      const response = await this.makePostRequest<any[]>(
        endpoint,
        { hgvs_notations: chunk },
        undefined,
        baseUrl
      );
      results.push(...response);
    }
    return results;
  }

  async batchVariationIds(
    species: string,
    ids: string[],
    assembly?: string
  ): Promise<Record<string, any>> {
    const endpoint = `/variation/${species}`;
    const baseUrl = this.resolveServerForArgs({ assembly, species }, endpoint);
    const chunks = this.chunk(ids, EnsemblApiClient.BATCH_LIMIT);
    const results: Record<string, any> = {};
    for (const chunk of chunks) {
      const response = await this.makePostRequest<Record<string, any>>(
        endpoint,
        { ids: chunk },
        undefined,
        baseUrl
      );
      Object.assign(results, response);
    }
    return results;
  }
}
