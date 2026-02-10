/**
 * Presentation-ready formatter for MCP tool responses.
 * Converts raw JSON into human-readable text (key-value blocks, markdown tables, FASTA)
 * so the LLM can relay data verbatim instead of summarizing.
 */

const SOURCE_LINE = "\n\n---\nSource: Ensembl REST API (https://rest.ensembl.org)";

// ---------- Type guards ----------

interface ErrorResponse {
  error: string;
  suggestion?: string;
  example?: string;
  success: false;
}

interface ProcessedResponse {
  summary?: string;
  metadata: {
    total_results: number;
    returned: number;
    truncated: boolean;
  };
  data: unknown;
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    data !== null &&
    typeof data === "object" &&
    "error" in data &&
    "success" in data &&
    (data as any).success === false
  );
}

function isProcessedResponse(data: unknown): data is ProcessedResponse {
  return (
    data !== null &&
    typeof data === "object" &&
    "metadata" in data &&
    "data" in data &&
    typeof (data as any).metadata === "object" &&
    "total_results" in (data as any).metadata
  );
}

// ---------- Helpers ----------

function kvBlock(obj: Record<string, unknown>, keys?: string[]): string {
  const entries = keys
    ? keys
        .filter((k) => obj[k] !== undefined && obj[k] !== null)
        .map((k) => [k, obj[k]] as const)
    : Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

function mdTable(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "(no results)";

  const cols = columns ?? Object.keys(rows[0]!);
  const header = `| ${cols.join(" | ")} |`;
  const separator = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const cells = cols.map((c) => {
      const val = row[c];
      if (val === undefined || val === null) return "";
      if (Array.isArray(val)) return val.join(", ");
      return String(val);
    });
    return `| ${cells.join(" | ")} |`;
  });

  return [header, separator, ...body].join("\n");
}

function formatLocation(obj: Record<string, unknown>): string {
  const chr = obj.seq_region_name ?? obj.chr ?? "";
  const start = obj.start ?? "";
  const end = obj.end ?? "";
  const strand =
    obj.strand !== undefined
      ? Number(obj.strand) >= 0
        ? "(+)"
        : "(-)"
      : "";
  return `${chr}:${start}-${end} ${strand}`.trim();
}

function toFasta(id: string, desc: string, seq: string): string {
  const header = desc ? `>${id} ${desc}` : `>${id}`;
  const lines: string[] = [header];
  for (let i = 0; i < seq.length; i += 60) {
    lines.push(seq.slice(i, i + 60));
  }
  return lines.join("\n");
}

// ---------- Tool formatters ----------

function formatLookup(data: unknown, args: any): string {
  const lookupType = args?.lookup_type ?? "id";
  const identifier = args?.identifier;

  // Batch: identifier is array -> data is Record<string, object>
  if (Array.isArray(identifier)) {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const entries = Object.values(data as Record<string, any>).filter(
        Boolean
      );
      if (entries.length === 0) return "(no results)";

      const rows = entries.map((e: any) => ({
        id: e.id ?? "",
        display_name: e.display_name ?? "",
        species: e.species ?? "",
        biotype: e.biotype ?? "",
        location: formatLocation(e),
        object_type: e.object_type ?? "",
      }));
      return (
        `## Batch Lookup (${entries.length} results)\n\n` +
        mdTable(rows, [
          "id",
          "display_name",
          "species",
          "biotype",
          "location",
          "object_type",
        ])
      );
    }
  }

  // xrefs: returns array
  if (lookupType === "xrefs" && Array.isArray(data)) {
    const rows = (data as any[]).map((x) => ({
      database: x.dbname ?? x.db_display_name ?? "",
      primary_id: x.primary_id ?? "",
      display_id: x.display_id ?? "",
      description: x.description ?? "",
    }));
    return (
      `## Cross-references for ${identifier}\n\n` +
      mdTable(rows, ["database", "primary_id", "display_id", "description"])
    );
  }

  // variant_recoder: pass through as JSON
  if (lookupType === "variant_recoder") {
    return JSON.stringify(data, null, 2);
  }

  // Single lookup: object
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, any>;
    const lines: string[] = [];

    if (d.display_name || d.id) {
      lines.push(`## ${d.display_name ?? d.id}`);
    }

    const fields: [string, unknown][] = [
      ["ID", d.id],
      ["Name", d.display_name],
      ["Species", d.species],
      ["Type", d.object_type],
      ["Biotype", d.biotype],
      ["Location", formatLocation(d)],
      ["Description", d.description],
      ["Source", d.source],
      ["Logic name", d.logic_name],
      ["Version", d.version],
    ];

    for (const [label, value] of fields) {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`${label}: ${value}`);
      }
    }

    return lines.join("\n");
  }

  return JSON.stringify(data, null, 2);
}

