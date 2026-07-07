#!/usr/bin/env node

const assert = require("assert");

const { buildPlayerLookup, playerIdFromName, validPlayerId } = require("./player-ids");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("playerIdFromName creates normalized ids", () => {
  assert.strictEqual(playerIdFromName("Ollie"), "ollie");
  assert.strictEqual(playerIdFromName("Jake Jones"), "jake-jones");
  assert.strictEqual(playerIdFromName("Éowyn"), "eowyn");
});

test("validPlayerId accepts lowercase slug ids only", () => {
  assert.strictEqual(validPlayerId("jo"), true);
  assert.strictEqual(validPlayerId("jake-jones"), true);
  assert.strictEqual(validPlayerId("Jake"), false);
  assert.strictEqual(validPlayerId("jake_ones"), false);
});

test("buildPlayerLookup maps names and aliases to player definitions", () => {
  const lookup = buildPlayerLookup(
    {
      players: [
        { id: "jo", name: "Jo", active: true },
        { id: "ollie", name: "Ollie", active: true, aliases: ["Olly"] },
      ],
    },
    { schemaVersion: 1, jon: "Jo" }
  );

  assert.strictEqual(lookup.byId.get("jo").name, "Jo");
  assert.strictEqual(lookup.byName.get("jo").id, "jo");
  assert.strictEqual(lookup.byName.get("jon").id, "jo");
  assert.strictEqual(lookup.byName.get("olly").id, "ollie");
  assert.strictEqual(lookup.byName.has("schemaversion"), false);
});
