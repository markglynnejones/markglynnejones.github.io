#!/usr/bin/env node

const assert = require("assert");

const { findDeckQuery } = require("./find-deck");

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
      id: "revival-trance",
      name: "Revival Trance",
      commander: "Terra",
      active: true,
      aliases: ["terra"],
    },
    {
      id: "bad-misc",
      name: "Bad Misc",
      commander: "Ragost, Deft Gastronaut",
      active: true,
      aliases: ["bad misc"],
    },
  ],
};

test("findDeckQuery resolves aliases", () => {
  const result = findDeckQuery("terra", deckDefinitions);

  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.deck.id, "revival-trance");
  assert.strictEqual(result.matched, "terra");
});

test("findDeckQuery reports unknown deck suggestions", () => {
  const result = findDeckQuery("weird frog", deckDefinitions);

  assert.match(result.error, /Couldn't resolve deck/);
  assert.match(result.error, /Suggested new deck stub:/);
  assert.match(result.error, /"id": "weird-frog"/);
});
