import { USER_AGENT } from "../scryfall-api.js";

// Wizards links the current Comprehensive Rules text file from this page.
const RULES_PAGE = "https://magic.wizards.com/en/rules";
const REFRESH_MS = 24 * 60 * 60 * 1000;

export interface Rule {
  /** "1" for a chapter, "702" for a section, "702.19" or "702.19b" for a rule. */
  number: string;
  /** The rule text as printed, without its number. Headings hold their title. */
  text: string;
  examples: string[];
}

export interface GlossaryEntry {
  term: string;
  text: string;
}

export interface ComprehensiveRules {
  /** ISO date from the "These rules are effective as of ..." line. */
  effectiveDate: string;
  sourceUrl: string;
  rules: Map<string, Rule>;
  /** Rule numbers in document order. */
  order: string[];
  glossary: GlossaryEntry[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const CHAPTER = /^(\d)\. (.+)$/;
const SECTION = /^(\d{3})\. (.+)$/;
const RULE = /^(\d{3}\.\d+[a-z]*)\.? (.+)$/;

function effectiveDate(lines: string[]): string {
  for (const line of lines.slice(0, 10)) {
    const m = /effective as of (\w+) (\d{1,2}), (\d{4})/.exec(line);
    const month = m && MONTHS.indexOf(m[1].toLowerCase());
    if (m && month !== null && month >= 0) {
      return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
  }
  throw new Error("Comprehensive Rules: no effective date in the file header");
}

/** Parses the text file Wizards publishes. */
export function parseComprehensiveRules(raw: string, sourceUrl: string): ComprehensiveRules {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trimEnd());

  // "Glossary" and "Credits" each appear twice: once in the contents, once as a heading.
  const glossaryAt = lines.lastIndexOf("Glossary");
  const creditsAt = lines.lastIndexOf("Credits");
  const contentsCreditsAt = lines.indexOf("Credits");
  const bodyAt = lines.findIndex((l, i) => i > contentsCreditsAt && CHAPTER.test(l));
  if (glossaryAt < 0 || creditsAt < glossaryAt || bodyAt < 0 || bodyAt > glossaryAt) {
    throw new Error("Comprehensive Rules: unexpected file layout");
  }

  const rules = new Map<string, Rule>();
  const order: string[] = [];
  let last: Rule | undefined;
  for (const line of lines.slice(bodyAt, glossaryAt)) {
    if (line.trim() === "") continue;
    const m = CHAPTER.exec(line) ?? SECTION.exec(line) ?? RULE.exec(line);
    if (m) {
      last = { number: m[1], text: m[2], examples: [] };
      rules.set(last.number, last);
      order.push(last.number);
    } else if (!last) {
      continue;
    } else if (line.startsWith("Example: ")) {
      last.examples.push(line.slice("Example: ".length));
    } else {
      // An indented line continues the rule above it.
      last.text += "\n" + line;
    }
  }

  const glossary: GlossaryEntry[] = [];
  let entry: string[] = [];
  for (const line of [...lines.slice(glossaryAt + 1, creditsAt), ""]) {
    if (line.trim() !== "") {
      entry.push(line);
    } else if (entry.length > 0) {
      glossary.push({ term: entry[0], text: entry.slice(1).join("\n") });
      entry = [];
    }
  }

  return { effectiveDate: effectiveDate(lines), sourceUrl, rules, order, glossary };
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "*/*" } });
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`);
  return res;
}

/** The URL of the current rules text file, or MTG_CR_URL if set. */
async function discoverUrl(): Promise<string> {
  if (process.env.MTG_CR_URL) return process.env.MTG_CR_URL;
  const html = await (await get(RULES_PAGE)).text();
  const m = /https:\/\/media\.wizards\.com\/[^"'<>]*?MagicCompRules[^"'<>]*?\.txt/i.exec(html);
  if (!m) throw new Error(`No Comprehensive Rules .txt link on ${RULES_PAGE}`);
  // The page links the file with a literal space in its name.
  return new URL(m[0]).href;
}

function decode(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Older releases were Windows-1252.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

let cached: { cr: ComprehensiveRules; checkedAt: number } | undefined;
let loading: Promise<ComprehensiveRules> | undefined;

async function load(): Promise<ComprehensiveRules> {
  const url = await discoverUrl();
  if (cached && cached.cr.sourceUrl === url) return cached.cr;
  const res = await get(url);
  const cr = parseComprehensiveRules(decode(await res.arrayBuffer()), url);
  if (cr.order.length < 1000 || cr.glossary.length < 100) {
    throw new Error(`Comprehensive Rules: parsed only ${cr.order.length} rules and ${cr.glossary.length} glossary entries from ${url}`);
  }
  return cr;
}

/**
 * The current Comprehensive Rules. Checks the rules page for a new release once
 * a day, and keeps serving the loaded copy if that check fails.
 */
export function getComprehensiveRules(): Promise<ComprehensiveRules> {
  if (cached && Date.now() - cached.checkedAt < REFRESH_MS) return Promise.resolve(cached.cr);
  loading ??= load()
    .catch((err) => {
      if (!cached) throw err;
      console.error("Comprehensive Rules refresh failed, keeping the loaded copy:", err);
      return cached.cr;
    })
    .then((cr) => {
      cached = { cr, checkedAt: Date.now() };
      return cr;
    })
    .finally(() => {
      loading = undefined;
    });
  return loading;
}

const RULE_NUMBER = /^(\d|\d{3}|\d{3}\.\d+[a-z]*)$/;

/** "Rule 702.19b." becomes "702.19b". Returns undefined if it is not a rule number. */
export function normalizeRuleNumber(input: string): string | undefined {
  const n = input.trim().toLowerCase().replace(/^(cr|rule)\s*/, "").replace(/\.$/, "");
  return RULE_NUMBER.test(n) ? n : undefined;
}

/** The parent of "702.19b" is "702.19", of "702.19" is "702", of "702" is "7". */
export function parentNumber(number: string): string | undefined {
  if (/[a-z]$/.test(number)) return number.replace(/[a-z]+$/, "");
  if (number.includes(".")) return number.split(".")[0];
  if (number.length === 3) return number[0];
  return undefined;
}

/** Rules one level below `number`, in document order. */
export function childNumbers(cr: ComprehensiveRules, number: string): string[] {
  return cr.order.filter((n) => parentNumber(n) === number);
}

/** Lowercase, straight quotes, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchHit =
  | { kind: "glossary"; entry: GlossaryEntry }
  | { kind: "rule"; rule: Rule };

/**
 * Glossary terms and rules that contain every word of the query. Exact glossary
 * terms and headings come first, then text with the whole phrase, then the rest,
 * each in document order.
 */
export function searchRules(cr: ComprehensiveRules, query: string, limit: number): SearchHit[] {
  const phrase = normalizeText(query);
  const words = phrase.split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const scored: Array<{ hit: SearchHit; score: number; index: number }> = [];

  cr.glossary.forEach((entry, index) => {
    const term = normalizeText(entry.term);
    const body = term + " " + normalizeText(entry.text);
    if (!words.every((w) => body.includes(w))) return;
    const score = term === phrase ? 4 : term.includes(phrase) ? 3 : body.includes(phrase) ? 2 : 1;
    scored.push({ hit: { kind: "glossary", entry }, score, index });
  });

  cr.order.forEach((number, i) => {
    const rule = cr.rules.get(number)!;
    const text = normalizeText(rule.text);
    if (!words.every((w) => text.includes(w))) return;
    const heading = !/[a-z]$/.test(number) && rule.text.length < 60;
    const score = heading && text === phrase ? 4 : text.includes(phrase) ? 2 : 1;
    scored.push({ hit: { kind: "rule", rule }, score, index: cr.glossary.length + i });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.hit);
}
