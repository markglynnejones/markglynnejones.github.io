#!/usr/bin/env node

const assert = require("assert");

const {
  buildPlayerAliases,
  findDuplicateMatches,
  matchSignature,
  parseDateFromLine,
  parseNotes,
  resolveDeck,
  splitIntoBlocks,
} = require("./import-parser");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const deckDefinitions = {
  decks: [
    {
      id: "bad-misc",
      name: "Bad Misc",
      commander: "Ragost, Deft Gastronaut",
      aliases: ["bad"],
      active: true,
    },
    {
      id: "big-sues",
      name: "Big Sue's",
      commander: ["Susan Foreman", "The Twelfth Doctor"],
      active: true,
    },
  ],
};

const playerDefinitions = {
  players: [
    { id: "jo", name: "Jo", active: true },
    { id: "liam", name: "Liam", active: true },
  ],
};

test("parseDateFromLine handles day/month notes with fallback year", () => {
  assert.strictEqual(parseDateFromLine("04/06 magic", "2026"), "2026-06-04");
  assert.strictEqual(parseDateFromLine("04/06/27 magic", "2026"), "2027-06-04");
  assert.strictEqual(parseDateFromLine("31/02 magic", "2026"), null);
});

test("splitIntoBlocks separates dashed note sections", () => {
  assert.deepStrictEqual(splitIntoBlocks("04/06\nJo - bad - win\n---\nLiam - big sues - win\nJo - bad"), [
    ["04/06", "Jo - bad - win"],
    ["Liam - big sues - win", "Jo - bad"],
  ]);
});

test("resolveDeck resolves aliases and reports unresolved decks", () => {
  assert.deepStrictEqual(resolveDeck(["bad"], deckDefinitions), { deckId: "bad-misc", matched: "bad" });
  assert.match(resolveDeck(["mystery"], deckDefinitions).error, /Couldn't resolve deck/);
});

test("parseNotes returns preview-safe matches without file IO", () => {
  const playerAliases = buildPlayerAliases({ schemaVersion: 1, jon: "Jo" });
  const result = parseNotes(
    `04/06 magic

Jon - bad - win
Liam - big sues`,
    "2026",
    deckDefinitions,
    playerAliases,
    playerDefinitions
  );

  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.matches.length, 1);
  assert.deepStrictEqual(result.matches[0], {
    date: "2026-06-04",
    players: [
      { playerId: "jo", name: "Jo", deckId: "bad-misc" },
      { playerId: "liam", name: "Liam", deckId: "big-sues" },
    ],
    winner: "Jo",
    winnerId: "jo",
  });
});

test("findDuplicateMatches uses the importer match signature", () => {
  const existing = [
    {
      id: "2026-06-04-001",
      date: "2026-06-04",
      players: [
        { playerId: "liam", name: "Liam", deckId: "big-sues" },
        { playerId: "jo", name: "Jo", deckId: "bad-misc" },
      ],
      winner: "Jo",
      winnerId: "jo",
    },
  ];
  const preview = [
    {
      date: "2026-06-04",
      players: [
        { playerId: "jo", name: "Jo", deckId: "bad-misc" },
        { playerId: "liam", name: "Liam", deckId: "big-sues" },
      ],
      winner: "Jo",
      winnerId: "jo",
    },
  ];

  assert.strictEqual(matchSignature(existing[0]), matchSignature(preview[0]));
  assert.deepStrictEqual(findDuplicateMatches(existing, preview), [{ index: 0, match: preview[0], existing: existing[0] }]);
});
