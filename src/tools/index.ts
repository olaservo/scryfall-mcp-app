import type { ReadResourceResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, RESOURCE_MIME_TYPE } from "../ui-meta.js";
import { registerSearchTool } from "./search.js";
import { registerFetchTool, CARD_VIEWER_URI } from "./fetch.js";
import { registerRulesTools } from "./rules.js";
import { registerRulingsTool } from "./rulings.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getDistDir(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  // When running from dist/, thisDir is dist/tools/
  // When running from src/ via tsx, thisDir is src/tools/
  if (thisDir.includes("dist")) {
    return path.resolve(thisDir, "..");
  }
  return path.resolve(thisDir, "..", "..", "dist");
}

export const registerTools = (server: McpServer): void => {
  registerSearchTool(server);
  registerFetchTool(server);
  registerRulesTools(server);
  registerRulingsTool(server);

  registerAppResource(
    server,
    CARD_VIEWER_URI,
    CARD_VIEWER_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const distDir = getDistDir();
      const html = await fs.readFile(
        path.join(distDir, "card-viewer.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: CARD_VIEWER_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  resourceDomains: [
                    "https://cards.scryfall.io",
                    "https://svgs.scryfall.io",
                  ],
                },
              },
            },
          },
        ],
      };
    },
  );
};
