# Scryfall MCP Server

An MCP server for searching and fetching Magic: The Gathering card data from [Scryfall](https://scryfall.com). Features an [MCP App](https://github.com/modelcontextprotocol/ext-apps) UI that renders card images, mana symbols, oracle text, and pricing when used in compatible hosts like Claude Desktop.

## Tools

- **search** — Search for cards using [Scryfall full-text syntax](https://scryfall.com/docs/syntax) (e.g., `c:red t:creature cmc=3`, `set:mkm`, `o:"draw a card"`)
- **fetch** — Fetch full card details by Scryfall UUID. In MCP App-capable hosts, renders a card viewer UI with the card image, mana cost icons, oracle text, set info, rarity, and prices.

## Setup

```bash
npm install
npm run build
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scryfall": {
      "command": "node",
      "args": ["/path/to/scryfall-mcp-app/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run dev          # Watch mode with tsx
npm run build        # Build UI + server
npm run inspector    # Test with MCP Inspector
```

## How It Works

The server uses the [MCP Apps extension](https://github.com/modelcontextprotocol/ext-apps) to pair the `fetch` tool with a card viewer UI resource. When a card is fetched:

- **`content`** returns a readable text summary (card text, metadata, prices) for the model
- **`structuredContent`** sends the full card data to the UI for rendering
- The UI renders the card image, Scryfall mana symbol SVGs in the mana cost and oracle text, and card metadata
- CSP is configured to allow images from `cards.scryfall.io` and SVGs from `svgs.scryfall.io`
- Non-UI hosts receive the text fallback with all card details
