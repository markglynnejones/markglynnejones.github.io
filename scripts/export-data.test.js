#!/usr/bin/env node

const assert = require("assert");

const {
  buildBackupJson,
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
        sessionId: "session-2026-04-06-001",
      date: "2026-04-06",
      players: [
        { playerId: "jo", name: "Jo", deckId: "bad-misc" },
        { playerId: "liam", name: "Liam", deckId: "big-sues" },
      ],
      winner: "Jo",
      winnerId: "jo",
      notes: "Big comeback, very loud.",
      tags: ["planechase", "precon-night"],
    },
    {
      id: "2026-04-06-002",
        sessionId: "session-2026-04-06-001",
      date: "2026-04-06",
      players: [
        { playerId: "jo", name: "Jo", deckId: "bad-misc" },
        { playerId: "liam", name: "Liam", deckId: "big-sues" },
      ],
      winner: "Liam",
      winnerId: "liam",
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

  assert.deepStrictEqual(parseArgs(["node", "script", "--format", "json", "--year", "2026", "--target", "backup"]), {
    format: "json",
    year: "2026",
    target: "backup",
    out: "",
    help: false,
  });

  assert.throws(() => parseArgs(["node", "script", "--format", "pdf"]), /--format must be one of/);
  assert.throws(() => parseArgs(["node", "script", "--target", "nope"]), /--target must be one of/);
  assert.throws(() => parseArgs(["node", "script", "--format", "csv", "--target", "backup"]), /--target must be one of for csv/);
});

test("exportMatchesCsv includes ids, decks, notes, and tags", () => {
  const csv = exportMatchesCsv(sampleMatches, sampleDecks);

  assert.match(csv, /^id,sessionId,date,winnerId,winner,playerIds,players,deckIds,deckNames,notes,tags\n/);
  assert.match(csv, /2026-04-06-001,session-2026-04-06-001,2026-04-06,jo,Jo,jo; liam,Jo; Liam/);
  assert.match(
    csv,
    /2026-04-06-001,session-2026-04-06-001,2026-04-06,jo,Jo,jo; liam,Jo; Liam,bad-misc; big-sues,Bad Misc; Big Sue's,"Big comeback, very loud.",planechase; precon-night/
  );
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

test("buildExports returns JSON backup exports", () => {
  const exports = buildExports({ format: "json", year: "2026", target: "backup" });
  const backup = JSON.parse(exports.backup);

  assert.deepStrictEqual(Object.keys(exports), ["backup"]);
  assert.strictEqual(backup.schemaVersion, 1);
  assert.strictEqual(backup.year, "2026");
  assert.ok(backup.files["matches-2026.json"]);
  assert.ok(backup.files["special-matches-2026.json"]);
  assert.ok(backup.files["deck-definitions.json"]);
  assert.ok(backup.files["player-definitions.json"]);
  assert.ok(backup.files["player-aliases.json"]);
});

test("buildExports returns individual JSON targets", () => {
  const exports = buildExports({ format: "json", year: "2026", target: "special" });
  const special = JSON.parse(exports.special);

  assert.deepStrictEqual(Object.keys(exports), ["special"]);
  assert.strictEqual(special.schemaVersion, 1);
  assert.ok(Array.isArray(special.specialMatches));
});

test("buildBackupJson includes deterministic canonical files", () => {
  const backup = buildBackupJson("2026");

  assert.deepStrictEqual(Object.keys(backup), ["schemaVersion", "year", "files"]);
  assert.deepStrictEqual(Object.keys(backup.files), [
    "matches-2026.json",
    "special-matches-2026.json",
    "deck-definitions.json",
    "player-definitions.json",
    "player-aliases.json",
    "players-2025.json",
    "decks-2025.json",
    "combinations.json",
    "doubles.json",
  ]);
});
