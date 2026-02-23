import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";

const transport = new StdioServerTransport();
const server = createServer();

await server.connect(transport);
console.error("Scryfall MCP server running via stdio");

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
