#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from "@modelcontextprotocol/sdk/types";

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
} from "./src/handlers/tools";

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
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest) => {
        const { name, arguments: args } = request.params;

        try {
          switch (name) {
            case "ensembl_feature_overlap":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleFeatureOverlap(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "ensembl_regulatory":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleRegulatory(args), null, 2),
                  },
                ],
              };

            case "ensembl_protein_features":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleProteinFeatures(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "ensembl_meta":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleMeta(args), null, 2),
                  },
                ],
              };

            case "ensembl_lookup":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleLookup(args), null, 2),
                  },
                ],
              };

            case "ensembl_sequence":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleSequence(args), null, 2),
                  },
                ],
              };

            case "ensembl_mapping":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleMapping(args), null, 2),
                  },
                ],
              };

            case "ensembl_compara":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleCompara(args), null, 2),
                  },
                ],
              };

            case "ensembl_variation":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleVariation(args), null, 2),
                  },
                ],
              };

            case "ensembl_ontotax":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleOntoTax(args), null, 2),
                  },
                ],
              };

            default:
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: errorMessage,
                    success: false,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Ensembl MCP server running on stdio");
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
