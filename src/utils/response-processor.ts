interface ProcessOptions {
  maxResults?: number;
  fields?: string[];
  fullResponse?: boolean;
  page?: number;
  pageSize?: number;
}

interface ProcessedResponse {
  summary?: string;
  metadata: {
    total_results: number;
    returned: number;
    truncated: boolean;
    page?: number;
    page_size?: number;
    total_pages?: number;
    has_next?: boolean;
  };
  data: unknown;
  tip?: string;
}

interface ToolDefaults {
  maxResults: number;
  fields: string[];
}

const DEFAULTS: Record<string, ToolDefaults> = {
  ensembl_feature_overlap: {
    maxResults: 50,
    fields: [
      "id",
      "feature_type",
      "seq_region_name",
      "start",
      "end",
      "strand",
      "biotype",
      "external_name",
    ],
  },
  ensembl_meta_species: {
    maxResults: 50,
    fields: ["name", "common_name", "assembly", "taxonomy_id", "display_name"],
  },
  ensembl_compara: {
    maxResults: 100,
    fields: ["id", "species", "perc_id", "type"],
  },
  ensembl_variation_vep: {
    maxResults: 50,
    fields: [
      "id",
      "most_severe_consequence",
      "transcript_consequences",
    ],
  },
  ensembl_regulatory: {
    maxResults: 50,
    fields: [
      "id",
      "feature_type",
      "seq_region_name",
      "start",
      "end",
      "strand",
      "bound_start",
      "bound_end",
      "description",
    ],
  },
};

function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }
  return result;
}

function truncateArray(
  arr: unknown[],
  maxResults: number,
  fields?: string[],
  page?: number,
  pageSize?: number
): {
  data: unknown[];
  total: number;
  truncated: boolean;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  hasNext?: boolean;
} {
  const total = arr.length;
  const isPaginated = page != null || pageSize != null;
  const effectiveSize = pageSize ?? maxResults;
  const effectivePage = page ?? 1;
  const offset = (effectivePage - 1) * effectiveSize;

  let sliced: unknown[];
  let truncated: boolean;

  if (isPaginated) {
    sliced = arr.slice(offset, offset + effectiveSize);
    truncated = total > effectiveSize;
  } else {
    truncated = total > maxResults;
    sliced = truncated ? arr.slice(0, maxResults) : arr;
  }

  if (fields && fields.length > 0) {
    sliced = sliced.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return pickFields(item as Record<string, unknown>, fields);
      }
      return item;
    });
  }

  if (isPaginated) {
    const totalPages = effectiveSize > 0 ? Math.ceil(total / effectiveSize) : 0;
    return {
      data: sliced,
      total,
      truncated,
      page: effectivePage,
      pageSize: effectiveSize,
      totalPages,
      hasNext: effectivePage < totalPages,
    };
  }

  return { data: sliced, total, truncated };
}

function truncateSequence(data: unknown): unknown {
  if (typeof data === "string" && data.length > 10000) {
    const first500 = data.slice(0, 500);
    const last500 = data.slice(-500);
    return `${first500}\n... [truncated, full length: ${data.length.toLocaleString()} bp] ...\n${last500}`;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.seq === "string" && obj.seq.length > 10000) {
      return {
        ...obj,
        seq: `${obj.seq.slice(0, 500)}\n... [truncated, full length: ${obj.seq.length.toLocaleString()} bp] ...\n${obj.seq.slice(-500)}`,
        _original_length: obj.seq.length,
      };
    }
  }

  return data;
}

