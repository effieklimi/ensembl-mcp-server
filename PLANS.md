# Ensembl MCP Server - Improvement Plans

---

## Plan 1: Caching Layer for Repeated Queries

### Problem
Every tool call hits the Ensembl REST API directly, even for data that hasn't changed. Ensembl data is versioned by release (e.g., release 114) and is immutable between releases. Repeated lookups for the same gene, species list, or assembly info waste time and API quota.

### Approach
Add an in-memory cache (Map-based with TTL) inside `EnsemblApiClient`. The cache key is derived from the full endpoint + query params. Cache entries are tagged with the Ensembl release version so they auto-invalidate when a new release goes live.

### Files to Create/Modify

**New file: `src/utils/cache.ts`**
- `ResponseCache` class with:
  - `private cache: Map<string, CacheEntry<T>>` storing `{ data, timestamp, releaseVersion }`
  - `get(key: string): T | null` -- returns data if not expired and release matches
  - `set(key: string, data: T, ttl?: number): void` -- stores with configurable TTL
  - `clear(): void` -- manual flush
  - `buildKey(endpoint: string, params?: Record<string, string>): string` -- deterministic key from endpoint + sorted params
- Default TTL tiers:
  - **Meta/species/assembly**: 24 hours (changes only on release)
  - **Gene/transcript lookups**: 6 hours (stable within release)
  - **Sequence data**: 6 hours (immutable for a given ID)
  - **Variation/VEP**: 1 hour (phenotype annotations update more often)
  - **Ontology/taxonomy**: 24 hours (very stable)

**Modify: `src/utils/ensembl-api.ts`**
- Import and instantiate `ResponseCache` in `EnsemblApiClient` constructor
- Add `private releaseVersion: string | null = null` field
- On first request, call `/info/data` to fetch the current release version and cache it
- In `makeRequest()`, before hitting the network:
  1. Build cache key from endpoint + params
  2. Check cache -- if hit, return cached data
  3. If miss, make the HTTP request, store result in cache, return it
- Add a `clearCache()` public method for manual invalidation

**Modify: `src/handlers/tools.ts`**
- No changes needed -- caching is transparent at the API client layer

### Cache Key Design
```
key = `${releaseVersion}:${endpoint}?${sortedParamString}`
// Example: "114:/lookup/id/ENSG00000141510?expand=Transcript"
```

### Edge Cases
- First call fetches release version (itself uncached) -- hardcode a short TTL for `/info/data`
- POST endpoints (future batch queries) need body-based keys -- plan for this in `buildKey()` by accepting an optional body hash
- Memory cap: add a `maxEntries` config (default 1000) with LRU eviction when exceeded

### Testing
- Unit test `ResponseCache`: get/set/expire/evict/clear
- Integration test: call same endpoint twice, verify second call doesn't hit the network (mock `fetch` or check timing)

### Size Estimate
~120 lines for `cache.ts`, ~30 lines of changes in `ensembl-api.ts`.

---

## Plan 2: Batch/POST Endpoint Support

### Problem
When an LLM needs to look up 20 gene IDs or annotate a list of variants, it must call the MCP tool 20 times sequentially. Each call incurs rate-limit delay (100ms minimum), network round-trip, and context window overhead. Ensembl supports POST-based batch endpoints that accept arrays of IDs in a single request.

### Approach
Add batch variants of the highest-traffic tools. Keep existing single-item tools unchanged (no breaking changes). Batch methods use POST with JSON bodies to the Ensembl batch endpoints.

### Ensembl Batch Endpoints to Support
| Use case | Endpoint | Method | Body |
|----------|----------|--------|------|
| Lookup multiple IDs | `POST /lookup/id` | POST | `{ "ids": ["ENSG...", "ENST..."] }` |
| Lookup multiple symbols | `POST /lookup/symbol/:species` | POST | `{ "symbols": ["BRCA1", "TP53"] }` |
| Sequences by ID | `POST /sequence/id` | POST | `{ "ids": ["ENSG...", "ENST..."] }` |
| Sequences by region | `POST /sequence/region/:species` | POST | `{ "regions": ["17:7565097-7590856"] }` |
| VEP by ID | `POST /vep/:species/id` | POST | `{ "ids": ["rs699", "rs1042779"] }` |
| VEP by HGVS | `POST /vep/:species/hgvs` | POST | `{ "hgvs_notations": ["..."] }` |
| Variant info | `POST /variation/:species` | POST | `{ "ids": ["rs699", "rs1042779"] }` |

