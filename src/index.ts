#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from "@modelcontextprotocol/sdk/types.js";

import {
  ensemblTools,
  handleGetGeneInfo,
  handleSearchGenes,
  handleGetSequence,
  handleGetVariantsInRegion,
  handleGetVariantInfo,
  handleGetTranscriptInfo,
  handleListSpecies,
  handleGetSpeciesInfo,
  handleGetAssemblyInfo,
  handleGetGeneXrefs,
} from "./handlers/tools.js";

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
            case "get_gene_info":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetGeneInfo(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "search_genes":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleSearchGenes(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_sequence":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetSequence(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_variants_in_region":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetVariantsInRegion(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_variant_info":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetVariantInfo(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_transcript_info":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetTranscriptInfo(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "list_species":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await handleListSpecies(), null, 2),
                  },
                ],
              };

            case "get_species_info":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetSpeciesInfo(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_assembly_info":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetAssemblyInfo(args),
                      null,
                      2
                    ),
                  },
                ],
              };

            case "get_gene_xrefs":
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      await handleGetGeneXrefs(args),
                      null,
                      2
                    ),
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

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EnsemblMCPServer();
  server.run().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
