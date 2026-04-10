#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { appendMatches, buildPlayerAliases, parseNotes, suggestedDeckStub } = require("./import-notes");

const REPO_ROOT = path.resolve(__dirname, "..");
const deckDefinitions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "data", "deck-definitions.json"), "utf8"));
const playerAliases = buildPlayerAliases(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "data", "player-aliases.json"), "utf8")));

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function parseFixture() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "data", "raw", "2026", "2026-04-06-magic.txt"), "utf8");
  return parseNotes(raw, "2026", deckDefinitions, playerAliases);
}

test("parses the 2026-04-06 raw note fixture", () => {
  const result = parseFixture();

  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.matches.length, 5);
  assert.ok(result.matches.every((match) => match.date === "2026-04-06"));
});

test("normalises Olly to Ollie", () => {
  const result = parseFixture();

  assert.strictEqual(result.matches[0].players[3].name, "Ollie");
});

test("resolves messy deck aliases", () => {
  const result = parseFixture();

  assert.strictEqual(result.matches[0].players[0].deckId, "ring-sting");
  assert.strictEqual(result.matches[0].players[1].deckId, "bad-misc");
  assert.strictEqual(result.matches[0].players[2].deckId, "big-sues");
  assert.strictEqual(result.matches[2].players[3].deckId, "revival-trance");
  assert.strictEqual(result.matches[4].players[3].deckId, "all-but-one-mana");
});

test("reports unknown decks with suggestions and a stub", () => {
  const result = parseNotes(
    `06/04 magic

Jake - weird frog thing - win
Jo - bad misc`,
    "2026",
    deckDefinitions,
    playerAliases
  );

  assert.strictEqual(result.matches.length, 0);
  assert.strictEqual(result.errors.length, 1);
  assert.match(result.errors[0], /Line: "Jake - weird frog thing - win"/);
  assert.match(result.errors[0], /Closest existing decks:/);
  assert.match(result.errors[0], /the-frog-is-loose/);
  assert.match(result.errors[0], /Suggested new deck stub:/);
  assert.match(result.errors[0], /"id": "weird-frog-thing"/);
});

test("fails conflicting deck tokens instead of guessing", () => {
  const result = parseNotes(
    `06/04 magic

Jake - bumble - bad misc - win
Jo - bad misc`,
    "2026",
    deckDefinitions,
    playerAliases
  );

  assert.strictEqual(result.matches.length, 0);
  assert.strictEqual(result.errors.length, 1);
  assert.match(result.errors[0], /Conflicting deck tokens/);
  assert.match(result.errors[0], /Peace Offering/);
  assert.match(result.errors[0], /Bad Misc/);
});

test("appendMatches skips exact duplicates", () => {
  const [match] = parseFixture().matches;
  const matchesData = { matches: [structuredClone(match)] };

  const result = appendMatches(matchesData, [structuredClone(match)]);

  assert.deepStrictEqual(result, { added: 0, skipped: 1 });
  assert.strictEqual(matchesData.matches.length, 1);
});

test("suggestedDeckStub creates a usable starter deck", () => {
  assert.deepStrictEqual(suggestedDeckStub(["weird frog thing"]), {
    id: "weird-frog-thing",
    name: "Weird Frog Thing",
    commander: "",
    active: true,
    aliases: ["weird frog thing"],
  });
});