### Files to Modify

**Modify: `src/utils/ensembl-api.ts`**
- Add `private makePostRequest<T>(endpoint: string, body: object): Promise<T>` method:
  - Same rate limiting as `makeRequest`
  - Uses `method: "POST"` with `JSON.stringify(body)`
  - Same error handling pattern
- Add batch methods:
  - `batchLookupIds(ids: string[]): Promise<Record<string, any>>`
  - `batchLookupSymbols(species: string, symbols: string[]): Promise<Record<string, any>>`
  - `batchSequenceIds(ids: string[], type?: string): Promise<any[]>`
  - `batchSequenceRegions(species: string, regions: string[]): Promise<any[]>`
  - `batchVepIds(species: string, ids: string[]): Promise<any[]>`
  - `batchVepHgvs(species: string, notations: string[]): Promise<any[]>`
  - `batchVariationIds(species: string, ids: string[]): Promise<any[]>`
- Ensembl caps POST batches at 200 IDs. Add chunking: if input exceeds 200, split into chunks, make parallel POST calls (respecting rate limit), merge results.

**Modify: `src/handlers/tools.ts`**
- Add 3 new tool definitions to `ensemblTools`:
  - `ensembl_batch_lookup` -- accepts `{ identifiers: string[], lookup_type, species }`
  - `ensembl_batch_sequence` -- accepts `{ identifiers: string[], sequence_type, species, format }`
  - `ensembl_batch_variation` -- accepts `{ identifiers: string[], analysis_type, species }`
- Add handler functions: `handleBatchLookup()`, `handleBatchSequence()`, `handleBatchVariation()`
- Each handler normalizes all identifiers via `normalizeEnsemblInputs()` in a loop

**Modify: `index.ts`**
- Import and register the 3 new handlers in the `switch` statement

### Input/Output Contract
```typescript
// Input example
{
  identifiers: ["ENSG00000141510", "ENSG00000012048", "ENSG00000139618"],
  lookup_type: "id",
  species: "homo_sapiens"
}

// Output: object keyed by identifier
{
  "ENSG00000141510": { display_name: "TP53", biotype: "protein_coding", ... },
  "ENSG00000012048": { display_name: "BRCA1", ... },
  "ENSG00000139618": { display_name: "BRCA2", ... }
}
```

### Testing
- Add `tests/test-batch.ts` with:
  - Batch lookup of 5 gene IDs
  - Batch lookup of 5 gene symbols
  - Batch sequence retrieval (3 transcripts)
  - Batch VEP (3 variant IDs)
  - Edge case: single ID (should still work)
  - Edge case: >200 IDs (verify chunking)

### Size Estimate
~100 lines for `makePostRequest` + batch methods, ~80 lines for 3 new tool definitions, ~60 lines for handlers, ~100 lines for tests.

---

## Plan 3: Response Summarization and Truncation

### Problem
Some Ensembl responses are massive -- gene trees can be 500KB+, species lists return 300+ entries, large region overlaps return thousands of features. Returning raw JSON to an LLM wastes context window and can exceed MCP message size limits. The LLM often only needs the top results or key fields.

### Approach
Add a response processing layer between the API client and the MCP response serialization. This layer trims, summarizes, and caps responses based on configurable rules per tool type. The full data is still available if explicitly requested.

### Files to Create/Modify

**New file: `src/utils/response-processor.ts`**

`ResponseProcessor` class with:

