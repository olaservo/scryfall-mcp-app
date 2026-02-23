import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "scryfall-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        "Search and fetch Magic: The Gathering card data from Scryfall. " +
        "Use the 'search' tool with Scryfall full-text query syntax to find cards, " +
        "then use 'fetch' with a card ID to get full details.",
    },
  );

  registerTools(server);

  return server;
}
