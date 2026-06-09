#!/usr/bin/env node

const assert = require("assert");

const { buildRecentForm, orderedMatches } = require("./recent-form");

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
      date: "2026-06-02",
      players: [
        { name: "Mark", deckId: "vampires" },
        { name: "Jo", deckId: "otters" },
      ],
      winner: "Mark",
    },
    {
      date: "2026-06-01",
      players: [
        { name: "Mark", deckId: "vampires" },
        { name: "Jo", deckId: "fish" },
      ],
      winner: "Jo",
    },
    {
      date: "2026-06-02",
      players: [
        { name: "Mark", deckId: "robots" },
        { name: "Liam", deckId: "zombies" },
      ],
      winner: "Liam",
    },
    {
      date: "not-a-date",
      players: [
        { name: "Mark", deckId: "vampires" },
        { name: "Liam", deckId: "zombies" },
      ],
      winner: "Mark",
    },
    {
      date: "2026-06-03",
      players: [
        { name: "Mark", deckId: "vampires" },
        { name: "Jo", deckId: "fish" },
      ],
      winner: "Jo",
    },
  ],
};

test("orderedMatches sorts by date and keeps original order within a date", () => {
  assert.deepStrictEqual(
    orderedMatches(sampleMatches).map(({ originalIndex }) => originalIndex),
    [1, 0, 2, 4]
  );
});

test("buildRecentForm calculates the last N player results in match order", () => {
  const form = buildRecentForm(sampleMatches, { limit: 3 });
  const mark = form.players.find((player) => player.name === "Mark");

  assert.deepStrictEqual(
    mark.results.map((result) => `${result.date}:${result.deckId}:${result.result}`),
    ["2026-06-02:vampires:W", "2026-06-02:robots:L", "2026-06-03:vampires:L"]
  );
  assert.strictEqual(mark.form, "WLL");
  assert.strictEqual(mark.wins, 1);
  assert.strictEqual(mark.losses, 2);
  assert.strictEqual(mark.matchesPlayed, 3);
  assert.strictEqual(mark.winRate, 1 / 3);
  assert.deepStrictEqual(mark.streak, { result: "L", count: 2 });
});

test("buildRecentForm calculates deck form independently from player form", () => {
  const form = buildRecentForm(sampleMatches, { limit: 2 });
  const vampires = form.decks.find((deck) => deck.deckId === "vampires");

  assert.deepStrictEqual(
    vampires.results.map((result) => `${result.date}:${result.playerName}:${result.result}`),
    ["2026-06-02:Mark:W", "2026-06-03:Mark:L"]
  );
  assert.strictEqual(vampires.form, "WL");
  assert.strictEqual(vampires.wins, 1);
  assert.strictEqual(vampires.losses, 1);
  assert.deepStrictEqual(vampires.streak, { result: "L", count: 1 });
});

test("buildRecentForm defaults invalid limits and sorts output deterministically", () => {
  const form = buildRecentForm(sampleMatches, { limit: 0 });

  assert.strictEqual(form.limit, 5);
  assert.deepStrictEqual(
    form.players.map((player) => player.name),
    ["Jo", "Liam", "Mark"]
  );
  assert.deepStrictEqual(
    form.decks.map((deck) => deck.deckId),
    ["fish", "otters", "robots", "vampires", "zombies"]
  );
});