- `processResponse(toolName: string, data: any, options?: ProcessOptions): ProcessedResponse`
  - `ProcessOptions`: `{ maxResults?: number, fields?: string[], fullResponse?: boolean }`
  - `ProcessedResponse`: `{ data: any, metadata: { totalResults: number, returned: number, truncated: boolean } }`

- Per-tool processing rules (private methods):
  - **`ensembl_feature_overlap`**: Cap at 50 results (default). Keep fields: `id`, `feature_type`, `seq_region_name`, `start`, `end`, `strand`, `biotype`, `external_name`. Drop raw sequence data.
  - **`ensembl_meta` (species)**: Cap at 50 species. Keep: `name`, `common_name`, `assembly.default`, `taxonomy_id`.
  - **`ensembl_compara` (genetree)**: Flatten tree to list of species + gene pairs. Drop nested alignment sequences unless `aligned: true` was requested.
  - **`ensembl_sequence`**: If sequence is >10KB, truncate to first/last 500bp with `"... [truncated, full length: 45,231 bp] ..."` marker.
  - **`ensembl_variation` (vep)**: Keep: `id`, `most_severe_consequence`, `transcript_consequences[].gene_symbol`, `transcript_consequences[].consequence_terms`, `transcript_consequences[].impact`. Drop input sequence data.
  - **`ensembl_lookup`**: Minimal trimming -- these are already small responses.

- Summary line generation:
  - When results are truncated, prepend a summary: `"Found 847 genes in region 17:7500000-8000000. Showing first 50 (sorted by start position). Use max_results to see more."`

**Modify: `src/handlers/tools.ts`**
- Add optional `max_results` parameter to tool schemas that return arrays: `ensembl_feature_overlap`, `ensembl_variation`, `ensembl_compara`, `ensembl_meta` (species mode)
- In each handler, wrap the API response with `responseProcessor.processResponse(toolName, result, { maxResults: args.max_results })`

**Modify: `index.ts`**
- No structural changes. The handlers return processed responses; serialization stays the same.

### Response Format
```json
{
  "summary": "Found 847 genes in 17:7500000-8000000. Showing 50.",
  "metadata": {
    "total_results": 847,
    "returned": 50,
    "truncated": true
  },
  "data": [ ... ]
}
```

### Configuration
Define defaults in the processor, but allow override via tool args:
```typescript
const DEFAULTS: Record<string, { maxResults: number; fields: string[] }> = {
  ensembl_feature_overlap: { maxResults: 50, fields: ["id", "feature_type", "start", "end", "strand", "biotype", "external_name"] },
  ensembl_meta_species:    { maxResults: 50, fields: ["name", "common_name", "assembly", "taxonomy_id"] },
  ensembl_compara:         { maxResults: 100, fields: ["id", "species", "perc_id", "type"] },
  ensembl_variation_vep:   { maxResults: 50, fields: ["id", "most_severe_consequence", "transcript_consequences"] },
};
```

### Testing
- Unit tests for `ResponseProcessor`:
  - Array with 200 items, maxResults=50 -> returns 50 + correct metadata
  - Long sequence string -> truncated with marker
  - Gene tree -> flattened
  - Small response (<max) -> returned as-is, `truncated: false`

### Size Estimate
~150 lines for `response-processor.ts`, ~40 lines of schema changes, ~20 lines of handler changes.

---

## Plan 4: Actionable Error Messages

### Problem
Current errors are generic: `"Ensembl API error: 400 Bad Request"` or `"Invalid species: zebra_fish"`. Users (and LLMs) don't know what went wrong or how to fix it. They have to guess at valid species names, correct region formats, or which parameters are needed.

### Approach
Create an error enrichment layer that catches known error patterns and adds context-specific suggestions. This sits in the API client's error handling path.

### Files to Create/Modify

**New file: `src/utils/error-handler.ts`**

```typescript
export class EnsemblError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly suggestion?: string,
    public readonly example?: string
  ) {
    super(message);
    this.name = "EnsemblError";
  }

  toJSON() {
    return {
      error: this.message,
      suggestion: this.suggestion,
      example: this.example,
      success: false,
    };
  }
}
```

