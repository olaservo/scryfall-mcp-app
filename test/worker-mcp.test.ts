import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpHandler } from "../worker/src/mcp.js";

const HTML = "<!doctype html><title>card viewer</title>";

async function call(method: string, params: unknown, id = 1): Promise<any> {
  const response = await mcpHandler(HTML).fetch(
    new Request("https://scryfall.example.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  assert.equal(response.status, 200);
  const text = await response.text();
  // A 2025 client is answered as JSON or as one SSE message.
  const json = response.headers.get("content-type")?.includes("text/event-stream")
    ? text.split("\n").find((line) => line.startsWith("data: "))!.slice(6)
    : text;
  return JSON.parse(json).result;
}

const INITIALIZE = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } };

test("the worker's handler answers initialize without a session", async () => {
  const result = await call("initialize", INITIALIZE);
  assert.equal(result.serverInfo.name, "scryfall-mcp-server");
});

test("each request gets the same tools from a new server", async () => {
  const result = await call("tools/list", {});
  const names = result.tools.map((tool: { name: string }) => tool.name).sort();
  assert.deepEqual(names, ["fetch", "get_rule", "get_rulings", "search", "search_rules"]);
});

test("the card viewer comes from the string the host passed in", async () => {
  const { resources } = await call("resources/list", {});
  assert.equal(resources.length, 1);
  const result = await call("resources/read", { uri: resources[0].uri });
  assert.equal(result.contents[0].text, HTML);
});
