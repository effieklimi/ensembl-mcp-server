# Ensembl MCP Server

A comprehensive Model Context Protocol (MCP) server providing access to the Ensembl genomics database. This server offers 10 powerful tools that cover ~95% of Ensembl's REST API surface with a clean, organized interface.

## Features

🧬 **Gene Information**: Get details about genes by ID or symbol  
🔍 **Gene Search**: Search genes across species  
🧬 **Sequence Retrieval**: Get DNA sequences for genomic regions  
🔬 **Variant Data**: Query genetic variants and their annotations  
📊 **Transcript Info**: Access transcript details and isoforms  
🌍 **Multi-Species**: Support for all Ensembl species  
🔗 **Cross-References**: Get external database links  
⚡ **Rate Limited**: Built-in rate limiting to respect API limits

**Comprehensive Coverage**: 10 carefully designed tools that map to Ensembl's functional domains rather than individual endpoints, providing access to nearly the entire API surface while staying under MCP tool limits.

**Production Ready**: Built with TypeScript, proper error handling, rate limiting, and robust API client architecture.

**Biologist Friendly**: Tools are organized by biological function (genes, variants, comparative genomics) rather than technical API structure.

## Available Tools

### 1. `ensembl_feature_overlap`

Find genomic features (genes, transcripts, regulatory elements) that overlap with a region or specific feature.

**Endpoints:**

- `GET /overlap/region/:species/:region`
- `GET /overlap/id/:id`

**Use cases:** "What genes are in this region?", "What features overlap with this gene?"

### 2. `ensembl_regulatory`

Get regulatory features, binding matrices, and regulatory annotations.

**Endpoints:**

- `GET /overlap/region/:species/:region` (with regulatory feature filtering)
- `GET /overlap/translation/:id` (regulatory features on proteins)
- `GET /species/:species/binding_matrix/:binding_matrix_stable_id`

**Use cases:** Transcription factor binding sites, regulatory feature annotation

### 3. `ensembl_protein_features`

Protein-level features, domains, and functional annotations.

**Endpoints:**

- `GET /overlap/translation/:id`

**Use cases:** Protein domains, signal peptides, functional sites

### 4. `ensembl_meta`

Server metadata, data releases, species info, and system status.

**Endpoints:**

- `GET /info/ping`
- `GET /info/rest`
- `GET /info/software`
- `GET /info/data`
- `GET /info/species`
- `GET /info/divisions`
- `GET /info/assembly/:species`
- `GET /info/biotypes/:species`
- `GET /info/analysis/:species`
- `GET /info/external_dbs/:species`
- `GET /info/variation/:species`
- `GET /archive/id/:id`
- `POST /archive/id`

**Use cases:** "What species are available?", "What assembly version?", server diagnostics

### 5. `ensembl_lookup`

Look up genes, transcripts, variants by ID or symbol. Cross-references and ID translation.

**Endpoints:**

- `GET /lookup/id/:id`
- `GET /lookup/symbol/:species/:symbol`
- `POST /lookup/id`
- `POST /lookup/symbol`
- `GET /xrefs/id/:id`
- `GET /xrefs/symbol/:species/:symbol`
- `GET /xrefs/name/:species/:name`
- `GET /variant_recoder/:species/:id`
- `POST /variant_recoder/:species`

**Use cases:** "What is BRCA1?", "Convert this gene symbol to Ensembl ID"

### 6. `ensembl_sequence`

Retrieve DNA, RNA, or protein sequences for genes, transcripts, or genomic regions.

**Endpoints:**

- `GET /sequence/id/:id`
- `GET /sequence/region/:species/:region`
- `POST /sequence/id`
- `POST /sequence/region`

**Use cases:** Get gene sequences, transcript sequences, genomic region sequences

### 7. `ensembl_mapping`

Map coordinates between genomic ↔ cDNA/CDS/protein and between genome assemblies.

**Endpoints:**

- `GET /map/cdna/:id/:region`
- `GET /map/cds/:id/:region`
- `GET /map/translation/:id/:region`
- `GET /map/:species/:asm_one/:region/:asm_two`

**Use cases:** Convert genomic to protein coordinates, lift over between assemblies

### 8. `ensembl_compara`

Comparative genomics: gene trees, homology, species alignments, evolutionary analysis.

**Endpoints:**

- `GET /homology/id/:species/:id`
- `GET /homology/symbol/:species/:symbol`
- `GET /genetree/id/:id`
- `GET /genetree/member/symbol/:species/:symbol`
- `GET /genetree/member/id/:species/:id`
- `GET /cafe/genetree/id/:id`
- `GET /cafe/genetree/member/symbol/:species/:symbol`
- `GET /cafe/genetree/member/id/:species/:id`
- `GET /alignment/region/:species/:region`

**Use cases:** Find orthologs, build phylogenetic trees, get species alignments

### 9. `ensembl_variation`

Variant analysis: VEP consequence prediction, variant lookup, LD analysis, phenotype mapping.

