import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CitationList, WIZARDS } from "../citations.js";
import {
  childNumbers,
  getComprehensiveRules,
  normalizeRuleNumber,
  parentNumber,
  searchRules,
  type ComprehensiveRules,
  type GlossaryEntry,
  type Rule,
} from "../rules/comprehensive-rules.js";

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function header(cr: ComprehensiveRules): string {
  return `Magic: The Gathering Comprehensive Rules, effective ${cr.effectiveDate}.`;
}

function citeRule(list: CitationList, cr: ComprehensiveRules, rule: Rule): string {
  return list.cite({
    name: `Magic: The Gathering Comprehensive Rules, rule ${rule.number}`,
    url: cr.sourceUrl,
    text: rule.text,
    publisher: WIZARDS,
    "mcp:annotations": { lastModified: cr.effectiveDate },
  });
}

function citeGlossary(list: CitationList, cr: ComprehensiveRules, entry: GlossaryEntry): string {
  return list.cite({
    name: `Magic: The Gathering Comprehensive Rules, glossary: ${entry.term}`,
    url: cr.sourceUrl,
    text: entry.text,
    publisher: WIZARDS,
    "mcp:annotations": { lastModified: cr.effectiveDate },
  });
}

function formatRule(rule: Rule, marker: string): string {
  return [`${rule.number} ${rule.text} ${marker}`, ...rule.examples.map((e) => `Example: ${e}`)].join("\n");
}

function truncate(s: string, n: number): string {
  const line = s.split("\n")[0];
  return line.length > n ? line.slice(0, n - 1) + "…" : line;
}

function structuredRule(rule: Rule) {
  return { number: rule.number, text: rule.text, examples: rule.examples };
}

const GetRuleSchema = z.object({
  number: z
    .string()
    .min(1)
    .describe(
      'A rule number: "702.19b" for one subrule, "702.19" for a rule and its subrules, ' +
        '"702" for a section\'s contents, "7" for a chapter\'s contents.',
    ),
});

const SearchRulesSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Words to find in rule text and glossary terms, e.g. "trample", "mana pool empties".'),
  limit: z.number().int().min(1).max(50).default(10).describe("Most results to return. Default 10."),
});

export const registerRulesTools = (server: McpServer) => {
  server.registerTool(
    "get_rule",
    {
      title: "Get Comprehensive Rule",
      description:
        "Look up the Magic: The Gathering Comprehensive Rules by rule number. " +
        "Returns the rule text with its examples, the subrules of a rule, or the contents of a section. " +
        "Each answer states the effective date of the rules it came from and carries citation markers " +
        "to quote when answering a rules question.",
      inputSchema: GetRuleSchema,
      annotations: ANNOTATIONS,
    },
    async ({ number: input }, ctx): Promise<CallToolResult> => {
      const number = normalizeRuleNumber(input);
      if (!number) return errorResult(`"${input}" is not a rule number. Use a form like 702.19b, 702.19, 702 or 7.`);
      const cr = await getComprehensiveRules();
      const rule = cr.rules.get(number);
      if (!rule) return errorResult(`${header(cr)}\nThere is no rule ${number}. Try search_rules.`);

      const list = new CitationList();
      const parts = [header(cr)];
      const isHeading = !number.includes(".");
      if (isHeading) {
        // A chapter or section: list its contents without citing each one.
        const children = childNumbers(cr, number).map((n) => cr.rules.get(n)!);
        parts.push(
          `${rule.number}. ${rule.text} ${citeRule(list, cr, rule)}`,
          children.map((c) => `${c.number} ${truncate(c.text, 100)}`).join("\n"),
          "Call get_rule with one of these numbers for its full text.",
        );
        return list.result(server, ctx, parts.join("\n\n"), {
          effective_date: cr.effectiveDate,
          source_url: cr.sourceUrl,
          rule: structuredRule(rule),
          contents: children.map((c) => ({ number: c.number, text: truncate(c.text, 100) })),
        });
      }

      const shown: Rule[] = [];
      const parent = /[a-z]$/.test(number) ? cr.rules.get(parentNumber(number)!) : undefined;
      if (parent) shown.push(parent);
      shown.push(rule);
      if (!parent) shown.push(...childNumbers(cr, number).map((n) => cr.rules.get(n)!));
      parts.push(shown.map((r) => formatRule(r, citeRule(list, cr, r))).join("\n\n"));
      return list.result(server, ctx, parts.join("\n\n"), {
        effective_date: cr.effectiveDate,
        source_url: cr.sourceUrl,
        rules: shown.map(structuredRule),
      });
    },
  );

  server.registerTool(
    "search_rules",
    {
      title: "Search Comprehensive Rules",
      description:
        "Search the Magic: The Gathering Comprehensive Rules and their glossary for rules that contain every word of the query. " +
        "Exact glossary terms and rule headings come first. Use get_rule on a result's number for its subrules and examples. " +
        "Each answer states the effective date of the rules and carries citation markers.",
      inputSchema: SearchRulesSchema,
      annotations: ANNOTATIONS,
    },
    async ({ query, limit }, ctx): Promise<CallToolResult> => {
      const cr = await getComprehensiveRules();
      const hits = searchRules(cr, query, limit);
      if (hits.length === 0) {
        return { content: [{ type: "text", text: `${header(cr)}\nNo rule or glossary entry contains every word of "${query}".` }] };
      }
      const list = new CitationList();
      const lines = hits.map((hit) =>
        hit.kind === "glossary"
          ? `Glossary: ${hit.entry.term}\n${hit.entry.text} ${citeGlossary(list, cr, hit.entry)}`
          : `${hit.rule.number} ${hit.rule.text} ${citeRule(list, cr, hit.rule)}`,
      );
      return list.result(server, ctx, [header(cr), ...lines].join("\n\n"), {
        effective_date: cr.effectiveDate,
        source_url: cr.sourceUrl,
        results: hits.map((hit) =>
          hit.kind === "glossary"
            ? { kind: "glossary", term: hit.entry.term, text: hit.entry.text }
            : { kind: "rule", number: hit.rule.number, text: hit.rule.text },
        ),
      });
    },
  );
};