function flattenGeneTree(tree: Record<string, unknown>): unknown[] {
  const leaves: unknown[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as Record<string, unknown>);
      }
    } else {
      // Leaf node
      const taxonomy = node.taxonomy as Record<string, unknown> | undefined;
      const gene = node.gene as Record<string, unknown> | undefined;
      const sequence = node.sequence as Record<string, unknown> | undefined;
      const seqId = sequence?.id;
      leaves.push({
        id: node.id,
        species: taxonomy?.scientific_name ?? node.species,
        gene_symbol: gene?.external_name,
        gene_id: node.id,
        protein_id: Array.isArray(seqId) ? seqId[0] : seqId,
      });
    }
  }

  if (tree.tree) {
    walk(tree.tree as Record<string, unknown>);
  } else {
    walk(tree);
  }

  return leaves;
}

function processVepConsequences(data: unknown[]): unknown[] {
  return data.map((item) => {
    if (!item || typeof item !== "object") return item;
    const obj = item as Record<string, unknown>;

    const trimmed: Record<string, unknown> = {
      id: obj.id ?? obj.input,
      most_severe_consequence: obj.most_severe_consequence,
    };

    if (Array.isArray(obj.transcript_consequences)) {
      trimmed.transcript_consequences = obj.transcript_consequences.map(
        (tc: Record<string, unknown>) => ({
          gene_symbol: tc.gene_symbol,
          gene_id: tc.gene_id,
          transcript_id: tc.transcript_id,
          consequence_terms: tc.consequence_terms,
          impact: tc.impact,
          biotype: tc.biotype,
          amino_acids: tc.amino_acids,
          codons: tc.codons,
        })
      );
    }

    return trimmed;
  });
}

function buildPaginatedResponse(
  label: string,
  truncResult: ReturnType<typeof truncateArray>,
): ProcessedResponse {
  const { data, total, truncated, page, pageSize, totalPages, hasNext } = truncResult;
  const isPaginated = page != null;

  let summary: string;
  if (isPaginated) {
    summary = `Found ${total} ${label}. Showing page ${page} of ${totalPages} (${data.length} items).`;
  } else {
    summary = `Found ${total} ${label}. Showing first ${data.length}. Use page/page_size or max_results to see more.`;
  }

  const metadata: ProcessedResponse["metadata"] = {
    total_results: total,
    returned: (data as unknown[]).length,
    truncated,
  };

  if (isPaginated) {
    metadata.page = page;
    metadata.page_size = pageSize;
    metadata.total_pages = totalPages;
    metadata.has_next = hasNext;
  }

  return { summary, metadata, data, tip: "Set raw=true to get the full unprocessed API response." };
}

