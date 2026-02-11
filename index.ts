#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

import {
  ensemblTools,
  handleFeatureOverlap,
  handleRegulatory,
  handleProteinFeatures,
  handleMeta,
  handleLookup,
  handleSequence,
  handleMapping,
  handleCompara,
  handleVariation,
  handleOntoTax,
} from "./src/handlers/tools.js";
import {
  ensemblResources,
  ensemblResourceTemplates,
  handleReadResource,
} from "./src/handlers/resources.js";
import { ensemblPrompts, handleGetPrompt } from "./src/handlers/prompts.js";
import { logger } from "./src/utils/logger.js";
import { formatToolResponse } from "./src/utils/formatter.js";

function setupHandlers(server: Server): void {
  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: ensemblTools };
  });

  // Handle tool execution
  const toolHandlers: Record<string, (args: any) => Promise<unknown>> = {
    ensembl_feature_overlap: handleFeatureOverlap,
    ensembl_regulatory: handleRegulatory,
    ensembl_protein_features: handleProteinFeatures,
    ensembl_meta: handleMeta,
    ensembl_lookup: handleLookup,
    ensembl_sequence: handleSequence,
    ensembl_mapping: handleMapping,
    ensembl_compara: handleCompara,
    ensembl_variation: handleVariation,
    ensembl_ontotax: handleOntoTax,
  };

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        const handler = toolHandlers[name];
        if (!handler) throw new Error(`Unknown tool: ${name}`);

        const result = await handler(args);
        return {
          content: [
            { type: "text", text: formatToolResponse(name, result, args) },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text",
              text: formatToolResponse(
                name,
                { error: errorMessage, success: false },
                args
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: ensemblResources };
  });

  // Handle resource template listing
  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => {
      return { resourceTemplates: ensemblResourceTemplates };
    }
  );

  // Handle resource reading
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      return handleReadResource(request.params.uri);
    }
  );

  // Handle prompt listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: ensemblPrompts };
  });

  // Handle prompt retrieval
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return handleGetPrompt(
      request.params.name,
      (request.params.arguments ?? {}) as Record<string, string>
    );
  });
}

function createMCPServer(): Server {
  const server = new Server(
    { name: "ensembl-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  setupHandlers(server);
  return server;
}

// ---------------------------------------------------------------------------
// Stdio mode (local / Claude Desktop)
// ---------------------------------------------------------------------------

export class EnsemblMCPServer {
  private server: Server;

  constructor() {
    this.server = createMCPServer();
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("server_start", { version: "1.0.0", mode: "stdio" });
  }
}

// ---------------------------------------------------------------------------
// HTTP mode (Render / remote deployment)
// ---------------------------------------------------------------------------

function startHttpServer(port: number): void {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", name: "ensembl-mcp", version: "1.0.0" }));
      return;
    }

    // MCP endpoint
    if (req.url === "/mcp") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Route to existing session
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          sessions.set(id, transport);
        },
      });

      transport.onclose = () => {
        const id = [...sessions.entries()].find(([, t]) => t === transport)?.[0];
        if (id) sessions.delete(id);
      };

      const mcpServer = createMCPServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    logger.info("server_start", { version: "1.0.0", mode: "http", port });
    console.log(`Ensembl MCP server listening on http://0.0.0.0:${port}/mcp`);
  });
}

// ---------------------------------------------------------------------------
// Entrypoint: PORT env = HTTP mode, otherwise stdio
// ---------------------------------------------------------------------------

if (
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"))
) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;

  if (port) {
    startHttpServer(port);
  } else {
    const server = new EnsemblMCPServer();
    server.run().catch((error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  }
}
