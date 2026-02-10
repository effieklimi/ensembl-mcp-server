# Ensembl MCP Server - Improvement Plans

> Plans 1-6 (caching, batch operations, response truncation, error handling, structured logging, retry logic) have been implemented. The plans below cover the next round of improvements.

---

## Plan 7: Proper Test Framework (Vitest)

### Problem
Tests use a custom runner with no coverage reports, no watch mode, and no mocking support. All tests are integration tests that hit the live Ensembl API, making CI unreliable and slow. There's no way to know what percentage of code paths are covered.

### Approach
Migrate to Vitest (fast, ESM-native, TypeScript out of the box). Add unit tests with mocked API responses alongside existing integration tests.

### Files to Create/Modify

**New file: `vitest.config.ts`**
- Enable coverage via `@vitest/coverage-v8`
- Configure two test pools: `unit` (mocked, fast) and `integration` (live API, slow)
- Set timeout for integration tests to 30s

**Modify: `package.json`**
- Add `vitest`, `@vitest/coverage-v8` as dev dependencies
- Update scripts:
  - `"test"`: `"vitest run"` (unit tests only)
  - `"test:integration"`: `"vitest run --project integration"`
  - `"test:coverage"`: `"vitest run --coverage"`
  - `"test:watch"`: `"vitest"`

**Migrate existing tests:**
- Convert `tests/test-*.ts` files to use `describe`/`it`/`expect` from Vitest
- Keep them as integration tests under `tests/integration/`
- Create new `tests/unit/` directory for mocked tests

**New unit tests to add:**
- `tests/unit/cache.test.ts` -- LRU eviction, TTL, key generation (no network)
- `tests/unit/error-handler.test.ts` -- error enrichment for each status code
- `tests/unit/input-normalizer.test.ts` -- already partially exists, expand it
- `tests/unit/response-processor.test.ts` -- truncation, field selection
- `tests/unit/formatter.test.ts` -- markdown/FASTA output formatting
- `tests/unit/ensembl-api.test.ts` -- mock `fetch`, test retry logic, rate limiting, batch chunking

### Testing
- Verify all existing integration tests pass under Vitest
- Target 80%+ line coverage for `src/utils/` via unit tests

### Size Estimate
~50 lines config, ~200 lines migrating existing tests, ~400 lines new unit tests.

---

## Plan 8: MCP Resources and Prompts

### Problem
The server only exposes `tools`. MCP also supports `resources` (pre-loadable reference data) and `prompts` (reusable workflows). Clients can't pre-load species lists or assembly info, and there are no guided workflows for common genomics tasks.

### Approach
Add MCP resources for commonly referenced data and prompts for multi-step analysis workflows.

### Resources to Add

| Resource URI | Description | Data Source |
|---|---|---|
| `ensembl://species` | Full species list with assemblies | `/info/species` (cached 24h) |
| `ensembl://assembly/{species}` | Assembly info for a species | `/info/assembly/{species}` |
| `ensembl://releases` | Current and recent release info | `/info/data` + `/info/rest` |
| `ensembl://biotypes` | Available biotype categories | `/info/biotypes` |

### Prompts to Add

| Prompt Name | Description | Steps |
|---|---|---|
| `analyze-variant` | Full variant analysis workflow | Look up variant -> VEP annotation -> phenotype associations -> population frequencies |
| `compare-orthologs` | Cross-species gene comparison | Look up gene -> find orthologs -> compare sequences -> show conservation |
| `region-survey` | Survey a genomic region | Feature overlap -> regulatory elements -> variants in region -> gene summary |
| `gene-report` | Comprehensive gene report | Lookup -> transcripts -> protein features -> expression -> homologs |

### Files to Modify

**Modify: `index.ts`**
- Register resource handlers via `server.setRequestHandler(ListResourcesRequestSchema, ...)`
- Register resource templates for parameterized URIs (e.g., `ensembl://assembly/{species}`)
- Register prompt handlers via `server.setRequestHandler(ListPromptsRequestSchema, ...)`

**New file: `src/handlers/resources.ts`**
- Resource listing and fetching logic
- Each resource fetches from the API client with aggressive caching

**New file: `src/handlers/prompts.ts`**
- Prompt definitions with argument schemas
- Each prompt returns a structured message sequence guiding the LLM through steps

### Size Estimate
~150 lines for resources, ~200 lines for prompts, ~30 lines in index.ts.

---

## Plan 9: Input Validation Before API Calls

### Problem
Invalid parameters (bad region format, malformed Ensembl IDs, unknown species) currently travel all the way to the Ensembl API before failing. This wastes a network round-trip and API quota, and the resulting error messages are less specific than what we could generate locally.

