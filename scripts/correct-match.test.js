#!/usr/bin/env node

const assert = require("assert");
const { applyCorrections, parseArgs, tagList } = require("./correct-match");

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
  schemaVersion: 1,
  matches: [
    {
      id: "2026-06-14-003",
      sessionId: "session-2026-06-14-001",
      date: "2026-06-14",
      players: [
        { playerId: "mark", name: "Mark", deckId: "quintorius" },
        { playerId: "liam", name: "Liam", deckId: "ragost" },
      ],
      winner: "Liam",
      winnerId: "liam",
    },
  ],
};

test("parseArgs requires a match id and a correction", () => {
  assert.throws(() => parseArgs(["node", "script"]), /--id is required/);
  assert.throws(() => parseArgs(["node", "script", "--id", "2026-06-14-003"]), /At least one correction/);
  assert.throws(() => parseArgs(["node", "script", "--id", "2026-06-14-003", "--year", "2025", "--set", "winnerId=mark"]), /--year must match/);
});

test("parseArgs accepts supported corrections", () => {
  assert.deepStrictEqual(
    parseArgs([
      "node",
      "script",
      "--id",
      "2026-06-14-003",
      "--set",
      "winnerId=mark",
      "--set",
      "tags=precon-night,planechase",
      "--player-deck",
      "liam=master",
      "--clear",
      "notes",
    ]),
    {
      id: "2026-06-14-003",
      year: "2026",
      sets: [
        { key: "winnerId", value: "mark" },
        { key: "tags", value: "precon-night,planechase" },
      ],
      clears: ["notes"],
      playerDecks: [{ key: "liam", value: "master" }],
      write: false,
      help: false,
    }
  );
});

test("tagList normalises comma separated input by trimming blanks", () => {
  assert.deepStrictEqual(tagList(" precon-night, planechase ,, "), ["precon-night", "planechase"]);
});

test("applyCorrections updates winner, tags, notes, and player deck", () => {
  const result = applyCorrections(sampleMatches, {
    id: "2026-06-14-003",
    year: "2026",
    sets: [
      { key: "winnerId", value: "mark" },
      { key: "notes", value: "Corrected from paper notes." },
      { key: "tags", value: "paper-fix,reviewed" },
    ],
    clears: [],
    playerDecks: [{ key: "liam", value: "master" }],
  });

  const match = result.data.matches[0];
  assert.strictEqual(match.winnerId, "mark");
  assert.strictEqual(match.winner, "Mark");
  assert.strictEqual(match.players[1].deckId, "master");
  assert.strictEqual(match.notes, "Corrected from paper notes.");
  assert.deepStrictEqual(match.tags, ["paper-fix", "reviewed"]);
  assert.deepStrictEqual(result.changes.map((change) => change.field), [
    "players.liam.deckId",
    "winnerId",
    "winner",
    "notes",
    "tags",
  ]);
  assert.strictEqual(sampleMatches.matches[0].winnerId, "liam");
});

test("applyCorrections can clear optional fields", () => {
  const result = applyCorrections(
    {
      schemaVersion: 1,
      matches: [{ ...sampleMatches.matches[0], notes: "Remove me", tags: ["review"] }],
    },
    {
      id: "2026-06-14-003",
      year: "2026",
      sets: [],
      clears: ["notes", "tags"],
      playerDecks: [],
    }
  );

  assert.strictEqual(result.data.matches[0].notes, undefined);
  assert.strictEqual(result.data.matches[0].tags, undefined);
});

test("applyCorrections rejects players not in the match", () => {
  assert.throws(
    () =>
      applyCorrections(sampleMatches, {
        id: "2026-06-14-003",
        year: "2026",
        sets: [{ key: "winnerId", value: "jo" }],
        clears: [],
        playerDecks: [],
      }),
    /does not include winnerId/
  );
});
