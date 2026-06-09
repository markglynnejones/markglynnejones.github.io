#!/usr/bin/env node

const assert = require("assert");

const {
  buildDeckComeback,
  buildFunStats,
  buildMostLoyalPilot,
  buildMostRotatedPlayer,
  buildNemesisPairing,
} = require("./fun-stats");

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
      date: "2026-01-01",
      players: [
        { name: "Ada", deckId: "angels" },
        { name: "Ben", deckId: "beasts" },
        { name: "Cara", deckId: "cats" },
      ],
      winner: "Ben",
    },
    {
      date: "2026-01-02",
      players: [
        { name: "Ada", deckId: "angels" },
        { name: "Ben", deckId: "birds" },
        { name: "Cara", deckId: "cats" },
      ],
      winner: "Cara",
    },
    {
      date: "2026-01-03",
      players: [
        { name: "Ada", deckId: "angels" },
        { name: "Ben", deckId: "beasts" },
        { name: "Cara", deckId: "crabs" },
      ],
      winner: "Ben",
    },
    {
      date: "2026-01-04",
      players: [
        { name: "Ada", deckId: "angels" },
        { name: "Ben", deckId: "birds" },
        { name: "Cara", deckId: "cats" },
      ],
      winner: "Ben",
    },
    {
      date: "2026-01-05",
      players: [
        { name: "Ada", deckId: "angels" },
        { name: "Ben", deckId: "beasts" },
        { name: "Cara", deckId: "crabs" },
      ],
      winner: "Ada",
    },
  ],
};

test("buildMostLoyalPilot returns the player deck pair with the most appearances", () => {
  assert.deepStrictEqual(buildMostLoyalPilot(sampleMatches), {
    playerName: "Ada",
    deckId: "angels",
    matchesPlayed: 5,
    wins: 1,
    winRate: 0.2,
  });
});

test("buildMostRotatedPlayer returns the player with the most unique decks", () => {
  assert.deepStrictEqual(buildMostRotatedPlayer(sampleMatches), {
    playerName: "Ben",
    uniqueDeckCount: 2,
    deckIds: ["beasts", "birds"],
    matchesPlayed: 5,
    wins: 3,
    winRate: 0.6,
  });
});

test("buildNemesisPairing returns the clearest leader over enough shared matches", () => {
  assert.deepStrictEqual(buildNemesisPairing(sampleMatches), {
    playerA: "Ada",
    playerB: "Ben",
    sharedMatches: 5,
    playerAWins: 1,
    playerBWins: 3,
    otherWins: 1,
    leaderName: "Ben",
    trailingName: "Ada",
    leaderWins: 3,
    trailingWins: 1,
    winMargin: 2,
    leaderWinRate: 0.6,
  });
});

test("buildNemesisPairing returns null when no pair has a clear leader", () => {
  const result = buildNemesisPairing(
    {
      matches: [
        {
          date: "2026-01-01",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ada",
        },
        {
          date: "2026-01-02",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ben",
        },
      ],
    },
    { minSharedMatches: 2 }
  );

  assert.strictEqual(result, null);
});

test("buildDeckComeback finds weak overall decks with stronger recent form", () => {
  const result = buildDeckComeback(
    {
      matches: [
        {
          date: "2026-02-01",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ben",
        },
        {
          date: "2026-02-02",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ben",
        },
        {
          date: "2026-02-03",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ben",
        },
        {
          date: "2026-02-04",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ada",
        },
        {
          date: "2026-02-05",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ada",
        },
      ],
    },
    { recentLimit: 2, minMatches: 4, maxOverallWinRate: 0.5, minRecentWinRate: 0.5 }
  );

  assert.deepStrictEqual(result, {
    deckId: "angels",
    matchesPlayed: 5,
    wins: 2,
    winRate: 0.4,
    recentLimit: 2,
    recentMatchesPlayed: 2,
    recentWins: 2,
    recentWinRate: 1,
    improvement: 0.6,
  });
});

test("buildDeckComeback uses date order and original order within a date", () => {
  const result = buildDeckComeback(
    {
      matches: [
        {
          date: "2026-03-02",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ada",
        },
        {
          date: "2026-03-01",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ben",
        },
        {
          date: "2026-03-02",
          players: [
            { name: "Ada", deckId: "angels" },
            { name: "Ben", deckId: "beasts" },
          ],
          winner: "Ada",
        },
      ],
    },
    { recentLimit: 2, minMatches: 3, maxOverallWinRate: 0.7, minRecentWinRate: 1 }
  );

  assert.strictEqual(result.deckId, "angels");
  assert.strictEqual(result.recentWins, 2);
});

test("buildFunStats returns separated neutral data objects", () => {
  const stats = buildFunStats(sampleMatches);

  assert.strictEqual(stats.mostLoyalPilot.playerName, "Ada");
  assert.strictEqual(stats.nemesisPairing.leaderName, "Ben");
  assert.strictEqual(stats.mostRotatedPlayer.playerName, "Ben");
  assert.strictEqual(stats.deckComeback, null);
});

test("builders handle empty data", () => {
  assert.strictEqual(buildMostLoyalPilot({ matches: [] }), null);
  assert.strictEqual(buildMostRotatedPlayer({ matches: [] }), null);
  assert.strictEqual(buildNemesisPairing({ matches: [] }), null);
  assert.strictEqual(buildDeckComeback({ matches: [] }), null);
});