function formatSequence(data: unknown, args: any): string {
  // Single sequence object
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, any>;
    if (d.seq) {
      const desc = [d.desc ?? d.description ?? "", d.molecule ? `molecule:${d.molecule}` : ""]
        .filter(Boolean)
        .join(" ");
      return toFasta(d.id ?? args?.identifier ?? "sequence", desc, d.seq);
    }
  }

  // Batch: array of sequence objects
  if (Array.isArray(data)) {
    return (data as any[])
      .map((item) => {
        if (item.seq) {
          const desc = item.desc ?? item.description ?? "";
          return toFasta(item.id ?? "", desc, item.seq);
        }
        return JSON.stringify(item, null, 2);
      })
      .join("\n\n");
  }

  // Already a string (FASTA or truncated)
  if (typeof data === "string") return data;

  return JSON.stringify(data, null, 2);
}

function formatVariation(data: unknown, args: any): string {
  const analysisType = args?.analysis_type;

  // variant_info (single): object with name, source, MAF, etc.
  if (
    analysisType === "variant_info" &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const d = data as Record<string, any>;
    if (d.name || d.source) {
      const lines: string[] = [
        `## Variant: ${d.name ?? args?.variant_id ?? "Unknown"}`,
      ];

      const fields: [string, unknown][] = [
        ["Name", d.name],
        ["Source", d.source],
        ["Ancestral allele", d.ancestral_allele],
        ["Minor allele", d.minor_allele],
        ["MAF", d.MAF],
        ["Ambiguity", d.ambiguity_code],
        [
          "Clinical significance",
          Array.isArray(d.clinical_significance)
            ? d.clinical_significance.join(", ")
            : d.clinical_significance,
        ],
        ["Most severe consequence", d.most_severe_consequence],
      ];

      for (const [label, value] of fields) {
        if (value !== undefined && value !== null && value !== "") {
          lines.push(`${label}: ${value}`);
        }
      }

      // Genomic mappings
      if (Array.isArray(d.mappings) && d.mappings.length > 0) {
        lines.push("\n### Genomic mappings");
        const mapRows = d.mappings.map((m: any) => ({
          location: `${m.seq_region_name ?? ""}:${m.start ?? ""}-${m.end ?? ""}`,
          allele_string: m.allele_string ?? "",
          strand: m.strand !== undefined ? (Number(m.strand) >= 0 ? "+" : "-") : "",
          assembly: m.assembly_name ?? "",
        }));
        lines.push(
          mdTable(mapRows, ["location", "allele_string", "strand", "assembly"])
        );
      }

      return lines.join("\n");
    }
  }

  // Array data (VEP, LD, phenotype, region variants)
  if (Array.isArray(data)) {
    const items = data as any[];
    if (items.length === 0) return "(no variant results)";

    // VEP output: has most_severe_consequence
    if (items[0]?.most_severe_consequence !== undefined) {
      const sections: string[] = [];
      for (const item of items) {
        sections.push(`## ${item.id ?? item.input ?? "Variant"}`);
        sections.push(
          `Most severe consequence: ${item.most_severe_consequence}`
        );

        if (
          Array.isArray(item.transcript_consequences) &&
          item.transcript_consequences.length > 0
        ) {
          const rows = item.transcript_consequences.map((tc: any) => ({
            gene: tc.gene_symbol ?? "",
            transcript: tc.transcript_id ?? "",
            consequence: Array.isArray(tc.consequence_terms)
              ? tc.consequence_terms.join(", ")
              : (tc.consequence_terms ?? ""),
            impact: tc.impact ?? "",
            biotype: tc.biotype ?? "",
            amino_acids: tc.amino_acids ?? "",
            codons: tc.codons ?? "",
          }));
          sections.push(
            mdTable(rows, [
              "gene",
              "transcript",
              "consequence",
              "impact",
              "biotype",
              "amino_acids",
              "codons",
            ])
          );
        }
      }
      return sections.join("\n\n");
    }

    // LD data: has variation1/r2
    if (items[0]?.variation1 !== undefined || items[0]?.r2 !== undefined) {
      return (
        `## LD Results (${items.length} pairs)\n\n` +
        mdTable(items, [
          "variation1",
          "variation2",
          "r2",
          "d_prime",
          "population_name",
        ])
      );
    }

    // Phenotype data: has description + source
    if (
      items[0]?.description !== undefined &&
      items[0]?.source !== undefined
    ) {
      const rows = items.map((p: any) => ({
        description: p.description ?? "",
        source: p.source ?? "",
        study: p.study ?? "",
        risk_allele: p.risk_allele ?? "",
        p_value: p.p_value ?? "",
      }));
      return (
        `## Phenotype Associations (${items.length} results)\n\n` +
        mdTable(rows, [
          "description",
          "source",
          "study",
          "risk_allele",
          "p_value",
        ])
      );
    }

    // Generic variation array (region-based variant_info)
    const rows = items.map((v: any) => ({
      id: v.id ?? v.name ?? "",
      type: v.feature_type ?? "",
      consequence: v.consequence_type ?? v.most_severe_consequence ?? "",
      location: v.seq_region_name
        ? `${v.seq_region_name}:${v.start ?? ""}-${v.end ?? ""}`
        : "",
      alleles: v.allele_string ?? "",
    }));
    return (
      `## Variants (${items.length} results)\n\n` + mdTable(rows)
    );
  }

  return JSON.stringify(data, null, 2);
}