### Approach
Add a pre-flight validation layer that catches common mistakes before making HTTP requests.

### Validations to Add

| Input | Validation | Example Rejection |
|---|---|---|
| Ensembl stable ID | Match `/^ENS[A-Z]*[GTRPE]\d{11}(\.\d+)?$/` | `"ENSG123"` -> "Invalid Ensembl ID format. Expected 11 digits after prefix (e.g., ENSG00000141510)." |
| Region string | Match `/^\w+:\d+-\d+$/` after comma removal | `"chr17:7,565,096"` -> "Region must include start-end range (e.g., 17:7565096-7590856)." |
| Species name | Check against cached species list or known aliases | `"humanx"` -> "Unknown species. Did you mean 'homo_sapiens'?" |
| Variant ID | Match `/^rs\d+$/` or HGVS pattern | `"rs"` -> "Variant ID appears incomplete. Expected format: rs12345 or HGVS notation." |
| Sequence type | Must be one of `genomic`, `cds`, `cdna`, `protein` | `"mrna"` -> "Invalid sequence type. Use one of: genomic, cds, cdna, protein." |
| Region size | Warn if region > 5Mb | "Region spans 12Mb. Ensembl may reject or truncate large regions. Consider narrowing." |

### Files to Create/Modify

**New file: `src/utils/input-validator.ts`**
- `validateEnsemblId(id: string): ValidationResult`
- `validateRegion(region: string): ValidationResult`
- `validateSpecies(species: string, knownSpecies?: string[]): ValidationResult`
- `validateVariantId(id: string): ValidationResult`
- `validateSequenceType(type: string): ValidationResult`
- `validateAll(args: ToolArgs, toolName: string): ValidationResult[]`
- `ValidationResult`: `{ valid: boolean, message?: string, suggestion?: string }`

**Modify: `src/handlers/tools.ts`**
- Call `validateAll()` at the top of each handler, before calling the API client
- Return structured error immediately if validation fails

### Size Estimate
~200 lines for validator, ~30 lines of handler changes.

---

## Plan 10: GRCh37 Support via Dedicated Server

### Problem
All requests currently go to `rest.ensembl.org` which serves GRCh38 data. Ensembl maintains `grch37.rest.ensembl.org` for GRCh37/hg19 queries. The input normalizer recognizes GRCh37/hg19 assembly names but doesn't route to the correct server, so users get GRCh38 data regardless.

### Approach
Route requests to the correct Ensembl server based on the assembly specified in the tool arguments.

### Files to Modify

**Modify: `src/utils/ensembl-api.ts`**
- Change `baseUrl` from a fixed string to a method: `getBaseUrl(assembly?: string): string`
  - `GRCh38` / `hg38` / default -> `https://rest.ensembl.org`
  - `GRCh37` / `hg19` -> `https://grch37.rest.ensembl.org`
- Update `makeRequest()` and `makePostRequest()` to accept an optional `assembly` parameter
- Cache keys must include the server to avoid cross-contamination:
  ```
  key = `${server}:${releaseVersion}:${endpoint}?${sortedParams}`
  ```

**Modify: `src/utils/input-normalizer.ts`**
- Already normalizes assembly names -- add a `getServer()` export that maps assembly to base URL
- Ensure hg19/hg38 aliases are handled

**Modify: `src/handlers/tools.ts`**
- Pass `assembly` argument through to API client methods where available
- Tools that accept region inputs (`ensembl_feature_overlap`, `ensembl_sequence`, `ensembl_mapping`, `ensembl_variation`) should propagate the assembly

### Edge Cases
- Not all endpoints are available on grch37.rest.ensembl.org (e.g., some comparative genomics)
- If an endpoint 404s on GRCh37 server, fall back to GRCh38 with a warning
- VEP on GRCh37 uses different annotation sets

### Testing
- Test same gene lookup on both servers, verify different coordinates
- Test assembly lift-over between GRCh37 and GRCh38

### Size Estimate
~40 lines in ensembl-api.ts, ~20 lines in input-normalizer.ts, ~20 lines in tools.ts.

---

## Plan 11: Observability and Diagnostics Tool

### Problem
No runtime visibility into server health, cache effectiveness, or API performance. When users experience slowness or errors, there's no way to diagnose without reading raw logs.

### Approach
Add an `ensembl_diagnostics` tool that exposes internal metrics and a health check.

### New Tool: `ensembl_diagnostics`

**Parameters:**
- `check_type`: `"health"` | `"cache_stats"` | `"api_stats"` | `"full"`

**Returns:**

