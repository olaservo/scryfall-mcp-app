import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchCard, isScryfallError, ScryfallCard } from "../scryfall-api.js";

const FetchSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe("Scryfall card UUID (obtained from the search tool results)"),
});

function formatCardText(card: ScryfallCard): string {
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces
      .map(
        (face) =>
          `${face.name || ""}\n${face.type_line || ""}\n${face.mana_cost || ""}\n\n${face.oracle_text || ""}`,
      )
      .join("\n\n---\n\n");
  }

  return (
    `${card.name}\n${card.type_line}\n${card.mana_cost || ""}\n\n` +
    `${card.oracle_text || ""}\n\nSet: ${card.set_name}\nRarity: ${card.rarity}`
  );
}

export const registerFetchTool = (server: McpServer) => {
  server.registerTool(
    "fetch",
    {
      title: "Fetch Card",
      description:
        "Fetch detailed information for a single Magic: The Gathering card by its Scryfall UUID. " +
        "Returns the card's full oracle text, type line, mana cost, colors, set info, rarity, " +
        "prices, and image URIs. Handles double-faced cards (e.g., transform, modal DFC).",
      inputSchema: FetchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const { id } = FetchSchema.parse(args);
      const result = await fetchCard(id);

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

      const document = {
        id: result.id,
        title: result.name,
        text: formatCardText(result),
        url: result.scryfall_uri,
        metadata: {
          type_line: result.type_line,
          mana_cost: result.mana_cost,
          colors: result.colors,
          set: result.set,
          set_name: result.set_name,
          rarity: result.rarity,
          released_at: result.released_at,
          prices: result.prices,
          image_uris: result.image_uris ?? result.card_faces?.[0]?.image_uris,
          uri: result.uri,
        },
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(document) }],
      };
    },
  );
};
