#!/usr/bin/env node

const assert = require("assert");
const { buildDeckOwnershipStats } = require("./player-insights");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("buildDeckOwnershipStats counts active and inactive decks by owner", () => {
  const current = {
    decks: [
      { name: "Deck A", owner: "Mark", active: true },
      { name: "Deck B", owner: "Mark", active: false },
      { name: "Deck C", owner: "Jake", active: true },
    ],
  };

  const historical = {
    decks: [
      { name: "Deck A", owner: "Mark", active: false },
      { name: "Old Deck", owner: "Jake", active: false },
      { name: "Older Deck", owner: "Liam", active: false },
    ],
  };

  assert.deepStrictEqual(buildDeckOwnershipStats(current, historical), [
    { owner: "Jake", total: 2, active: 1, inactive: 1 },
    { owner: "Mark", total: 2, active: 1, inactive: 1 },
    { owner: "Liam", total: 1, active: 0, inactive: 1 },
  ]);
});

test("current definitions take precedence over matching historical records", () => {
  const current = {
    decks: [{ name: "Shared Deck", owner: "Jo", active: true }],
  };
  const historical = {
    decks: [{ name: "shared deck", owner: "Mark", active: false }],
  };

  assert.deepStrictEqual(buildDeckOwnershipStats(current, historical), [
    { owner: "Jo", total: 1, active: 1, inactive: 0 },
  ]);
});