```json
{
  "health": {
    "ensembl_api": "reachable",
    "ping_ms": 145,
    "current_release": 114,
    "server_version": "15.0"
  },
  "cache": {
    "entries": 247,
    "max_entries": 1000,
    "hit_rate": "73.2%",
    "hits": 891,
    "misses": 326,
    "evictions": 12,
    "memory_estimate_kb": 1240
  },
  "api": {
    "total_requests": 1217,
    "errors": 14,
    "retries": 8,
    "avg_response_ms": 312,
    "rate_limit_waits": 45
  }
}
```

### Files to Modify

**Modify: `src/utils/cache.ts`**
- Add `getStats(): CacheStats` method tracking hits, misses, evictions

**Modify: `src/utils/ensembl-api.ts`**
- Add request counters: `totalRequests`, `errors`, `retries`, `responseTimes[]`
- Add `getStats(): ApiStats` method
- Add `healthCheck(): Promise<HealthStatus>` -- calls `/info/ping` and `/info/data`

**Modify: `src/handlers/tools.ts`**
- Add `ensembl_diagnostics` tool definition and handler

### Size Estimate
~50 lines for stats tracking, ~40 lines for the tool definition/handler.

---

## Plan 12: CI/CD Pipeline

### Problem
No automated checks on PRs. Type errors, test failures, and regressions can ship undetected.

### Approach
Add a GitHub Actions workflow for CI.

### New File: `.github/workflows/ci.yml`

**Jobs:**
1. **typecheck** -- `tsc --noEmit` (fast, catches type errors)
2. **unit-tests** -- `vitest run` with coverage report (depends on Plan 7)
3. **integration-tests** -- `vitest run --project integration` (optional, on schedule or manual trigger only -- avoids hitting Ensembl API on every PR)
4. **docker-build** -- verify Docker image builds successfully

**Triggers:**
- Push to `main`
- Pull requests to `main`
- Weekly schedule for integration tests

**Coverage:**
- Upload coverage report as artifact
- Optionally add coverage badge to README

### Size Estimate
~60 lines for workflow file.

---

## Plan 13: Pagination for Large Result Sets

### Problem
Feature overlap queries on gene-dense regions can return thousands of results. Currently these are truncated, losing data silently. Users have no way to page through full results.

### Approach
Add optional pagination parameters to tools that return arrays.

### Parameters to Add

On `ensembl_feature_overlap`, `ensembl_variation`, `ensembl_meta` (species):
- `page`: integer, default 1
- `page_size`: integer, default 50, max 200

### Implementation

**Modify: `src/utils/response-processor.ts`**
- Add `paginate(data: any[], page: number, pageSize: number): PaginatedResponse`
- `PaginatedResponse`: `{ data, page, page_size, total_results, total_pages, has_next }`

**Modify: `src/handlers/tools.ts`**
- Add `page` and `page_size` to relevant tool schemas
- Apply pagination after response processing

### Response Format
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_results": 847,
    "total_pages": 17,
    "has_next": true
  }
}
```

### Size Estimate
~40 lines for pagination logic, ~20 lines of schema changes.

---

## Plan 14: Streaming for Large Responses

### Problem
Large FASTA sequences and 200-item batch results get truncated at a hard limit. MCP supports streaming content, which would let clients receive data incrementally instead of losing it.

### Approach
Use MCP's streaming capabilities for tools that can return large payloads.

### Candidates for Streaming
- `ensembl_sequence` -- FASTA output for long sequences or batch requests
- `ensembl_compara` -- large gene tree results
- Batch operations -- 200-item results

### Files to Modify

**Modify: `src/handlers/tools.ts`**
- For qualifying responses, use MCP's `StreamableHTTPServerTransport` or chunked text content
- Fall back to truncation for clients that don't support streaming

### Size Estimate
~80 lines. Depends on MCP SDK streaming support maturity.

---

## Priority Order

| Priority | Plan | Impact | Effort |
|---|---|---|---|
| 1 | Plan 7: Vitest migration | High (enables all other testing) | Medium |
| 2 | Plan 8: MCP Resources & Prompts | High (new capabilities) | Medium |
| 3 | Plan 9: Input validation | High (faster failures, less API load) | Low |
| 4 | Plan 12: CI/CD | High (quality gate) | Low |
| 5 | Plan 10: GRCh37 support | Medium (unlocks hg19 users) | Low |
| 6 | Plan 11: Diagnostics tool | Medium (operational visibility) | Low |
| 7 | Plan 13: Pagination | Medium (better data access) | Low |
| 8 | Plan 14: Streaming | Low (nice-to-have) | Medium |
