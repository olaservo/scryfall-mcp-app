import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { createServer } from "../../src/server.js";

/** The server behind a fetch handler: a new instance for each request, and no sessions. */
export function mcpHandler(cardViewerHtml: string): McpHttpHandler {
  return createMcpHandler(() => createServer({ cardViewerHtml: async () => cardViewerHtml }));
}
