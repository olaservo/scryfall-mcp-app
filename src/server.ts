import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "scryfall-mcp-server",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        "Search and fetch Magic: The Gathering card data from Scryfall. " +
        "Use the 'search' tool with Scryfall full-text query syntax to find cards, " +
        "then use 'fetch' with a card ID to get full details. " +
        "For rules questions, use 'get_rule' and 'search_rules' for the Comprehensive Rules " +
        "and 'get_rulings' for a card's Oracle text and rulings. " +
        "Cite them with the [cN] markers and links they return, and give the rules' effective date.",
    },
  );

  registerTools(server);

  return server;
}
