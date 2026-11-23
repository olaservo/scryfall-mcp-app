import assert from "node:assert/strict";
import { test } from "node:test";
import {
  childNumbers,
  normalizeRuleNumber,
  parentNumber,
  parseComprehensiveRules,
  searchRules,
} from "../src/rules/comprehensive-rules.js";

// The layout of the published file, cut down: BOM, CRLF, a contents list that
// repeats the headings, an indented continuation line, and a glossary.
const FIXTURE = [
  "﻿Magic: The Gathering Comprehensive Rules",
  "",
  "These rules are effective as of November 6, 2026.",
  "",
  "Contents",
  "",
  "1. Game Concepts",
  "100. General",
  "",
  "7. Additional Rules",
  "702. Keyword Abilities",
  "",
  "Glossary",
  "",
  "Credits",
  "",
  "1. Game Concepts",
  "",
  "100. General",
  "",
  "100.1. These Magic rules apply to any Magic game with two or more players.",
  "",
  "100.1a A two-player game is a game that begins with only two players.",
  "     Cards printed long ago didn’t say this.",
  "",
  "7. Additional Rules",
  "",
  "702. Keyword Abilities",
  "",
  "702.19. Trample",
  "",
  "702.19a Trample is a static ability that modifies the rules for assigning an attacking creature’s combat damage.",
  "",
  "702.19b The controller of an attacking creature with trample first assigns damage to the creature(s) blocking it.",
  "Example: A 6/6 green creature with trample is blocked by a 2/2 creature.",
  "",
  "Glossary",
  "",
  "Trample",
  "A keyword ability that modifies how combat damage is assigned. See rule 702.19, “Trample.”",
  "",
  "Zone",
  "A place where objects can be during a game.",
  "",
  "Credits",
  "",
  "Thanks to everyone.",
].join("\r\n");

const URL = "https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt";
const cr = parseComprehensiveRules(FIXTURE, URL);

test("reads the effective date", () => {
  assert.equal(cr.effectiveDate, "2026-11-06");
  assert.equal(cr.sourceUrl, URL);
});

test("parses the body, not the contents", () => {
  assert.deepEqual(cr.order, ["1", "100", "100.1", "100.1a", "7", "702", "702.19", "702.19a", "702.19b"]);
  assert.equal(cr.rules.get("702.19")!.text, "Trample");
  assert.equal(cr.rules.get("100.1")!.text, "These Magic rules apply to any Magic game with two or more players.");
});

test("keeps examples and continuation lines with their rule", () => {
  assert.deepEqual(cr.rules.get("702.19b")!.examples, ["A 6/6 green creature with trample is blocked by a 2/2 creature."]);
  assert.equal(
    cr.rules.get("100.1a")!.text,
    "A two-player game is a game that begins with only two players.\n     Cards printed long ago didn’t say this.",
  );
});

test("parses the glossary", () => {
  assert.deepEqual(cr.glossary.map((g) => g.term), ["Trample", "Zone"]);
});

test("normalizes rule numbers", () => {
  assert.equal(normalizeRuleNumber("Rule 702.19B."), "702.19b");
  assert.equal(normalizeRuleNumber("CR 702"), "702");
  assert.equal(normalizeRuleNumber("trample"), undefined);
});

test("walks the rule tree", () => {
  assert.equal(parentNumber("702.19b"), "702.19");
  assert.equal(parentNumber("702.19"), "702");
  assert.equal(parentNumber("702"), "7");
  assert.deepEqual(childNumbers(cr, "702.19"), ["702.19a", "702.19b"]);
  assert.deepEqual(childNumbers(cr, "7"), ["702"]);
});

test("search puts the glossary term and heading first and ignores curly quotes", () => {
  const hits = searchRules(cr, "trample", 10);
  assert.equal(hits[0].kind, "glossary");
  assert.equal(hits[1].kind === "rule" && hits[1].rule.number, "702.19");
  assert.equal(searchRules(cr, "creature's combat", 10).length, 1);
  assert.equal(searchRules(cr, "banding", 10).length, 0);
});
