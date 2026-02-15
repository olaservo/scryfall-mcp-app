const BASE_URL = "https://api.scryfall.com";
const USER_AGENT = "scryfall-mcp-server/1.0 (+https://github.com/olaservo/scryfall-mcp-app)";
const MIN_DELAY_MS = 120; // ~8-9 rps (Scryfall asks for 50-100ms & <10 rps)

let lastCall = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCall = Date.now();
}

function headers(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
}

export interface ScryfallCard {
  id: string;
  name: string;
  scryfall_uri: string;
  set: string;
  set_name: string;
  collector_number: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  colors?: string[];
  rarity: string;
  released_at: string;
  prices: Record<string, string | null>;
  image_uris?: Record<string, string>;
  card_faces?: Array<{
    name?: string;
    type_line?: string;
    mana_cost?: string;
    oracle_text?: string;
    image_uris?: Record<string, string>;
  }>;
  uri: string;
}

export interface ScryfallSearchResponse {
  data: ScryfallCard[];
  total_cards: number;
  has_more: boolean;
}

export interface ScryfallError {
  status: number;
  body: string;
}

export function isScryfallError(
  result: ScryfallSearchResponse | ScryfallCard | ScryfallError,
): result is ScryfallError {
  return "status" in result && "body" in result;
}

export async function searchCards(
  query: string,
): Promise<ScryfallSearchResponse | ScryfallError> {
  await rateLimit();
  const url = new URL(`${BASE_URL}/cards/search`);
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    return { status: res.status, body: await res.text() };
  }
  return (await res.json()) as ScryfallSearchResponse;
}

export async function fetchCard(
  id: string,
): Promise<ScryfallCard | ScryfallError> {
  await rateLimit();
  const url = `${BASE_URL}/cards/${encodeURIComponent(id)}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    return { status: res.status, body: await res.text() };
  }
  return (await res.json()) as ScryfallCard;
}
