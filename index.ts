#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

export class EnsemblMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "ensembl-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: ensemblTools,
      };
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

    this.server.setRequestHandler(
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
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: ensemblResources };
    });

    // Handle resource template listing
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => {
        return { resourceTemplates: ensemblResourceTemplates };
      }
    );

    // Handle resource reading
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        return handleReadResource(request.params.uri);
      }
    );

    // Handle prompt listing
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: ensemblPrompts };
    });

    // Handle prompt retrieval
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return handleGetPrompt(
        request.params.name,
        (request.params.arguments ?? {}) as Record<string, string>
      );
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("server_start", { version: "1.0.0" });
  }
}

// More reliable execution check for MCP servers
if (
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"))
) {
  const server = new EnsemblMCPServer();
  server.run().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