Error enrichment function:
```typescript
export function enrichError(
  statusCode: number,
  statusText: string,
  endpoint: string,
  params?: Record<string, string>
): EnsemblError
```

Handles these known patterns:

| Pattern | Current error | Improved error |
|---------|--------------|----------------|
| 400 on `/lookup/symbol/:species/:symbol` | "400 Bad Request" | "Gene symbol 'BRAC1' not found for homo_sapiens. Check spelling -- did you mean 'BRCA1'? Use ensembl_lookup with lookup_type='symbol'." |
| 400 on `/overlap/region` with bad region | "400 Bad Request" | "Invalid region format '17:7,565,096-7,590,856'. Remove commas and use format 'chromosome:start-end' (e.g., '17:7565096-7590856')." |
| 404 on `/lookup/id/:id` | "404 Not Found" | "ID 'ENSG00000141510X' not found. Ensembl stable IDs follow the pattern ENSG[0-9]{11}. Verify the ID or use ensembl_lookup with lookup_type='symbol' to search by gene name." |
| 400 with unknown species | "Invalid species: zebra_fish" | "Species 'zebra_fish' not recognized. Did you mean 'danio_rerio' (zebrafish)? Use ensembl_meta with info_type='species' to list all available species." |
| 429 rate limited | "429 Too Many Requests" | "Ensembl API rate limit exceeded. The server will retry automatically. If this persists, space out your requests." |
| 503 server down | "503 Service Unavailable" | "Ensembl REST API is temporarily unavailable. Check status at https://rest.ensembl.org/info/ping. This is usually resolved within minutes." |
| Missing required param | "feature_id required for CDS mapping" | "CDS mapping requires a transcript or translation ID. Provide feature_id (e.g., 'ENST00000288602') along with coordinates." |

Species fuzzy matching:
- Maintain a small lookup table of common misspellings and aliases
- `"zebra_fish" -> "danio_rerio"`, `"fruitfly" -> "drosophila_melanogaster"`, `"worm" -> "caenorhabditis_elegans"`
- Already partially exists in `input-normalizer.ts` -- reuse that mapping in error messages

**Modify: `src/utils/ensembl-api.ts`**
- Import `enrichError` and `EnsemblError`
- In `makeRequest()`, replace the generic `throw new Error(...)` with:
  ```typescript
  throw enrichError(response.status, response.statusText, endpoint, params);
  ```
- In validation methods (e.g., `validateSpecies`), throw `EnsemblError` with suggestions

**Modify: `src/handlers/tools.ts`**
- In the catch blocks, check if error is `EnsemblError` and use its `toJSON()` method for structured error responses:
  ```typescript
  catch (error) {
    if (error instanceof EnsemblError) {
      return error.toJSON();
    }
    return { error: error instanceof Error ? error.message : "Unknown error", success: false };
  }
  ```

### Levenshtein Distance for "Did you mean?"
For species and gene symbol mismatches, compute edit distance against known values to suggest corrections. Keep it simple -- use a 50-line implementation, no external dependency.

### Testing
- Unit tests for `enrichError()`:
  - 400 on region endpoint -> format suggestion
  - 404 on lookup -> ID format hint
  - Unknown species -> fuzzy match suggestion
  - 429 -> rate limit message
  - 503 -> service status message

### Size Estimate
~120 lines for `error-handler.ts`, ~20 lines for Levenshtein helper, ~15 lines of changes in `ensembl-api.ts`, ~10 lines in `tools.ts`.

---

## Plan 5: Structured Logging

### Problem
The server currently has zero observability. The only output is `console.error("Ensembl MCP server running on stdio")` at startup. When something goes wrong in production -- slow responses, API errors, rate limit hits -- there's no way to diagnose it without adding ad-hoc logging and redeploying.

### Approach
Add a lightweight structured logger (JSON lines to stderr) that tracks request lifecycle, performance, errors, and cache activity. No external dependencies -- use a simple custom logger that writes to stderr (MCP uses stdout for protocol messages, so stderr is the correct output channel).

