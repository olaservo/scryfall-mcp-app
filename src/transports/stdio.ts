import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { readCardViewerHtml } from "../card-viewer-file.js";
import { createServer } from "../server.js";

const transport = new StdioServerTransport();
const server = createServer({ cardViewerHtml: readCardViewerHtml });

await server.connect(transport);
console.error("Scryfall MCP server running via stdio");

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
