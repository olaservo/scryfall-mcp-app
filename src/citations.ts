// Citations in the shape of SEP-3094, carried in the result's `_meta` as in
// https://github.com/olaservo/citation-audit-demo. The text the model reads has
// `[cN]` markers and link definitions. The `_meta` entries carry the details.
import {
  CLIENT_CAPABILITIES_META_KEY,
  type CallToolResult,
  type ClientCapabilities,
  type McpServer,
  type ServerContext,
} from "@modelcontextprotocol/server";

export const CITATIONS_EXTENSION = "io.modelcontextprotocol/citations";

type Party = { type: "Organization"; name: string };

export interface Citation {
  id?: string;
  name?: string;
  url?: string;
  text?: string;
  datePublished?: string;
  author?: Party;
  publisher?: Party;
  license?: string;
  "mcp:annotations"?: { lastModified?: string };
}

export const WIZARDS: Party = { type: "Organization", name: "Wizards of the Coast" };
export const SCRYFALL: Party = { type: "Organization", name: "Scryfall" };

/**
 * Whether the client declared the citations extension. Capabilities arrive per
 * request on 2026-07-28 and from `initialize` before that.
 */
function declaresCitations(server: McpServer, ctx: ServerContext): boolean {
  type Caps = ClientCapabilities & { extensions?: Record<string, unknown> };
  const envelope = ctx.mcpReq.envelope as Record<string, Caps | undefined> | undefined;
  const caps: Caps | undefined = envelope?.[CLIENT_CAPABILITIES_META_KEY] ?? server.server.getClientCapabilities();
  return caps?.extensions?.[CITATIONS_EXTENSION] !== undefined;
}

/** Collects citations and hands out their markers. */
export class CitationList {
  readonly items: Citation[] = [];

  /** Adds a citation and returns its marker, such as `[c1]`. */
  cite(citation: Omit<Citation, "id">): string {
    const id = `c${this.items.length + 1}`;
    this.items.push({ id, ...citation });
    return `[${id}]`;
  }

  /** Link definitions for the markers, to end the text with. */
  linkDefinitions(): string {
    return this.items
      .filter((c) => c.url)
      .map((c) => `[${c.id}]: ${c.url}`)
      .join("\n");
  }

  /**
   * A tool result with the text and its link definitions. The citations go in
   * `_meta` only for a client that declared support, as SEP-3094 asks.
   */
  result(
    server: McpServer,
    ctx: ServerContext,
    text: string,
    structuredContent?: Record<string, unknown>,
  ): CallToolResult {
    const links = this.linkDefinitions();
    return {
      content: [{ type: "text", text: links ? `${text}\n\n${links}` : text }],
      ...(structuredContent && { structuredContent }),
      ...(this.items.length > 0 && declaresCitations(server, ctx) && { _meta: { [CITATIONS_EXTENSION]: this.items } }),
    };
  }
}
