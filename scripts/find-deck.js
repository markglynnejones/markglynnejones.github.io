#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const { resolveDeck } = require("./import-notes");

const REPO_ROOT = path.resolve(__dirname, "..");
const DECKS_PATH = path.join(REPO_ROOT, "data", "deck-definitions.json");

function usage() {
  console.log("Usage: npm run decks:find -- <deck alias or commander>");
}

function readDeckDefinitions(filePath = DECKS_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function commanderText(deck) {
  return (Array.isArray(deck.commander) ? deck.commander : [deck.commander]).filter(Boolean).join(" / ");
}

function findDeckQuery(query, deckDefinitions) {
  const result = resolveDeck([query], deckDefinitions);
  if (result.error) return { error: result.error };

  const deck = (deckDefinitions.decks || []).find((entry) => entry.id === result.deckId);
  if (!deck) return { error: `Resolved "${query}" to missing deck id "${result.deckId}".` };

  return { deck, matched: result.matched };
}

function printDeckResult(query, result) {
  if (result.error) {
    console.log(result.error);
    return;
  }

  const commander = commanderText(result.deck);
  console.log(`${query} -> ${result.deck.name} [${result.deck.id}]`);
  if (commander) console.log(`Commander: ${commander}`);
  console.log(`Active: ${result.deck.active ? "Yes" : "No"}`);
}

function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query || query === "-h" || query === "--help") {
    usage();
    process.exit(query ? 0 : 1);
  }

  const deckDefinitions = readDeckDefinitions();
  const result = findDeckQuery(query, deckDefinitions);
  printDeckResult(query, result);

  if (result.error) process.exit(1);
}

module.exports = {
  findDeckQuery,
  printDeckResult,
};

if (require.main === module) {
  main();
}
