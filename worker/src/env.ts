import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/** The signed-in Google account. `id` is the Google `sub`. */
export interface Principal {
  id: string;
  email: string;
  name?: string;
}

/** Bindings, vars, and secrets the Worker expects. Vars come from wrangler.jsonc, secrets from `wrangler secret put` or `.dev.vars`. */
export interface Env {
  OAUTH_KV: KVNamespace;
  /** The MCP endpoint URL clients connect to; the OAuth resource every token is bound to. */
  MCP_RESOURCE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Comma-separated Google account emails allowed to sign in. Empty or missing denies everyone. */
  ALLOWED_EMAILS?: string;
  /** Optional, 32+ characters. When set, an approved client is remembered for 30 days. */
  CONSENT_SECRET?: string;
}

/** What the OAuth provider hands `defaultHandler` beside the bindings. */
export type AuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

/** Stored encrypted in the grant by completeAuthorization, handed back as ctx.props. */
export type Props = Principal;

export function parseAllowedEmails(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
