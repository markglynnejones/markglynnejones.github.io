#!/usr/bin/env node

const assert = require("assert");

const { validateData, validIsoDate } = require("./check-data");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function validData(overrides = {}) {
  return {
    deckDefinitions: {
      decks: [
        {
          id: "bad-misc",
          name: "Bad Misc",
          commander: "Ragost, Deft Gastronaut",
          active: true,
          aliases: ["bad misc"],
        },
        {
          id: "big-sues",
          name: "Big Sue's",
          commander: ["Susan Foreman", "The Twelfth Doctor"],
          active: true,
          aliases: ["big sues"],
        },
      ],
    },
    decks2025: {
      decks: [
        {
          name: "Old Deck",
          commander: "Old Commander",
          active: false,
          wins: 1,
          matchesPlayed: 3,
        },
      ],
    },
    players2025: {
      players: [{ name: "Jake", wins: 2, matchesPlayed: 5 }],
    },
    combinationsData: {
      combinations: {
        Izzet: ["Red", "Blue"],
      },
    },
    playerAliases: {
      olly: "Ollie",
    },
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
          ],
        },
      },
    ],
    ...overrides,
  };
}

test("validIsoDate rejects impossible dates", () => {
  assert.strictEqual(validIsoDate("2026-04-06"), true);
  assert.strictEqual(validIsoDate("2026-02-31"), false);
  assert.strictEqual(validIsoDate("06/04/2026"), false);
});

test("validateData accepts a valid data set", () => {
  const result = validateData(validData());

  assert.deepStrictEqual(result.errors, []);
  assert.deepStrictEqual(result.warnings, []);
});

test("validateData catches unknown deck ids", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "missing-deck" },
              ],
              winner: "Jo",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 1);
  assert.match(result.errors[0], /references unknown deckId "missing-deck"/);
});

test("validateData catches duplicate players and invalid winners", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Jo", deckId: "big-sues" },
              ],
              winner: "Mark",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 2);
  assert.match(result.errors[0], /contains duplicate player "Jo"/);
  assert.match(result.errors[1], /winner "Mark" is not one of the match players/);
});

test("validateData warns when match dates are out of order", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              date: "2026-04-07",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Liam",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.warnings.length, 1);
  assert.match(result.warnings[0], /out of date order/);
});

test("validateData catches duplicate aliases across decks", () => {
  const data = validData({
    deckDefinitions: {
      decks: [
        {
          id: "bad-misc",
          name: "Bad Misc",
          commander: "Ragost, Deft Gastronaut",
          active: true,
          aliases: ["shared"],
        },
        {
          id: "big-sues",
          name: "Big Sue's",
          commander: ["Susan Foreman", "The Twelfth Doctor"],
          active: true,
          aliases: ["shared"],
        },
      ],
    },
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 1);
  assert.match(result.errors[0], /Alias "shared" is used by multiple decks/);
});
