import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchCard, isScryfallError, ScryfallCard } from "../scryfall-api.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

export const CARD_VIEWER_URI = "ui://scryfall/card-viewer.html";

const FetchInputShape = {
  id: z
    .string()
    .uuid()
    .describe("Scryfall card UUID (obtained from the search tool results)"),
};

const FetchSchema = z.object(FetchInputShape);

function formatCardText(card: ScryfallCard): string {
  const parts: string[] = [];

  // Card faces or single card text
  if (card.card_faces && card.card_faces.length > 0) {
    parts.push(
      card.card_faces
        .map(
          (face) =>
            `${face.name || ""}\n${face.type_line || ""}\n${face.mana_cost || ""}\n\n${face.oracle_text || ""}`,
        )
        .join("\n\n---\n\n"),
    );
  } else {
    parts.push(
      `${card.name}\n${card.type_line}\n${card.mana_cost || ""}\n\n${card.oracle_text || ""}`,
    );
  }

  // Metadata
  parts.push(`Set: ${card.set_name} (${card.set.toUpperCase()}) #${card.collector_number}`);
  parts.push(`Rarity: ${card.rarity}`);
  parts.push(`Released: ${card.released_at}`);
  if (card.colors && card.colors.length > 0) {
    parts.push(`Colors: ${card.colors.join(", ")}`);
  }

  // Prices
  const priceEntries = Object.entries(card.prices)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: $${v}`);
  if (priceEntries.length > 0) {
    parts.push(`Prices: ${priceEntries.join(", ")}`);
  }

  // Image URI for non-UI hosts
  const imageUri =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
  if (imageUri) {
    parts.push(`Image: ${imageUri}`);
  }

  parts.push(`ID: ${card.id}`);
  parts.push(`Scryfall: ${card.scryfall_uri}`);
  parts.push(`API: ${card.uri}`);

  return parts.join("\n");
}

export const registerFetchTool = (server: McpServer) => {
  registerAppTool(
    server,
    "fetch",
    {
      title: "Fetch Card",
      description:
        "Fetch detailed information for a single Magic: The Gathering card by its Scryfall UUID. " +
        "Returns the card's full oracle text, type line, mana cost, colors, set info, rarity, " +
        "prices, and image URIs. Handles double-faced cards (e.g., transform, modal DFC).",
      inputSchema: FetchInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: CARD_VIEWER_URI },
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

      const structured = {
        name: result.name,
        type_line: result.type_line,
        mana_cost: result.mana_cost,
        oracle_text: result.oracle_text,
        set_name: result.set_name,
        set: result.set,
        rarity: result.rarity,
        collector_number: result.collector_number,
        released_at: result.released_at,
        colors: result.colors,
        prices: result.prices,
        scryfall_uri: result.scryfall_uri,
        image_uris: result.image_uris,
        card_faces: result.card_faces,
      };

      return {
        content: [{ type: "text" as const, text: formatCardText(result) }],
        structuredContent: structured,
      };
    },
  );
};
