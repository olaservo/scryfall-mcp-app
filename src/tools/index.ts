import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchTool } from "./search.js";
import { registerFetchTool } from "./fetch.js";

export const registerTools = (server: McpServer): void => {
  registerSearchTool(server);
  registerFetchTool(server);
};