### Files to Create/Modify

**New file: `src/utils/logger.ts`**

```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;

  constructor(level?: LogLevel) {
    this.level = level ?? this.parseEnvLevel();
  }

  private parseEnvLevel(): LogLevel {
    const env = process.env.ENSEMBL_LOG_LEVEL?.toUpperCase();
    return LogLevel[env as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private log(level: LogLevel, event: string, data?: Record<string, unknown>): void {
    if (level < this.level) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      event,
      ...data,
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  debug(event: string, data?: Record<string, unknown>) { this.log(LogLevel.DEBUG, event, data); }
  info(event: string, data?: Record<string, unknown>)  { this.log(LogLevel.INFO, event, data); }
  warn(event: string, data?: Record<string, unknown>)  { this.log(LogLevel.WARN, event, data); }
  error(event: string, data?: Record<string, unknown>) { this.log(LogLevel.ERROR, event, data); }
}

export const logger = new Logger();
```

**Modify: `src/utils/ensembl-api.ts`**
- Import `logger`
- In `makeRequest()`:
  ```typescript
  const start = Date.now();
  logger.debug("api_request_start", { endpoint, params });
  // ... fetch ...
  logger.info("api_request_complete", { endpoint, status: response.status, duration_ms: Date.now() - start });
  ```
- In `enforceRateLimit()`:
  ```typescript
  if (waitTime > 0) {
    logger.debug("rate_limit_wait", { wait_ms: waitTime });
  }
  ```
- On error:
  ```typescript
  logger.error("api_request_error", { endpoint, status: response.status, statusText: response.statusText });
  ```

**Modify: `src/handlers/tools.ts`**
- Import `logger`
- At the top of each handler:
  ```typescript
  logger.info("tool_call", { tool: "ensembl_lookup", args: { ...normalizedArgs } });
  ```
- In catch blocks:
  ```typescript
  logger.error("tool_error", { tool: "ensembl_lookup", error: error.message });
  ```

**Modify: `index.ts`**
- Import `logger`
- At startup: `logger.info("server_start", { version: "1.0.0" })`
- Replace `console.error("Ensembl MCP server running on stdio")` with logger call

**If Plan 1 (caching) is also implemented, add to cache.ts:**
- `logger.debug("cache_hit", { key })` / `logger.debug("cache_miss", { key })`
- `logger.info("cache_stats", { size: cache.size, hits, misses })` periodically

### Configuration
- `ENSEMBL_LOG_LEVEL` env var: `DEBUG`, `INFO` (default), `WARN`, `ERROR`
- In Docker/production, default to `INFO`
- In dev mode (`npm run dev`), default to `DEBUG`

### Log Output Example
```json
{"timestamp":"2025-01-15T10:30:00.123Z","level":"INFO","event":"server_start","version":"1.0.0"}
{"timestamp":"2025-01-15T10:30:01.456Z","level":"INFO","event":"tool_call","tool":"ensembl_lookup","args":{"identifier":"BRCA1","lookup_type":"symbol"}}
{"timestamp":"2025-01-15T10:30:01.460Z","level":"DEBUG","event":"api_request_start","endpoint":"/lookup/symbol/homo_sapiens/BRCA1"}
{"timestamp":"2025-01-15T10:30:01.720Z","level":"INFO","event":"api_request_complete","endpoint":"/lookup/symbol/homo_sapiens/BRCA1","status":200,"duration_ms":260}
```

### Testing
- Unit test `Logger`:
  - Verify JSON output format
  - Verify level filtering (DEBUG not emitted when level=INFO)
  - Verify `parseEnvLevel()`

### Size Estimate
~60 lines for `logger.ts`, ~30 lines of changes across `ensembl-api.ts`, `tools.ts`, and `index.ts`.

---

## Plan 6: Retry Logic with Exponential Backoff

