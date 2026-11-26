import type { ReadResourceResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, RESOURCE_MIME_TYPE } from "../ui-meta.js";
import { registerSearchTool } from "./search.js";
import { registerFetchTool, CARD_VIEWER_URI } from "./fetch.js";
import { registerRulesTools } from "./rules.js";
import { registerRulingsTool } from "./rulings.js";

export const registerTools = (
  server: McpServer,
  cardViewerHtml: () => Promise<string>,
): void => {
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
      const html = await cardViewerHtml();
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
