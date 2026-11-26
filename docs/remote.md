# Remote endpoint

`worker/` is a Cloudflare Worker that serves this server over Streamable HTTP behind Google sign-in. It is an OAuth authorization server for MCP clients (`@cloudflare/workers-oauth-provider`: dynamic registration, client ID metadata documents, a consent page), it accepts only the Google accounts in `ALLOWED_EMAILS`, and it answers `/mcp` itself with the same tools as the npm package. Nothing runs on your own machine.

The npm package and the `.mcpb` bundle are unchanged and need none of this.

The Worker builds a new server for each request and keeps no sessions. The pause between Scryfall calls and the loaded Comprehensive Rules are kept per Worker instance, so every signed-in user shares them and shares one address toward Scryfall.

## Setup

1. Google Cloud Console: an OAuth client of type Web application, redirect URI `https://<worker host>/callback`. An existing client works when you add the redirect URI to it. Consent screen in Testing is enough; add each allowed account as a test user.
2. In the repo root: `npm install` and `npm run build:ui`. The Worker bundles the card viewer that this writes to `dist/`.
3. In `worker/`: `npm install`, `npx wrangler login`, and copy `wrangler.example.jsonc` to `wrangler.jsonc`. The copy holds your host name and KV namespace id and is not committed. Then `npx wrangler kv namespace create scryfall-mcp-oauth` and paste the id into it.
4. Set `MCP_RESOURCE_URL` in `wrangler.jsonc` to the deployed endpoint, `https://scryfall-mcp.<account>.workers.dev/mcp`.
5. Secrets: `npx wrangler secret put GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ALLOWED_EMAILS` (comma-separated, lowercase). Optional `CONSENT_SECRET` (32+ random characters) remembers an approved client for 30 days.
6. `npm run deploy`.

`npm run dev` serves the Worker on `http://localhost:8789` from a `.dev.vars` file; copy `.dev.vars.example`.

## Connecting

Give the client the endpoint URL and sign in when it asks. In Claude Code: `claude mcp add --transport http scryfall https://<worker host>/mcp`, then authenticate from `/mcp`.

## Who gets in

Sign-in is fail-closed: an empty `ALLOWED_EMAILS` rejects everyone. The allow-list is checked again on every request to `/mcp`, so taking an account off it stops that account's existing tokens. Dynamic client registration is open, as MCP clients expect: anyone can register a client and reach the consent page, and nobody gets a token without an allowed Google account.

## What has been run

Not deployed yet. Checked on 2026-11-26 in `wrangler dev`: the Worker answers `/mcp` with 401 and the resource metadata link when there is no token or a made-up one, serves both discovery documents, and registers a client. With sign-in left out, the same handler answered `initialize`, `tools/list`, the card viewer resource, a Scryfall search and a rules search in the Workers runtime. `test/worker-mcp.test.ts` runs the handler in Node. Not run: a Google sign-in, a client connected through it, and the deployed Worker's CPU time when it loads the Comprehensive Rules.
