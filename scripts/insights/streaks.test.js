#!/usr/bin/env node

const assert = require("assert");

const {
  buildDeckWinStreaks,
  buildPlayerWinStreaks,
  buildWinStreaks,
} = require("./streaks");

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
        { name: "Jake", deckId: "frogs" },
        { name: "Jo", deckId: "fishes" },
      ],
      winner: "Jake",
    },
    {
      date: "2026-01-02",
      players: [
        { name: "Jake", deckId: "frogs" },
        { name: "Mark", deckId: "vampires" },
      ],
      winner: "Jake",
    },
    {
      date: "2026-01-03",
      players: [
        { name: "Jo", deckId: "fishes" },
        { name: "Mark", deckId: "vampires" },
      ],
      winner: "Jo",
    },
    {
      date: "2026-01-04",
      players: [
        { name: "Jake", deckId: "frogs" },
        { name: "Jo", deckId: "otters" },
      ],
      winner: "Jo",
    },
    {
      date: "2026-01-05",
      players: [
        { name: "Jo", deckId: "otters" },
        { name: "Mark", deckId: "vampires" },
      ],
      winner: "Mark",
    },
  ],
};

test("buildPlayerWinStreaks calculates current and best streaks", () => {
  assert.deepStrictEqual(buildPlayerWinStreaks(sampleMatches), [
    { name: "Jake", currentWinStreak: 0, bestWinStreak: 2 },
    { name: "Jo", currentWinStreak: 0, bestWinStreak: 2 },
    { name: "Mark", currentWinStreak: 1, bestWinStreak: 1 },
  ]);
});

test("player streaks only change in matches where the player appears", () => {
  const streaks = buildPlayerWinStreaks(sampleMatches);
  const jo = streaks.find((player) => player.name === "Jo");

  assert.deepStrictEqual(jo, { name: "Jo", currentWinStreak: 0, bestWinStreak: 2 });
});

test("buildDeckWinStreaks calculates current and best streaks by deck id", () => {
  assert.deepStrictEqual(buildDeckWinStreaks(sampleMatches), [
    { deckId: "fishes", currentWinStreak: 1, bestWinStreak: 1 },
    { deckId: "frogs", currentWinStreak: 0, bestWinStreak: 2 },
    { deckId: "otters", currentWinStreak: 0, bestWinStreak: 1 },
    { deckId: "vampires", currentWinStreak: 1, bestWinStreak: 1 },
  ]);
});

test("deck streaks only change in matches where the deck appears", () => {
  const matches = {
    matches: [
      {
        players: [
          { name: "Jake", deckId: "frogs" },
          { name: "Jo", deckId: "fishes" },
        ],
        winner: "Jake",
      },
      {
        players: [
          { name: "Jo", deckId: "fishes" },
          { name: "Mark", deckId: "vampires" },
        ],
        winner: "Jo",
      },
      {
        players: [
          { name: "Jake", deckId: "frogs" },
          { name: "Mark", deckId: "vampires" },
        ],
        winner: "Jake",
      },
    ],
  };

  const frogs = buildDeckWinStreaks(matches).find((deck) => deck.deckId === "frogs");

  assert.deepStrictEqual(frogs, { deckId: "frogs", currentWinStreak: 2, bestWinStreak: 2 });
});

test("duplicate deck ids in a match are treated as one deck appearance", () => {
  const matches = {
    matches: [
      {
        players: [
          { name: "Jo", deckId: "shared" },
          { name: "Jake", deckId: "shared" },
          { name: "Mark", deckId: "vampires" },
        ],
        winner: "Jake",
      },
    ],
  };

  assert.deepStrictEqual(buildDeckWinStreaks(matches), [
    { deckId: "shared", currentWinStreak: 1, bestWinStreak: 1 },
    { deckId: "vampires", currentWinStreak: 0, bestWinStreak: 0 },
  ]);
});

test("buildWinStreaks returns player and deck streak groups", () => {
  const streaks = buildWinStreaks(sampleMatches);

  assert.deepStrictEqual(streaks.players, buildPlayerWinStreaks(sampleMatches));
  assert.deepStrictEqual(streaks.decksById, buildDeckWinStreaks(sampleMatches));
});
