import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchCards, isScryfallError } from "../scryfall-api.js";

const SearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Scryfall full-text search query. Supports Scryfall syntax " +
        '(e.g., "c:red t:creature cmc=3", "set:mkm", "o:\\"draw a card\\"")',
    ),
});

export const registerSearchTool = (server: McpServer) => {
  server.registerTool(
    "search",
    {
      title: "Search Cards",
      description:
        "Search for Magic: The Gathering cards using Scryfall full-text query syntax. " +
        "Returns a list of matching cards with their Scryfall IDs, names, and URLs. " +
        "Use Scryfall search syntax: color (c:), type (t:), CMC (cmc=), set (set:), " +
        'oracle text (o:"..."), power/toughness (pow=, tou=), rarity (r:), etc.',
      inputSchema: SearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const { query } = SearchSchema.parse(args);
      const result = await searchCards(query);

      if (isScryfallError(result)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: true,
                status: result.status,
                body: result.body,
              }),
            },
          ],
          isError: true,
        };
      }

      const results = {
        results: result.data.map((card) => ({
          id: card.id,
          title: card.name,
          url:
            card.scryfall_uri ||
            `https://scryfall.com/card/${card.set}/${card.collector_number}`,
        })),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    },
  );
};