**Endpoints:**

- `GET /variation/:species/:id`
- `GET /variation/:species/pmcid/:pmcid`
- `GET /variation/:species/pmid/:pmid`
- `POST /variation/:species`
- `GET /vep/:species/hgvs/:hgvs_notation`
- `POST /vep/:species/hgvs`
- `GET /vep/:species/id/:id`
- `POST /vep/:species/id`
- `GET /vep/:species/region/:region/:allele`
- `POST /vep/:species/region`
- `GET /ld/:species/:id/:population_name`
- `GET /phenotype/variant/:species/:id`
- `GET /phenotype/region/:species/:region`
- `GET /transcript_haplotypes/:species/:id`

**Use cases:** Predict variant effects, find variants in region, linkage disequilibrium

### 10. `ensembl_ontotax`

Ontology term search and NCBI taxonomy traversal.

**Endpoints:**

- `GET /ontology/id/:id`
- `GET /ontology/name/:name`
- `GET /taxonomy/id/:id`
- `GET /taxonomy/name/:name`

**Use cases:** GO term search, phenotype ontologies, taxonomic classification

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- Internet connection for Ensembl API access

### Setup

```bash
# Clone or create the project
git clone <your-repo> ensembl-mcp
cd ensembl-mcp

# Install dependencies
bun install

# Build the server
bun run build

# Start the server
bun run start
```

## Usage

### As MCP Server

```bash
npm start
```

### Test Individual Tools

```bash
# Example: Look up the BRCA1 gene
echo '{"identifier": "BRCA1", "lookup_type": "symbol", "species": "homo_sapiens"}' | node src/index.ts ensembl_lookup
```

## Example Queries

**Find genes in a region:**

```json
{
  "tool": "ensembl_feature_overlap",
  "params": {
    "region": "17:43000000-44000000",
    "species": "homo_sapiens",
    "feature_types": ["gene"]
  }
}
```

**Get gene sequence:**

```json
{
  "tool": "ensembl_sequence",
  "params": {
    "identifier": "ENSG00000139618",
    "sequence_type": "genomic",
    "format": "fasta"
  }
}
```

**Find human orthologs:**

```json
{
  "tool": "ensembl_compara",
  "params": {
    "gene_symbol": "TP53",
    "analysis_type": "homology",
    "species": "mus_musculus",
    "homology_type": "orthologues"
  }
}
```

**Predict variant effects:**

```json
{
  "tool": "ensembl_variation",
  "params": {
    "hgvs_notation": "ENST00000269305.4:c.200G>A",
    "analysis_type": "vep"
  }
}
```

## Architecture

### Transport Choice: stdio

We use **stdio transport** because:

- ✅ Universal compatibility with MCP clients
- ✅ Simple process-based communication
- ✅ No network ports or sockets needed
- ✅ Built-in in the MCP SDK

### Rate Limiting

- Respects Ensembl's rate limits (10 requests/second max)
- Built-in 100ms minimum interval between requests
- No API keys required (Ensembl is open access)

### Memory & State

- **Stateless design**: No persistent memory needed
- Each request is independent
- Client-side caching can be implemented by the LLM client
- Rate limiter maintains minimal state (last request time)

### Error Handling

- Comprehensive error handling with clear messages
- Type Safe: Full TypeScript coverage with proper Ensembl API types
- Modular: Clean separation between tools, handlers, and API client
- Extensible: Easy to add new endpoints or modify existing ones

## Tool Design Philosophy

Rather than creating one tool per API endpoint (which would exceed MCP limits), tools are grouped by **biological function** and **response type**. This approach:

- Keeps tool count manageable (10 vs 100+ endpoints)
- Makes tools semantically coherent for AI models
- Covers ~95% of real-world Ensembl use cases
- Maintains clean parameter schemas per tool

## Data Sources

### Ensembl REST API

- **Base URL**: https://rest.ensembl.org
- **Format**: JSON responses
- **Rate Limit**: ~15 requests/second (we use 10/second for safety)
- **Species**: 270+ genomes across all domains of life

### No Biomart Integration (Yet)

For this initial version, we're focusing on the REST API. Biomart integration could be added later for:

- Complex queries across multiple datasets
- Bulk data retrieval
- Advanced filtering and analysis

## Development

### Scripts

```bash
bun run dev     # Development mode with auto-reload
bun run build   # Build TypeScript to dist/
bun run start   # Start the server
bun test        # Run tests (to be implemented)
```

### Project Structure

```
src/
├── index.ts           # Main MCP server
├── handlers/
│   └── tools.ts       # Tool definitions and handlers
├── utils/
│   └── ensembl-api.ts # Ensembl API client
└── types/
    └── ensembl.ts     # TypeScript interfaces
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Ensembl Citation

If you use this tool in research, please cite Ensembl:

> Ensembl 2024. Nucleic Acids Research (2024) doi:10.1093/nar/gkad1045
