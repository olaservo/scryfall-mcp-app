/**
 * Vendored MCP Apps (`ui`) server helpers.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `@modelcontextprotocol/ext-apps` has no release that is compatible with the
 * MCP TypeScript SDK v2: its `/server` entry point is typed against v1's
 * `McpServer` and imports `@modelcontextprotocol/sdk/server/zod-compat.js`, a
 * module that was removed in v2, and its peerDependency is
 * `@modelcontextprotocol/sdk@^1.x`.
 *
 * The server half of this package is on SDK v2, so it cannot import
 * `@modelcontextprotocol/ext-apps/server`. This module is a faithful port of the
 * only two behaviours those helpers add on top of the plain SDK calls — `_meta`
 * normalization for tools and a default MIME type for resources — retyped
 * against the v2 SDK.
 *
 * The browser half (`src/ui/**`) still uses `@modelcontextprotocol/ext-apps` and
 * SDK v1; it is compiled into a self-contained HTML bundle by a separate vite
 * pass and only ever talks to this server over the MCP wire, so no object ever
 * crosses the v1/v2 boundary in-process.
 *
 * DELETE THIS FILE and go back to `@modelcontextprotocol/ext-apps/server` once
 * upstream ships a v2-compatible release.
 *
 * Ported verbatim from `@modelcontextprotocol/ext-apps` `dist/src/server/index.js`.
 */

import type {
  ClientCapabilities,
  McpServer,
  ReadResourceCallback,
  RegisteredResource,
  RegisteredTool,
  ResourceMetadata,
  StandardSchemaWithJSON,
  ToolAnnotations,
  ToolCallback,
} from "@modelcontextprotocol/server";

/**
 * Legacy `_meta` key hosts read to find a tool's UI resource.
 *
 * Deprecated upstream in favour of `_meta.ui.resourceUri`, but still written
 * (and still read by older hosts), so both keys are always emitted.
 */
export const RESOURCE_URI_META_KEY = "ui/resourceUri";

/** MIME type identifying an MCP Apps HTML resource. */
export const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

/** Extension identifier used for MCP Apps capability negotiation. */
export const EXTENSION_ID = "io.modelcontextprotocol/ui";

/** Who may call a UI-backed tool. */
export type McpUiToolVisibility = "model" | "app";

/** `_meta.ui` on a tool declaration. */
export interface McpUiToolMeta {
  /** URI of the UI resource to display for this tool. */
  resourceUri?: string;
  /** Who can access this tool. Default: `["model", "app"]`. */
  visibility?: McpUiToolVisibility[];
  [key: string]: unknown;
}

/**
 * `_meta` for a UI-backed tool. The UI resource may be given either as
 * `_meta.ui.resourceUri` (preferred) or `_meta["ui/resourceUri"]` (legacy);
 * {@link normalizeAppToolMeta} fills in whichever one is missing.
 */
export type McpUiAppToolMeta = { [key: string]: unknown } & (
  | { ui: McpUiToolMeta }
  | { "ui/resourceUri"?: string }
);

/** Config accepted by {@link registerAppTool}, mirroring `McpServer.registerTool`. */
export interface McpUiAppToolConfig<
  InputArgs extends StandardSchemaWithJSON | undefined,
> {
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  outputSchema?: StandardSchemaWithJSON;
  annotations?: ToolAnnotations;
  _meta: McpUiAppToolMeta;
}

/**
 * Normalize a UI tool's `_meta` so both the modern (`_meta.ui.resourceUri`) and
 * the legacy (`_meta["ui/resourceUri"]`) keys are present.
 *
 * This is byte-for-byte the normalization ext-apps' `registerAppTool` applied.
 * Hosts (including Claude) look at either key to find the UI resource, so the
 * output must not drift.
 */
export function normalizeAppToolMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const ui = meta.ui as McpUiToolMeta | undefined;
  const legacy = meta[RESOURCE_URI_META_KEY] as string | undefined;

  if (ui?.resourceUri && !legacy) {
    return { ...meta, [RESOURCE_URI_META_KEY]: ui.resourceUri };
  }
  if (legacy && !ui?.resourceUri) {
    return { ...meta, ui: { ...ui, resourceUri: legacy } };
  }
  return meta;
}

/**
 * `server.registerTool` plus the `_meta` normalization described in
 * {@link normalizeAppToolMeta}. Nothing else.
 */
export function registerAppTool<
  InputArgs extends StandardSchemaWithJSON | undefined = undefined,
>(
  server: Pick<McpServer, "registerTool">,
  name: string,
  config: McpUiAppToolConfig<InputArgs>,
  cb: ToolCallback<InputArgs>,
): RegisteredTool {
  return server.registerTool<StandardSchemaWithJSON, InputArgs>(
    name,
    { ...config, _meta: normalizeAppToolMeta(config._meta) },
    cb,
  );
}

/**
 * `server.registerResource` with the MCP Apps MIME type as a default. Nothing
 * else — a caller-supplied `mimeType` still wins, because the default is spread
 * first.
 */
export function registerAppResource(
  server: Pick<McpServer, "registerResource">,
  name: string,
  uri: string,
  config: ResourceMetadata,
  readCallback: ReadResourceCallback,
): RegisteredResource {
  return server.registerResource(
    name,
    uri,
    { mimeType: RESOURCE_MIME_TYPE, ...config },
    readCallback,
  );
}

/**
 * Read the MCP Apps capability out of the client's declared capabilities.
 *
 * `extensions` is not part of the SDK's `ClientCapabilities` yet (SEP-1724), so
 * it is intersected in here, exactly as ext-apps did.
 */
export function getUiCapability(
  clientCapabilities:
    | (ClientCapabilities & { extensions?: Record<string, unknown> })
    | null
    | undefined,
): unknown {
  if (!clientCapabilities) return undefined;
  return clientCapabilities.extensions?.[EXTENSION_ID];
}
