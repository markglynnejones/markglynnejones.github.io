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
              id: "2026-04-06-001",
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

test("validateData accepts optional match notes and tags", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              id: "2026-04-06-001",
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              notes: "Planechase got messy.",
              tags: ["planechase", "precon-night"],
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.deepStrictEqual(result.errors, []);
  assert.deepStrictEqual(result.warnings, []);
});

test("validateData accepts optional deck owner and review metadata", () => {
  const data = validData({
    deckDefinitions: {
      decks: [
        {
          id: "bad-misc",
          name: "Bad Misc",
          commander: "Ragost, Deft Gastronaut",
          owner: "Jo",
          active: true,
          needsReview: true,
          reviewNote: "Confirm spelling.",
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
  });

  const result = validateData(data);

  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.warnings.length, 1);
  assert.match(result.warnings[0], /needsReview/);
});

test("validateData catches unknown deck ids", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              id: "2026-04-06-001",
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
              id: "2026-04-06-001",
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

test("validateData catches missing, malformed, duplicate, and date-mismatched match ids", () => {
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
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              id: "bad-id",
              date: "2026-04-07",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              id: "2026-04-08-001",
              date: "2026-04-08",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              id: "2026-04-08-001",
              date: "2026-04-09",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              id: "2026-04-10-001",
              date: "2026-04-11",
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
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 5);
  assert.match(result.errors[0], /invalid id/);
  assert.match(result.errors[1], /invalid id/);
  assert.match(result.errors[2], /duplicates match id "2026-04-08-001"/);
  assert.match(result.errors[3], /does not match date "2026-04-09"/);
  assert.match(result.errors[4], /does not match date "2026-04-11"/);
});

test("validateData catches invalid match notes and tags", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              id: "2026-04-06-001",
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              notes: "",
              tags: ["planechase", "Bad Tag", "planechase", ""],
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 4);
  assert.match(result.errors[0], /notes must be a non-empty string/);
  assert.match(result.errors[1], /tags\[1\] must be a non-empty lowercase slug/);
  assert.match(result.errors[2], /duplicate tag "planechase"/);
  assert.match(result.errors[3], /tags\[3\] must be a non-empty lowercase slug/);
});

test("validateData catches non-array match tags", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              id: "2026-04-06-001",
              date: "2026-04-06",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              tags: "planechase",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 1);
  assert.match(result.errors[0], /tags must be an array/);
});

test("validateData warns when match dates are out of order", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          matches: [
            {
              id: "2026-04-07-001",
              date: "2026-04-07",
              players: [
                { name: "Jo", deckId: "bad-misc" },
                { name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
            },
            {
              id: "2026-04-06-001",
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