function formatFeatureOverlap(data: unknown, args: any): string {
  if (!Array.isArray(data)) return JSON.stringify(data, null, 2);

  const items = data as any[];
  if (items.length === 0) return "(no overlapping features found)";

  const rows = items.map((f: any) => ({
    id: f.id ?? f.gene_id ?? "",
    type: f.feature_type ?? "",
    name: f.external_name ?? "",
    biotype: f.biotype ?? "",
    location: formatLocation(f),
  }));

  const region = args?.region ?? args?.feature_id ?? "";
  return (
    `## Overlapping Features for ${region} (${items.length} results)\n\n` +
    mdTable(rows, ["id", "type", "name", "biotype", "location"])
  );
}

function formatRegulatory(data: unknown, args: any): string {
  if (!Array.isArray(data)) return JSON.stringify(data, null, 2);

  const items = data as any[];
  if (items.length === 0) return "(no regulatory features found)";

  const rows = items.map((f: any) => ({
    id: f.id ?? "",
    type: f.feature_type ?? "",
    description: f.description ?? "",
    location: formatLocation(f),
    bound: f.bound_start ? `${f.bound_start}-${f.bound_end}` : "",
  }));

  return (
    `## Regulatory Features (${items.length} results)\n\n` +
    mdTable(rows, ["id", "type", "description", "location", "bound"])
  );
}

