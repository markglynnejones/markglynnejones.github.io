#!/usr/bin/env node

const assert = require("assert");

const {
  buildMonthlyWins2026,
  buildLatestSessionSummary,
  buildPlayerDeckStats2026,
  buildStatsFromMatches,
  decks2026RowsFromStats,
  latestMatchDate,
  mergeDecksOverall,
  mergePlayersOverall,
  pctText,
  safeISODate,
  winRate,
} = require("./stats");

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
      date: "2026-04-06",
      players: [
        { name: "Jake", deckId: "ring-sting" },
        { name: "Jo", deckId: "bad-misc" },
        { name: "Liam", deckId: "big-sues" },
      ],
      winner: "Jo",
    },
    {
      date: "2026-05-01",
      players: [
        { name: "Jake", deckId: "ring-sting" },
        { name: "Jo", deckId: "bad-misc" },
        { name: "Mark", deckId: "ghalta" },
      ],
      winner: "Jake",
    },
    {
      date: "not-a-date",
      players: [
        { name: "Jake", deckId: "ring-sting" },
        { name: "Mark", deckId: "ghalta" },
      ],
      winner: "Mark",
    },
  ],
};

test("winRate and pctText handle normal and empty totals", () => {
  assert.strictEqual(winRate(2, 4), 0.5);
  assert.strictEqual(winRate(1, 0), 0);
  assert.strictEqual(pctText(0.5), "50.00%");
});

test("safeISODate accepts real ISO dates only", () => {
  assert.strictEqual(safeISODate("2026-04-06").toISOString().slice(0, 10), "2026-04-06");
  assert.strictEqual(safeISODate("2026-02-31"), null);
  assert.strictEqual(safeISODate("06/04/2026"), null);
});

test("buildStatsFromMatches totals players and decks", () => {
  const stats = buildStatsFromMatches(sampleMatches);

  assert.deepStrictEqual(stats.players, [
    { name: "Jake", wins: 1, matchesPlayed: 3 },
    { name: "Jo", wins: 1, matchesPlayed: 2 },
    { name: "Liam", wins: 0, matchesPlayed: 1 },
    { name: "Mark", wins: 1, matchesPlayed: 2 },
  ]);

  assert.deepStrictEqual(stats.decksById, [
    { deckId: "ring-sting", wins: 1, matchesPlayed: 3 },
    { deckId: "bad-misc", wins: 1, matchesPlayed: 2 },
    { deckId: "big-sues", wins: 0, matchesPlayed: 1 },
    { deckId: "ghalta", wins: 1, matchesPlayed: 2 },
  ]);
});

test("decks2026RowsFromStats joins deck definitions", () => {
  const rows = decks2026RowsFromStats(
    [{ deckId: "bad-misc", wins: 2, matchesPlayed: 5 }],
    {
      decks: [
        {
          id: "bad-misc",
          name: "Bad Misc",
          commander: "Ragost, Deft Gastronaut",
          active: true,
        },
      ],
    }
  );

  assert.deepStrictEqual(rows, [
    {
      name: "Bad Misc",
      commanders: ["Ragost, Deft Gastronaut"],
      active: true,
      wins: 2,
      matchesPlayed: 5,
    },
  ]);
});

test("buildPlayerDeckStats2026 groups by player and deck", () => {
  const stats = buildPlayerDeckStats2026(sampleMatches);

  assert.deepStrictEqual(stats.get("Jake").get("ring-sting"), { wins: 1, matchesPlayed: 3 });
  assert.deepStrictEqual(stats.get("Jo").get("bad-misc"), { wins: 1, matchesPlayed: 2 });
  assert.deepStrictEqual(stats.get("Mark").get("ghalta"), { wins: 1, matchesPlayed: 2 });
});

test("buildMonthlyWins2026 groups dated wins by month", () => {
  const { months, byMonth } = buildMonthlyWins2026(sampleMatches);

  assert.deepStrictEqual(months, ["2026-04", "2026-05"]);
  assert.deepStrictEqual(Object.fromEntries(byMonth.get("2026-04")), { Jo: 1 });
  assert.deepStrictEqual(Object.fromEntries(byMonth.get("2026-05")), { Jake: 1 });
});

test("latestMatchDate ignores invalid dates", () => {
  assert.strictEqual(latestMatchDate(sampleMatches), "2026-05-01");
});

test("buildLatestSessionSummary describes the newest dated match group", () => {
  const summary = buildLatestSessionSummary({
    matches: [
      ...sampleMatches.matches,
      {
        date: "2026-05-01",
        players: [
          { name: "Jake", deckId: "ring-sting" },
          { name: "Jo", deckId: "bad-misc" },
        ],
        winner: "Jo",
      },
    ],
  });

  assert.strictEqual(summary.date, "2026-05-01");
  assert.strictEqual(summary.matchesPlayed, 2);
  assert.deepStrictEqual(summary.players, ["Jake", "Jo", "Mark"]);
  assert.deepStrictEqual(summary.deckIds, ["bad-misc", "ghalta", "ring-sting"]);
  assert.deepStrictEqual(summary.winsByPlayer, [
    { name: "Jake", wins: 1 },
    { name: "Jo", wins: 1 },
  ]);
});

test("mergePlayersOverall and mergeDecksOverall combine historic and match data", () => {
  assert.deepStrictEqual(
    mergePlayersOverall(
      [{ name: "Jake", wins: 2, matchesPlayed: 5 }],
      [{ name: "Jake", wins: 1, matchesPlayed: 3 }, { name: "Jo", wins: 1, matchesPlayed: 2 }]
    ),
    [
      { name: "Jake", wins: 3, matchesPlayed: 8 },
      { name: "Jo", wins: 1, matchesPlayed: 2 },
    ]
  );

  assert.deepStrictEqual(
    mergeDecksOverall(
      [{ name: "Old Deck", commander: "Old Commander", active: false, wins: 1, matchesPlayed: 4 }],
      [{ name: "Old Deck", commanders: ["Old Commander"], active: true, wins: 2, matchesPlayed: 3 }]
    ),
    [{ name: "Old Deck", commanders: ["Old Commander"], active: true, wins: 3, matchesPlayed: 7 }]
  );
});