export function processResponse(
  toolName: string,
  data: unknown,
  options?: ProcessOptions
): unknown {
  if (options?.fullResponse) {
    return {
      raw_response: true,
      note: "The user requested raw output. Return ONLY the JSON below in a code block. Do NOT add any summary, explanation, or commentary before or after it.",
      data,
    };
  }

  // Error responses pass through
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    return data;
  }

  // Sequence truncation (any tool can return sequences)
  if (toolName === "ensembl_sequence") {
    return truncateSequence(data);
  }

  // Feature overlap
  if (toolName === "ensembl_feature_overlap" && Array.isArray(data)) {
    const defaults = DEFAULTS.ensembl_feature_overlap!;
    const maxResults = options?.maxResults ?? defaults.maxResults;
    const fields = options?.fields ?? defaults.fields;
    const truncResult = truncateArray(data, maxResults, fields, options?.page, options?.pageSize);

    if (!truncResult.truncated && truncResult.page == null) return data;

    return buildPaginatedResponse("overlapping features", truncResult);
  }

  // Regulatory features
  if (toolName === "ensembl_regulatory" && Array.isArray(data)) {
    const defaults = DEFAULTS.ensembl_regulatory!;
    const maxResults = options?.maxResults ?? defaults.maxResults;
    const fields = options?.fields ?? defaults.fields;
    const truncResult = truncateArray(data, maxResults, fields, options?.page, options?.pageSize);

    if (!truncResult.truncated && truncResult.page == null) return data;

    return buildPaginatedResponse("regulatory features", truncResult);
  }

  // Meta species list
  if (toolName === "ensembl_meta" && Array.isArray(data)) {
    const defaults = DEFAULTS.ensembl_meta_species!;
    const maxResults = options?.maxResults ?? defaults.maxResults;
    const fields = options?.fields ?? defaults.fields;
    const truncResult = truncateArray(data, maxResults, fields, options?.page, options?.pageSize);

    if (!truncResult.truncated && truncResult.page == null) return data;

    return buildPaginatedResponse("species", truncResult);
  }

  // Compara - gene tree flattening
  if (toolName === "ensembl_compara") {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      // Gene tree response has a "tree" property with nested structure
      if (obj.tree && typeof obj.tree === "object") {
        const defaults = DEFAULTS.ensembl_compara!;
        const maxResults = options?.maxResults ?? defaults.maxResults;
        const leaves = flattenGeneTree(obj);
        const truncResult = truncateArray(leaves, maxResults, undefined, options?.page, options?.pageSize);

        const isPaginated = truncResult.page != null;
        let summary: string;
        if (isPaginated) {
          summary = `Gene tree contains ${truncResult.total} leaf nodes (species/gene pairs). Showing page ${truncResult.page} of ${truncResult.totalPages} (${(truncResult.data as unknown[]).length} items).`;
        } else {
          summary = `Gene tree contains ${truncResult.total} leaf nodes (species/gene pairs).${truncResult.truncated ? ` Showing first ${(truncResult.data as unknown[]).length}. Use page/page_size or max_results to see more.` : ""}`;
        }

        const metadata: ProcessedResponse["metadata"] = {
          total_results: truncResult.total,
          returned: (truncResult.data as unknown[]).length,
          truncated: truncResult.truncated,
        };
        if (isPaginated) {
          metadata.page = truncResult.page;
          metadata.page_size = truncResult.pageSize;
          metadata.total_pages = truncResult.totalPages;
          metadata.has_next = truncResult.hasNext;
        }

        return { summary, metadata, data: truncResult.data, tip: "Set raw=true to get the full unprocessed API response." } as ProcessedResponse;
      }

      // Homology response
      if (obj.data && Array.isArray(obj.data)) {
        const homologies = obj.data.flatMap((d: Record<string, unknown>) =>
          Array.isArray(d.homologies) ? d.homologies : []
        );
        const defaults = DEFAULTS.ensembl_compara!;
        const maxResults = options?.maxResults ?? defaults.maxResults;
        const truncResult = truncateArray(homologies, maxResults, undefined, options?.page, options?.pageSize);

        if (!truncResult.truncated && truncResult.page == null) return data;

        return buildPaginatedResponse("homologs", truncResult);
      }
    }

    // Array response (e.g., alignments)
    if (Array.isArray(data)) {
      const defaults = DEFAULTS.ensembl_compara!;
      const maxResults = options?.maxResults ?? defaults.maxResults;
      const truncResult = truncateArray(data, maxResults, undefined, options?.page, options?.pageSize);

      if (!truncResult.truncated && truncResult.page == null) return data;

      return buildPaginatedResponse("results", truncResult);
    }
  }

  // Variation / VEP
  if (toolName === "ensembl_variation") {
    if (Array.isArray(data)) {
      const defaults = DEFAULTS.ensembl_variation_vep!;
      const maxResults = options?.maxResults ?? defaults.maxResults;

      // Check if this looks like VEP output
      const isVep =
        data.length > 0 &&
        data[0] &&
        typeof data[0] === "object" &&
        "most_severe_consequence" in (data[0] as Record<string, unknown>);

      const processed = isVep ? processVepConsequences(data) : data;
      const truncResult = truncateArray(processed, maxResults, undefined, options?.page, options?.pageSize);

      if (!truncResult.truncated && !isVep && truncResult.page == null) return data;

      return buildPaginatedResponse("variant results", truncResult);
    }
  }

  // Default: pass through unmodified
  return data;
}