function formatProteinFeatures(data: unknown, args: any): string {
  if (!Array.isArray(data)) return JSON.stringify(data, null, 2);

  const items = data as any[];
  if (items.length === 0) return "(no protein features found)";

  const rows = items.map((f: any) => ({
    type: f.type ?? "",
    id: f.id ?? "",
    description: f.description ?? "",
    start: f.start ?? "",
    end: f.end ?? "",
    interpro: f.interpro ?? "",
  }));

  return (
    `## Protein Features for ${args?.protein_id ?? ""} (${items.length} results)\n\n` +
    mdTable(rows, ["type", "id", "description", "start", "end", "interpro"])
  );
}

function formatMeta(data: unknown, args: any): string {
  const infoType = args?.info_type;

  // Ping
  if (infoType === "ping" && data && typeof data === "object") {
    const d = data as Record<string, any>;
    return `Ensembl REST API status: ${d.ping === 1 ? "OK" : "DOWN"}`;
  }

  // Assembly
  if (
    infoType === "assembly" &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const d = data as Record<string, any>;
    const lines: string[] = [`## Assembly: ${d.assembly_name ?? ""}`];

    const fields: [string, unknown][] = [
      ["Assembly name", d.assembly_name],
      ["Assembly accession", d.assembly_accession],
      ["Assembly date", d.assembly_date],
      ["Genebuild method", d.genebuild_method],
      ["Genebuild start date", d.genebuild_start_date],
      ["Coordinate system", d.default_coord_system_version],
      [
        "Karyotype",
        Array.isArray(d.karyotype) ? d.karyotype.join(", ") : d.karyotype,
      ],
      [
        "Top-level regions",
        Array.isArray(d.top_level_region) ? d.top_level_region.length : "",
      ],
    ];

    for (const [label, value] of fields) {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`${label}: ${value}`);
      }
    }

    return lines.join("\n");
  }

  // rest / software / data: simple key-value
  if (
    (infoType === "rest" || infoType === "software" || infoType === "data") &&
    data &&
    typeof data === "object"
  ) {
    return kvBlock(data as Record<string, unknown>);
  }

  // Species list (wrapped in {species: [...]})
  if (
    infoType === "species" &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const d = data as Record<string, any>;
    const speciesList = d.species ?? d;
    if (Array.isArray(speciesList)) {
      const rows = speciesList.map((s: any) => ({
        name: s.name ?? "",
        common_name: s.common_name ?? "",
        assembly: s.assembly ?? "",
        taxonomy_id: s.taxon_id ?? s.taxonomy_id ?? "",
      }));
      return (
        `## Species (${rows.length} results)\n\n` +
        mdTable(rows, ["name", "common_name", "assembly", "taxonomy_id"])
      );
    }
  }

  // Biotypes: array of objects
  if (infoType === "biotypes" && Array.isArray(data)) {
    const rows = (data as any[]).map((b) => ({
      biotype: b.biotype ?? "",
      object_type: b.object_type ?? "",
      biotype_group: b.biotype_group ?? "",
    }));
    return (
      `## Biotypes (${rows.length} results)\n\n` +
      mdTable(rows, ["biotype", "object_type", "biotype_group"])
    );
  }

  // Divisions: array of strings
  if (infoType === "divisions" && Array.isArray(data)) {
    return (
      `## Ensembl Divisions\n\n` +
      (data as string[]).map((d) => `- ${d}`).join("\n")
    );
  }

  // Archive ID
  if (args?.archive_id && data && typeof data === "object") {
    const d = data as Record<string, any>;
    const lines: string[] = [`## Archive: ${d.id ?? args.archive_id}`];
    const fields: [string, unknown][] = [
      ["ID", d.id],
      ["Release", d.release],
      ["Assembly", d.assembly],
      ["Version", d.version],
      ["Latest", d.latest],
      ["Is current", d.is_current],
    ];
    for (const [label, value] of fields) {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`${label}: ${value}`);
      }
    }
    return lines.join("\n");
  }

  // Generic array (analysis, external_dbs, variation info, etc.)
  if (Array.isArray(data)) {
    if (data.length === 0) return "(no results)";
    if (typeof data[0] === "object") {
      return mdTable(data as Record<string, unknown>[]);
    }
    return data.map((d) => `- ${d}`).join("\n");
  }

  // Generic object
  if (data && typeof data === "object") {
    return kvBlock(data as Record<string, unknown>);
  }

  return JSON.stringify(data, null, 2);
}

