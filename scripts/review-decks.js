#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DECKS_PATH = path.join(REPO_ROOT, "data", "deck-definitions.json");

function commanderText(deck) {
  return (Array.isArray(deck.commander) ? deck.commander : [deck.commander]).filter(Boolean).join(" / ");
}

function decksNeedingReview(deckDefinitions) {
  return (deckDefinitions?.decks || []).filter((deck) => deck.needsReview === true);
}

function printReviewDecks(decks) {
  if (!decks.length) {
    console.log("No decks need review.");
    return;
  }

  console.log(`${decks.length} deck(s) need review:`);
  for (const deck of decks) {
    console.log(`- ${deck.name} [${deck.id}]`);
    const commander = commanderText(deck);
    if (commander) console.log(`  Commander: ${commander}`);
    if (deck.owner) console.log(`  Owner: ${deck.owner}`);
    if (deck.reviewNote) console.log(`  Note: ${deck.reviewNote}`);
  }
}

function main() {
  const deckDefinitions = JSON.parse(fs.readFileSync(DECKS_PATH, "utf8"));
  printReviewDecks(decksNeedingReview(deckDefinitions));
}

module.exports = {
  decksNeedingReview,
  printReviewDecks,
};

if (require.main === module) {
  main();
}
