import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CitationList, SCRYFALL, WIZARDS } from "../citations.js";
import {
  fetchCard,
  fetchCardByName,
  fetchRulings,
  isScryfallError,
  type ScryfallError,
} from "../scryfall-api.js";

const RulingsSchema = z.object({
  id: z.uuid().optional().describe("Scryfall card UUID, from the search tool"),
  name: z.string().min(1).optional().describe("Card name. Misspellings and partial words are allowed if they match one card."),
});

function errorResult(error: ScryfallError): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: true, status: error.status, body: error.body }) }],
    isError: true,
  };
}

export const registerRulingsTool = (server: McpServer) => {
  server.registerTool(
    "get_rulings",
    {
      title: "Get Card Rulings",
      description:
        "Get a Magic: The Gathering card's Oracle text and its rulings from Scryfall, by Scryfall UUID or by name. " +
        "Each ruling says whether it came from Wizards of the Coast or from Scryfall, and when it was published. " +
        "Carries citation markers to quote when answering a rules question about the card.",
      inputSchema: RulingsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, name }, ctx): Promise<CallToolResult> => {
      if (!id && !name) {
        return { content: [{ type: "text", text: "Give a card id or name." }], isError: true };
      }
      const card = id ? await fetchCard(id) : await fetchCardByName(name!);
      if (isScryfallError(card)) return errorResult(card);
      const rulings = await fetchRulings(card.id);
      if (isScryfallError(rulings)) return errorResult(rulings);

      const page = new URL(card.scryfall_uri);
      page.searchParams.delete("utm_source");
      const url = page.href;

      const list = new CitationList();
      const faces = card.oracle_text !== undefined
        ? [{ name: card.name, oracle_text: card.oracle_text }]
        : (card.card_faces ?? []).map((f) => ({ name: f.name ?? card.name, oracle_text: f.oracle_text ?? "" }));
      const oracle = faces.map(
        (f) =>
          `${f.name}\n${f.oracle_text} ` +
          list.cite({ name: `${f.name} Oracle text`, url, text: f.oracle_text, author: WIZARDS, publisher: SCRYFALL }),
      );

      const lines = rulings.map((r) => {
        const by = r.source === "wotc" ? WIZARDS : SCRYFALL;
        const marker = list.cite({
          name: `Ruling on ${card.name}, ${r.published_at}`,
          url,
          text: r.comment,
          datePublished: r.published_at,
          author: by,
          publisher: SCRYFALL,
        });
        return `- ${r.published_at} (${by.name}): ${r.comment} ${marker}`;
      });

      const text = [
        `Oracle text:\n${oracle.join("\n\n")}`,
        rulings.length > 0 ? `Rulings (${rulings.length}):\n${lines.join("\n")}` : "No rulings.",
      ].join("\n\n");

      return list.result(server, ctx, text, {
        name: card.name,
        id: card.id,
        oracle_id: card.oracle_id,
        scryfall_uri: url,
        oracle: faces,
        rulings: rulings.map((r) => ({ source: r.source, published_at: r.published_at, comment: r.comment })),
      });
    },
  );
};