function formatMapping(data: unknown, _args: any): string {
  if (!data || typeof data !== "object") return JSON.stringify(data, null, 2);

  const d = data as Record<string, any>;
  const mappings = d.mappings;

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return "(no coordinate mappings found)";
  }

  const rows = mappings.map((m: any) => {
    const original = m.original ?? {};
    const mapped = m.mapped ?? {};
    return {
      source: `${original.seq_region_name ?? original.coord_system ?? ""}:${original.start ?? ""}-${original.end ?? ""}`,
      mapped_to: `${mapped.seq_region_name ?? mapped.coord_system ?? ""}:${mapped.start ?? ""}-${mapped.end ?? ""}`,
      strand:
        mapped.strand !== undefined
          ? Number(mapped.strand) >= 0
            ? "+"
            : "-"
          : "",
      assembly: mapped.assembly ?? "",
    };
  });

  return (
    `## Coordinate Mapping (${mappings.length} results)\n\n` +
    mdTable(rows, ["source", "mapped_to", "strand", "assembly"])
  );
}

function formatCompara(data: unknown, _args: any): string {
  // Array (gene tree leaves or alignments)
  if (Array.isArray(data)) {
    const items = data as any[];
    if (items.length === 0) return "(no results)";

    // Gene tree leaves: have species + gene_symbol
    if (items[0]?.species !== undefined && items[0]?.gene_symbol !== undefined) {
      const rows = items.map((l: any) => ({
        species: l.species ?? "",
        gene_symbol: l.gene_symbol ?? "",
        gene_id: l.gene_id ?? l.id ?? "",
        protein_id: l.protein_id ?? "",
      }));
      return (
        `## Gene Tree (${items.length} leaves)\n\n` +
        mdTable(rows, ["species", "gene_symbol", "gene_id", "protein_id"])
      );
    }

    // Homology items (when flattened by processResponse)
    if (items[0]?.type !== undefined && items[0]?.target !== undefined) {
      const rows = items.map((h: any) => {
        const target = h.target ?? {};
        return {
          type: h.type ?? "",
          target_species: target.species ?? "",
          target_id: target.id ?? "",
          target_protein: target.protein_id ?? "",
          perc_id: target.perc_id ?? h.perc_id ?? "",
          perc_pos: target.perc_pos ?? h.perc_pos ?? "",
        };
      });
      return (
        `## Homologs (${items.length} results)\n\n` +
        mdTable(rows, [
          "type",
          "target_species",
          "target_id",
          "target_protein",
          "perc_id",
          "perc_pos",
        ])
      );
    }

    // Generic array
    return mdTable(items);
  }

  // Homology response: {data: [{homologies: [...]}]}
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, any>;

    if (d.data && Array.isArray(d.data)) {
      const homologies = d.data.flatMap((item: any) =>
        Array.isArray(item.homologies) ? item.homologies : []
      );

      if (homologies.length === 0) return "(no homologs found)";

      const rows = homologies.map((h: any) => {
        const target = h.target ?? {};
        return {
          type: h.type ?? "",
          target_species: target.species ?? "",
          target_id: target.id ?? "",
          target_protein: target.protein_id ?? "",
          perc_id: target.perc_id ?? h.perc_id ?? "",
          perc_pos: target.perc_pos ?? h.perc_pos ?? "",
        };
      });

      return (
        `## Homologs (${homologies.length} results)\n\n` +
        mdTable(rows, [
          "type",
          "target_species",
          "target_id",
          "target_protein",
          "perc_id",
          "perc_pos",
        ])
      );
    }
  }

  return JSON.stringify(data, null, 2);
}

