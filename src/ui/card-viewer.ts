import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";

// Types matching structuredContent from the fetch tool
interface CardFace {
  name?: string;
  type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  image_uris?: Record<string, string>;
}

interface CardData {
  name: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  set_name: string;
  set: string;
  rarity: string;
  collector_number: string;
  released_at: string;
  colors?: string[];
  prices: Record<string, string | null>;
  scryfall_uri: string;
  image_uris?: Record<string, string>;
  card_faces?: CardFace[];
}

// DOM refs
const loadingEl = document.getElementById("loading")!;
const errorEl = document.getElementById("error")!;
const cardEl = document.getElementById("card")!;

// State
let currentCardUri: string | null = null;

// --- Rendering ---

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SYMBOL_RE = /\{([^}]+)\}/g;
const SPECIAL_SYMBOLS: Record<string, string> = {
  "∞": "INFINITY",
  "½": "HALF",
};

function symbolToFilename(symbol: string): string {
  if (SPECIAL_SYMBOLS[symbol]) return SPECIAL_SYMBOLS[symbol];
  return symbol.replace(/\//g, "");
}

function renderManaSymbols(text: string): string {
  return text.replace(SYMBOL_RE, (_, symbol: string) => {
    const filename = symbolToFilename(symbol);
    return `<img class="mana-symbol" src="https://svgs.scryfall.io/card-symbols/${encodeURIComponent(filename)}.svg" alt="{${escapeHtml(symbol)}}" title="{${escapeHtml(symbol)}}" />`;
  });
}

function renderOracleText(text: string): string {
  return renderManaSymbols(escapeHtml(text));
}

function showLoading() {
  loadingEl.style.display = "flex";
  errorEl.style.display = "none";
  cardEl.style.display = "none";
}

function showError(message: string) {
  errorEl.textContent = message;
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  cardEl.style.display = "none";
}

function showCard(card: CardData) {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  cardEl.style.display = "flex";
  cardEl.innerHTML = renderCard(card);
}

function getImageUri(uris: Record<string, string> | undefined): string | null {
  if (!uris) return null;
  return uris.normal || uris.large || uris.border_crop || uris.png || null;
}

function renderCardImage(
  imageUris: Record<string, string> | undefined,
  alt: string,
  label?: string,
): string {
  const uri = getImageUri(imageUris);
  if (!uri) return "";
  let html = `<img class="card-image" src="${escapeHtml(uri)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  if (label) {
    html += `<div class="card-image-label">${escapeHtml(label)}</div>`;
  }
  return html;
}

function renderPrices(prices: Record<string, string | null>): string {
  const entries = Object.entries(prices).filter(
    ([, v]) => v != null && v !== "",
  );
  if (entries.length === 0) return "";

  const tags = entries
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ");
      return `<div class="price-tag"><span class="price-label">${escapeHtml(label)}</span>$${escapeHtml(value!)}</div>`;
    })
    .join("");

  return `<div class="card-prices">${tags}</div>`;
}

function renderFaceDetails(
  face: CardFace,
  index: number,
  total: number,
): string {
  const separator = index > 0 ? '<hr class="face-separator" />' : "";
  const faceLabel = total > 1 ? ` (Face ${index + 1})` : "";

  return `
    ${separator}
    <h2 class="card-name">${escapeHtml(face.name || "Unknown")}${faceLabel}</h2>
    <p class="card-type">${escapeHtml(face.type_line || "")}</p>
    ${face.mana_cost ? `<p class="card-mana">${renderManaSymbols(face.mana_cost)}</p>` : ""}
    ${face.oracle_text ? `<div class="card-oracle">${renderOracleText(face.oracle_text)}</div>` : ""}
  `;
}

function renderCard(card: CardData): string {
  const isDoubleFaced = card.card_faces && card.card_faces.length > 1;

  // Images
  let imagesHtml = "";
  if (isDoubleFaced && card.card_faces) {
    imagesHtml = card.card_faces
      .map((face, i) =>
        renderCardImage(
          face.image_uris,
          face.name || card.name,
          face.name || `Face ${i + 1}`,
        ),
      )
      .join("");
  } else {
    const imageUris = card.image_uris || card.card_faces?.[0]?.image_uris;
    imagesHtml = renderCardImage(imageUris, card.name);
  }

  // Details
  let detailsHtml = "";
  if (isDoubleFaced && card.card_faces) {
    detailsHtml = card.card_faces
      .map((face, i) =>
        renderFaceDetails(face, i, card.card_faces!.length),
      )
      .join("");
  } else {
    detailsHtml = `
      <h2 class="card-name">${escapeHtml(card.name)}</h2>
      <p class="card-type">${escapeHtml(card.type_line)}</p>
      ${card.mana_cost ? `<p class="card-mana">${renderManaSymbols(card.mana_cost)}</p>` : ""}
      ${card.oracle_text ? `<div class="card-oracle">${renderOracleText(card.oracle_text)}</div>` : ""}
    `;
  }

  // Metadata
  const metaHtml = `
    <dl class="card-meta">
      <dt>Set</dt><dd>${escapeHtml(card.set_name)} (${escapeHtml(card.set.toUpperCase())})</dd>
      <dt>Number</dt><dd>${escapeHtml(card.collector_number)}</dd>
      <dt>Rarity</dt><dd>${capitalize(card.rarity)}</dd>
      <dt>Released</dt><dd>${escapeHtml(card.released_at)}</dd>
      ${card.colors && card.colors.length > 0 ? `<dt>Colors</dt><dd>${escapeHtml(card.colors.join(", "))}</dd>` : ""}
    </dl>
  `;

  return `
    <div class="card-images">${imagesHtml}</div>
    <div class="card-details">
      ${detailsHtml}
      ${metaHtml}
      ${renderPrices(card.prices)}
      <a class="card-link" id="scryfall-link" href="#">View on Scryfall</a>
    </div>
  `;
}

// --- MCP App Integration ---

const app = new App({ name: "Scryfall Card Viewer", version: "1.0.0" });

app.onteardown = async () => {
  return {};
};

app.ontoolinput = () => {
  showLoading();
};

app.ontoolresult = (result) => {
  if (result.isError) {
    const text =
      result.content?.find(
        (c: { type: string }) => c.type === "text",
      ) as { text?: string } | undefined;
    showError(text?.text || "Unknown error");
    return;
  }

  const card = result.structuredContent as CardData | undefined;
  if (!card || !card.name) {
    showError("Invalid card data received");
    return;
  }

  currentCardUri = card.scryfall_uri;
  showCard(card);

  // Wire up the Scryfall link
  const link = document.getElementById("scryfall-link");
  if (link && currentCardUri) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentCardUri) {
        app.openLink({ url: currentCardUri });
      }
    });
  }
};

app.ontoolcancelled = () => {
  showError("Tool call was cancelled");
};

app.onerror = (err) => {
  console.error("[Card Viewer]", err);
  showError(err instanceof Error ? err.message : String(err));
};

function handleHostContextChanged(ctx: {
  theme?: string;
  styles?: {
    variables?: Record<string, string>;
    css?: { fonts?: string };
  };
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
}) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
}

app.onhostcontextchanged = handleHostContextChanged;

// Connect
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