### Problem
The API client has no retry logic. Transient failures -- 429 (rate limited), 503 (server maintenance), network timeouts, DNS hiccups -- cause immediate tool failure. Ensembl's servers occasionally return 429 during peak usage or 503 during brief maintenance windows. These are recoverable if retried after a short delay.

### Approach
Add retry logic with exponential backoff directly in the `makeRequest()` method. Only retry on specific transient status codes and network errors. Non-retryable errors (400, 404, 422) fail immediately.

### Files to Modify

**Modify: `src/utils/ensembl-api.ts`**

Add retry configuration:
```typescript
interface RetryConfig {
  maxRetries: number;       // default: 3
  baseDelay: number;        // default: 1000ms
  maxDelay: number;         // default: 10000ms
  retryableStatuses: Set<number>;  // 429, 500, 502, 503, 504
}

private readonly retryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: new Set([429, 500, 502, 503, 504]),
};
```

Modify `makeRequest()` to wrap the fetch in a retry loop:
```typescript
private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  await this.enforceRateLimit();
  const url = /* ... build URL ... */;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(30000) });

      if (response.ok) {
        return response.json() as T;
      }

      // Non-retryable status -- fail immediately
      if (!this.retryConfig.retryableStatuses.has(response.status)) {
        throw enrichError(response.status, response.statusText, endpoint, params);
      }

      // Retryable status -- check Retry-After header from Ensembl
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt), this.retryConfig.maxDelay);

      // Add jitter (0-25% of delay) to avoid thundering herd
      const jitter = Math.random() * delay * 0.25;

      logger.warn("api_retry", {
        endpoint,
        attempt: attempt + 1,
        status: response.status,
        delay_ms: Math.round(delay + jitter),
      });

      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      lastError = new Error(`${response.status} ${response.statusText}`);

    } catch (error) {
      // Network errors (ECONNRESET, timeout, DNS) are retryable
      if (error instanceof TypeError || (error as any)?.code === "ABORT_ERR") {
        const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt), this.retryConfig.maxDelay);
        const jitter = Math.random() * delay * 0.25;

        logger.warn("api_retry_network", {
          endpoint,
          attempt: attempt + 1,
          error: (error as Error).message,
          delay_ms: Math.round(delay + jitter),
        });

        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        lastError = error as Error;
        continue;
      }
      // Non-retryable errors (e.g., EnsemblError from enrichError) -- rethrow
      throw error;
    }
  }

  // All retries exhausted
  throw new Error(`Ensembl API request failed after ${this.retryConfig.maxRetries + 1} attempts: ${lastError?.message}`);
}
```

Key behaviors:
- **Retry-After header**: Ensembl sends this on 429. Respect it instead of using calculated delay.
- **Exponential backoff**: 1s, 2s, 4s (capped at 10s).
- **Jitter**: Random 0-25% added to each delay to prevent synchronized retries.
- **Request timeout**: 30s per attempt via `AbortSignal.timeout()`.
- **Non-retryable errors pass through immediately**: 400, 401, 403, 404, 422.

### Integration with Rate Limiter
The existing `enforceRateLimit()` runs before the retry loop, not inside it. On retries, the delay itself serves as the rate limit. After a successful retry, `lastRequestTime` is updated normally.

### Integration with Logger (Plan 5)
If Plan 5 is implemented, retry events are logged as warnings. If not, the `logger.warn()` calls can be replaced with `console.error()` or removed.

### Testing
Add to `tests/test-retry.ts`:
- Mock a 429 response followed by a 200 -- verify retry succeeds
- Mock 3x 503 then 200 -- verify all retries attempted
- Mock 4x 503 (exceeds maxRetries) -- verify final error thrown
- Mock 400 -- verify no retry attempted
- Verify exponential delay timing (approximately -- allow 20% tolerance)
- Verify Retry-After header is respected

Since these tests need to mock `fetch`, this is a good motivator for Plan 8 (proper test framework) -- but can be done with a simple `globalThis.fetch` override in the test file for now.

### Size Estimate
~50 lines of retry logic replacing the current 10-line `makeRequest()` body. No new files needed.