function formatOntoTax(data: unknown, _args: any): string {
  // Single object
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, any>;

    // Taxonomy node
    if (d.scientific_name !== undefined) {
      const lines: string[] = [`## ${d.scientific_name ?? d.name ?? ""}`];
      const fields: [string, unknown][] = [
        ["ID", d.id],
        ["Scientific name", d.scientific_name],
        ["Name", d.name],
        ["Rank", d.rank],
        ["Leaf", d.leaf],
      ];
      for (const [label, value] of fields) {
        if (value !== undefined && value !== null && value !== "") {
          lines.push(`${label}: ${value}`);
        }
      }
      if (Array.isArray(d.children) && d.children.length > 0) {
        lines.push(`\n### Children (${d.children.length})`);
        const rows = d.children.map((c: any) => ({
          id: c.id ?? "",
          scientific_name: c.scientific_name ?? c.name ?? "",
          rank: c.rank ?? "",
        }));
        lines.push(mdTable(rows, ["id", "scientific_name", "rank"]));
      }
      return lines.join("\n");
    }

    // Ontology term
    const lines: string[] = [`## ${d.name ?? d.accession ?? ""}`];
    const fields: [string, unknown][] = [
      ["Accession", d.accession],
      ["Name", d.name],
      ["Namespace", d.namespace],
      ["Definition", d.definition],
      ["Ontology", d.ontology],
      ["Subset", Array.isArray(d.subsets) ? d.subsets.join(", ") : d.subsets],
    ];
    for (const [label, value] of fields) {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`${label}: ${value}`);
      }
    }
    if (Array.isArray(d.synonyms) && d.synonyms.length > 0) {
      lines.push(`Synonyms: ${d.synonyms.join(", ")}`);
    }

    return lines.join("\n");
  }

  // Array of results (search)
  if (Array.isArray(data)) {
    const items = data as any[];
    if (items.length === 0) return "(no results)";

    const rows = items.map((t: any) => ({
      accession: t.accession ?? t.id ?? "",
      name: t.name ?? t.scientific_name ?? "",
      namespace: t.namespace ?? t.ontology ?? "",
      definition: t.definition
        ? t.definition.length > 80
          ? t.definition.slice(0, 80) + "..."
          : t.definition
        : "",
    }));

    return (
      `## Results (${items.length})\n\n` +
      mdTable(rows, ["accession", "name", "namespace", "definition"])
    );
  }

  return JSON.stringify(data, null, 2);
}

// ---------- Error formatter ----------

function formatError(data: ErrorResponse): string {
  const lines: string[] = [`Error: ${data.error}`];
  if (data.suggestion) lines.push(`Suggestion: ${data.suggestion}`);
  if (data.example) lines.push(`Example: ${data.example}`);
  return lines.join("\n");
}

// ---------- Dispatcher ----------

const TOOL_FORMATTERS: Record<string, (data: unknown, args: any) => string> = {
  ensembl_lookup: formatLookup,
  ensembl_sequence: formatSequence,
  ensembl_variation: formatVariation,
  ensembl_feature_overlap: formatFeatureOverlap,
  ensembl_regulatory: formatRegulatory,
  ensembl_protein_features: formatProteinFeatures,
  ensembl_meta: formatMeta,
  ensembl_mapping: formatMapping,
  ensembl_compara: formatCompara,
  ensembl_ontotax: formatOntoTax,
};

export function formatToolResponse(
  toolName: string,
  data: unknown,
  args?: any
): string {
  // Error responses: no source attribution
  if (isErrorResponse(data)) {
    return formatError(data);
  }

  // Unwrap ProcessedResponse
  let summary = "";
  let actual = data;
  if (isProcessedResponse(data)) {
    if (data.summary) {
      summary = data.summary + "\n\n";
    }
    actual = data.data;
  }

  const formatter = TOOL_FORMATTERS[toolName];
  const body = formatter
    ? formatter(actual, args)
    : JSON.stringify(actual, null, 2);

  return summary + body + SOURCE_LINE;
}
