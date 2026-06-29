#!/usr/bin/env node

const assert = require("assert");

const {
  buildExports,
  csvCell,
  exportDecksCsv,
  exportMatchesCsv,
  exportPlayersCsv,
  parseArgs,
  toCsv,
} = require("./export-data");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const sampleMatches = {
  matches: [
    {
      id: "2026-04-06-001",
      date: "2026-04-06",
      players: [
        { name: "Jo", deckId: "bad-misc" },
        { name: "Liam", deckId: "big-sues" },
      ],
      winner: "Jo",
      notes: "Big comeback, very loud.",
      tags: ["planechase", "precon-night"],
    },
    {
      id: "2026-04-06-002",
      date: "2026-04-06",
      players: [
        { name: "Jo", deckId: "bad-misc" },
        { name: "Liam", deckId: "big-sues" },
      ],
      winner: "Liam",
    },
  ],
};

const sampleDecks = {
  decks: [
    {
      id: "bad-misc",
      name: "Bad Misc",
      commander: "Ragost, Deft Gastronaut",
      owner: "Jo",
      active: true,
    },
    {
      id: "big-sues",
      name: "Big Sue's",
      commander: ["Susan Foreman", "The Twelfth Doctor"],
      owner: "Liam",
      active: true,
    },
  ],
};

test("csvCell escapes commas and quotes", () => {
  assert.strictEqual(csvCell("simple"), "simple");
  assert.strictEqual(csvCell("Big comeback, very loud."), "\"Big comeback, very loud.\"");
  assert.strictEqual(csvCell("quote \"here\""), "\"quote \"\"here\"\"\"");
  assert.strictEqual(csvCell(["a", "b"]), "a; b");
});

test("toCsv writes headers and rows", () => {
  const csv = toCsv([{ a: "one", b: "two" }], [
    { header: "A", value: (row) => row.a },
    { header: "B", value: (row) => row.b },
  ]);

  assert.strictEqual(csv, "A,B\none,two\n");
});

test("parseArgs accepts csv exports and rejects unsupported options", () => {
  assert.deepStrictEqual(parseArgs(["node", "script", "--format", "csv", "--year", "2026", "--target", "matches"]), {
    format: "csv",
    year: "2026",
    target: "matches",
    out: "",
    help: false,
  });

  assert.throws(() => parseArgs(["node", "script", "--format", "json"]), /Only --format csv/);
  assert.throws(() => parseArgs(["node", "script", "--target", "nope"]), /--target must be one of/);
});

test("exportMatchesCsv includes ids, decks, notes, and tags", () => {
  const csv = exportMatchesCsv(sampleMatches, sampleDecks);

  assert.match(csv, /^id,date,winner,players,deckIds,deckNames,notes,tags\n/);
  assert.match(csv, /2026-04-06-001,2026-04-06,Jo,Jo; Liam,bad-misc; big-sues,Bad Misc; Big Sue's,"Big comeback, very loud.",planechase; precon-night/);
});

test("exportPlayersCsv totals player stats", () => {
  const csv = exportPlayersCsv(sampleMatches);

  assert.match(csv, /^player,wins,matchesPlayed,winRate\n/);
  assert.match(csv, /Jo,1,2,50.00%/);
  assert.match(csv, /Liam,1,2,50.00%/);
});

test("exportDecksCsv totals deck stats with definitions", () => {
  const csv = exportDecksCsv(sampleMatches, sampleDecks);

  assert.match(csv, /^deckId,deckName,commanders,owner,active,wins,matchesPlayed,winRate\n/);
  assert.match(csv, /bad-misc,Bad Misc,"Ragost, Deft Gastronaut",Jo,true,1,2,50.00%/);
  assert.match(csv, /big-sues,Big Sue's,Susan Foreman; The Twelfth Doctor,Liam,true,1,2,50.00%/);
});

test("buildExports returns requested target keys", () => {
  const exports = buildExports({ year: "2026", target: "players" });

  assert.deepStrictEqual(Object.keys(exports), ["players"]);
  assert.match(exports.players, /^player,wins,matchesPlayed,winRate\n/);
});
