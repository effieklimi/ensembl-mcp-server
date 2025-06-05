# Ensembl MCP Server

A **Model Context Protocol (MCP)** server that provides LLMs with access to the [Ensembl](https://ensembl.org) genomics database. This server enables AI assistants to query genomic data, gene information, sequences, variants, and more.

## Features

🧬 **Gene Information**: Get details about genes by ID or symbol  
🔍 **Gene Search**: Search genes across species  
🧬 **Sequence Retrieval**: Get DNA sequences for genomic regions  
🔬 **Variant Data**: Query genetic variants and their annotations  
📊 **Transcript Info**: Access transcript details and isoforms  
🌍 **Multi-Species**: Support for all Ensembl species  
🔗 **Cross-References**: Get external database links  
⚡ **Rate Limited**: Built-in rate limiting to respect API limits

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

## Available Tools

### 1. `get_gene_info`

Get detailed information about a gene by Ensembl ID or symbol.

**Parameters:**

- `gene_identifier` (string, required): Gene ID (e.g., "ENSG00000157764") or symbol (e.g., "BRAF")
- `species` (string, optional): Species name (default: "homo_sapiens")
- `include_transcripts` (boolean, optional): Include transcript information

**Example:**

```json
{
  "gene_identifier": "BRAF",
  "species": "homo_sapiens",
  "include_transcripts": true
}
```

### 2. `search_genes`

Search for genes by symbol.

**Parameters:**

- `gene_name` (string, required): Gene symbol (e.g., "TP53", "BRCA1")
- `species` (string, optional): Species name

### 3. `get_sequence`

Get DNA sequence for a genomic region.

**Parameters:**

- `region` (string, required): Region like "17:7565096-7590856"
- `species` (string, optional): Species name
- `format` (string, optional): "json" or "fasta"

### 4. `get_variants_in_region`

Get genetic variants in a genomic region.

**Parameters:**

- `region` (string, required): Genomic region
- `species` (string, optional): Species name
- `consequence_type` (string, optional): Filter by consequence

### 5. `get_variant_info`

Get information about a specific variant.

**Parameters:**

- `variant_id` (string, required): Variant ID like "rs699"

### 6. `get_transcript_info`

Get transcript details.

**Parameters:**

- `transcript_id` (string, required): Transcript ID like "ENST00000288602"

### 7. `list_species`

Get all available species in Ensembl.

### 8. `get_species_info`

Get detailed information about a species.

**Parameters:**

- `species` (string, required): Species name or common name

### 9. `get_assembly_info`

Get genome assembly information.

**Parameters:**

- `species` (string, optional): Species name

### 10. `get_gene_xrefs`

Get external database references for a gene.

**Parameters:**

- `gene_id` (string, required): Ensembl gene ID

## Usage Examples

### LLM Query Examples

Once connected to an MCP-enabled LLM client, you can ask questions like:

- _"What is the BRAF gene and where is it located?"_
- _"Show me variants in the TP53 gene region"_
- _"Get the DNA sequence for chromosome 17 from position 7565096 to 7590856"_
- _"What transcripts are available for the EGFR gene?"_
- _"List all available species in Ensembl"_

### Direct API Usage

For testing or direct integration:

```typescript
import { EnsemblApiClient } from "./src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

// Get gene info
const gene = await client.getGeneById("ENSG00000157764", "homo_sapiens");
console.log(gene);

// Search genes
const results = await client.searchGenes({
  gene_name: "BRAF",
  species: "homo_sapiens",
});
console.log(results);
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
