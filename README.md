# 🧬 Ensembl API MCP Server

A full-featured Model Context Protocol (MCP) server that exposes Ensembl’s REST API.

## Why you’ll love it

🧬 **Gene information** – fetch details by ID or symbol
🔍 **Gene search** – scan genes across any species
🧬 **Sequence retrieval** – pull DNA for any genomic region
🔬 **Variant data** – explore variants and their annotations
📊 **Transcript info** – inspect transcripts and isoforms
🌍 **Multi-species** – every species in Ensembl, right here
🔗 **Cross-references** – hop to external databases in one call
⚡ **Rate-limited** – built-in throttling keeps you within Ensembl limits

- **Comprehensive coverage** – 10 tools map to functional areas instead of 100 + individual endpoints, yet still expose nearly the whole API.
- **Production-ready** – TypeScript throughout, robust error handling, and a tidy API-client layer.
- **Biologist-friendly** – grouped by biological task (genes, variants, compara…), not by low-level REST paths.

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

Everything else in the earlier rewrite (installation, usage examples, architecture, etc.) remains unchanged—only the endpoint blocks have been reinstated verbatim. Let me know if you’d like any other tweaks!
