# 🧬 Ensembl API MCP Server

[![smithery badge](https://smithery.ai/badge/@effieklimi/ensembl-mcp-server)](https://smithery.ai/server/@effieklimi/ensembl-mcp-server)

A full-featured Model Context Protocol (MCP) server that exposes Ensembl’s REST API. Built using the [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

- **Comprehensive coverage** – 10 tools map to functional areas instead of 100 + individual endpoints, yet still expose nearly the whole API.
- **Production-ready** – TypeScript throughout, robust error handling, and a tidy API-client layer.
- **Biologist-friendly** – grouped by biological task (genes, variants, compara…), not by low-level REST paths.

## Listed on:

- [_Smithery_](https://smithery.ai/server/@effieklimi/ensembl-mcp-server)
- [_Glama_](https://glama.ai/mcp/servers/@effieklimi/ensembl-mcp-server)

---

## Use cases:

- 🧬 **Gene information** – fetch details by ID or symbol
- 🔍 **Gene search** – scan genes across any species
- 🧬 **Sequence retrieval** – pull DNA for any genomic region
- 🔬 **Variant data** – explore variants and their annotations
- 📊 **Transcript info** – inspect transcripts and isoforms
- 🌍 **Multi-species** – every species in Ensembl, right here
- 🔗 **Cross-references** – hop to external databases in one call
- ⚡ **Rate-limited** – built-in throttling keeps you within Ensembl limits

---

## Installation

Choose your preferred installation method:

### Option 1: Via Smithery

1. Visit [Smithery - Ensembl MCP Server](https://smithery.ai/server/@effieklimi/ensembl-mcp-server). The most common platform options include:

```bash
# claude code:
npx -y @smithery/cli@latest install @effieklimi/ensembl-mcp-server --client claude --key your-smithery-secret-key

# cursor:
npx -y @smithery/cli@latest install @effieklimi/ensembl-mcp-server --client cursor --key your-smithery-secret-key

# vscode:
npx -y @smithery/cli@latest install @effieklimi/ensembl-mcp-server --client vscode --key your-smithery-secret-key

# windsurf:
npx -y @smithery/cli@latest install @effieklimi/ensembl-mcp-server --client windsurf --key your-smithery-secret-key
```

Check the MCP's smithery link for additional platform options.

### Option 2: Local Development Setup

For development or custom setups:

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/effieklimi/ensembl-mcp-server.git
   cd ensembl-mcp-server
   npm install
   ```

2. **Configure Claude Desktop manually:**

   Edit your config file:

   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

   Add this server configuration:

   ```json
   {
     "mcpServers": {
       "ensembl": {
         "command": "npm",
         "args": ["run", "start"],
         "cwd": "/absolute/path/to/ensembl-mcp-server"
       }
     }
   }
   ```

3. **Restart Claude Desktop** - The Ensembl tools will appear in your available tools

### Development Setup

```bash
# Development with hot reload
npm run dev

# Run tests
npm test

# Production build (optional)
npm run build
npm run start:prod
```

## Contributing

We'd love your help! Here's how to get started:

### Quick Contact

- Email the dev: [effie@effie.bio](mailto:effie@effie.bio)

### Development Workflow

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ensembl-mcp-server.git
   cd ensembl-mcp-server
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run tests to make sure everything works:**
   ```bash
   npm test
   ```
5. **Start development server:**
   ```bash
   npm run dev
   ```
6. **Make your changes and test thoroughly**
7. **Submit a pull request**

### Available Scripts

- `npm run dev` - Development with hot reload
- `npm run start` - Run the server
- `npm test` - Run all tests
- `npm run build` - Compile TypeScript (optional)
- `npm run start:prod` - Run compiled version

---

## The ten tools (with endpoints)

### 1 · `ensembl_feature_overlap`

Find genes, transcripts, or regulatory elements that overlap a region or another feature.

```text
GET /overlap/region/:species/:region
GET /overlap/id/:id
```

Typical asks: “Which genes sit in chr17:43-44 Mb?” – “What overlaps BRCA1?”

---

### 2 · `ensembl_regulatory`

Regulatory features, binding matrices and related annotations.

```text
GET /overlap/region/:species/:region             (with regulatory filters)
GET /overlap/translation/:id                     (regulatory features on proteins)
GET /species/:species/binding_matrix/:binding_matrix_stable_id
```

Use cases: TF-binding sites, regulatory annotation.

---

### 3 · `ensembl_protein_features`

Protein-level domains and functional sites.

```text
GET /overlap/translation/:id
```

Use cases: protein domains, signal peptides, catalytic residues.

---

### 4 · `ensembl_meta`

Server metadata, species lists, release info, and diagnostics.

```text
GET /info/ping
GET /info/rest
GET /info/software
GET /info/data
GET /info/species
GET /info/divisions
GET /info/assembly/:species
GET /info/biotypes/:species
GET /info/analysis/:species
GET /info/external_dbs/:species
GET /info/variation/:species
GET /archive/id/:id
POST /archive/id
```

Typical asks: “Which assemblies do you have for human?” – server health checks.

---

### 5 · `ensembl_lookup`

Translate IDs ↔ symbols, pull xrefs, recode variants.

```text
GET  /lookup/id/:id
GET  /lookup/symbol/:species/:symbol
POST /lookup/id
POST /lookup/symbol
GET  /xrefs/id/:id
GET  /xrefs/symbol/:species/:symbol
GET  /xrefs/name/:species/:name
GET  /variant_recoder/:species/:id
POST /variant_recoder/:species
```

Use cases: “What is BRCA1’s Ensembl ID?” – cross-reference UniProt.

---

### 6 · `ensembl_sequence`

Retrieve DNA, RNA or protein sequences.

```text
GET  /sequence/id/:id
GET  /sequence/region/:species/:region
POST /sequence/id
POST /sequence/region
```

Use cases: gene FASTA, transcript cDNA, genomic regions.

---

### 7 · `ensembl_mapping`

Coordinate conversion (genome ↔ cDNA/CDS/protein) and assembly lift-over.

```text
GET /map/cdna/:id/:region
GET /map/cds/:id/:region
GET /map/translation/:id/:region
GET /map/:species/:asm_one/:region/:asm_two
```

Use cases: map CDS to GRCh38, convert protein to genome coords.

---

### 8 · `ensembl_compara`

Comparative genomics—homology, gene trees, alignments.

```text
GET /homology/id/:species/:id
GET /homology/symbol/:species/:symbol
GET /genetree/id/:id
GET /genetree/member/symbol/:species/:symbol
GET /genetree/member/id/:species/:id
GET /cafe/genetree/id/:id
GET /cafe/genetree/member/symbol/:species/:symbol
GET /cafe/genetree/member/id/:species/:id
GET /alignment/region/:species/:region
```

Use cases: find orthologs, build phylogenies, pull species alignments.

---

### 9 · `ensembl_variation`

Variant lookup, VEP consequences, LD, phenotype mapping.

```text
GET  /variation/:species/:id
GET  /variation/:species/pmcid/:pmcid
GET  /variation/:species/pmid/:pmid
POST /variation/:species
GET  /vep/:species/hgvs/:hgvs_notation
POST /vep/:species/hgvs
GET  /vep/:species/id/:id
POST /vep/:species/id
GET  /vep/:species/region/:region/:allele
POST /vep/:species/region
GET  /ld/:species/:id/:population_name
GET  /phenotype/variant/:species/:id
GET  /phenotype/region/:species/:region
GET  /transcript_haplotypes/:species/:id
```

Use cases: VEP predictions, LD blocks, phenotype associations.

---

### 10 · `ensembl_ontotax`

Ontology term search and NCBI taxonomy traversal.

```text
GET /ontology/id/:id
GET /ontology/name/:name
GET /taxonomy/id/:id
GET /taxonomy/name/:name
```

Use cases: GO term look-up, phenotype ontology, taxonomic classification.

---

### Installing via Smithery

To install ensembl-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@effieklimi/ensembl-mcp-server):

```bash
npx -y @smithery/cli install @effieklimi/ensembl-mcp-server --client claude
```
