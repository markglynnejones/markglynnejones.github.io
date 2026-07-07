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
      schemaVersion: 1,
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
      schemaVersion: 1,
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
      schemaVersion: 1,
      players: [{ name: "Jake", wins: 2, matchesPlayed: 5 }],
    },
    playerDefinitions: {
      schemaVersion: 1,
      players: [
        { id: "jake", name: "Jake", active: true },
        { id: "jo", name: "Jo", active: true },
        { id: "liam", name: "Liam", active: true },
        { id: "ollie", name: "Ollie", active: true },
      ],
    },
    combinationsData: {
      schemaVersion: 1,
      combinations: {
        Izzet: ["Red", "Blue"],
      },
    },
    playerAliases: {
      schemaVersion: 1,
      olly: "Ollie",
    },
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
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

test("validateData catches missing or unsupported schema versions", () => {
  const missingDeckVersion = validData({
    deckDefinitions: {
      decks: [
        {
          id: "bad-misc",
          name: "Bad Misc",
          commander: "Ragost, Deft Gastronaut",
          active: true,
        },
        {
          id: "big-sues",
          name: "Big Sue's",
          commander: ["Susan Foreman", "The Twelfth Doctor"],
          active: true,
        },
      ],
    },
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 2,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(missingDeckVersion);

  assert.strictEqual(result.errors.length, 2);
  assert.match(result.errors[0], /data\/deck-definitions\.json must have schemaVersion 1/);
  assert.match(result.errors[1], /data\/matches-2026\.json must have schemaVersion 1/);
});

test("validateData accepts optional match notes and tags", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
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
      schemaVersion: 1,
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
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "missing-deck" },
              ],
              winner: "Jo",
              winnerId: "jo",
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
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "jo", name: "Jo", deckId: "big-sues" },
              ],
              winner: "Mark",
              winnerId: "mark",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 4);
  assert.match(result.errors[0], /contains duplicate playerId "jo"/);
  assert.match(result.errors[1], /contains duplicate player "Jo"/);
  assert.match(result.errors[2], /winner "Mark" is not one of the match players/);
  assert.match(result.errors[3], /winnerId "mark" is not one of the match playerIds/);
});

test("validateData catches missing, malformed, duplicate, and date-mismatched match ids", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 1,
          matches: [
            {
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "bad-id",
              sessionId: "session-2026-04-07-001",
              date: "2026-04-07",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "2026-04-08-001",
              sessionId: "session-2026-04-08-001",
              date: "2026-04-08",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "2026-04-08-001",
              sessionId: "session-2026-04-09-001",
              date: "2026-04-09",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "2026-04-10-001",
              sessionId: "session-2026-04-11-001",
              date: "2026-04-11",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
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

test("validateData catches malformed and date-mismatched session ids", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "bad-session",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "2026-04-07-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-07",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Liam",
              winnerId: "liam",
            },
          ],
        },
      },
    ],
  });

  const result = validateData(data);

  assert.strictEqual(result.errors.length, 2);
  assert.match(result.errors[0], /invalid sessionId/);
  assert.match(result.errors[1], /sessionId "session-2026-04-06-001" does not match date "2026-04-07"/);
});

test("validateData catches invalid match notes and tags", () => {
  const data = validData({
    matchesFiles: [
      {
        label: "data/matches-2026.json",
        data: {
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
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
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
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
          schemaVersion: 1,
          matches: [
            {
              id: "2026-04-07-001",
              sessionId: "session-2026-04-07-001",
              date: "2026-04-07",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Jo",
              winnerId: "jo",
            },
            {
              id: "2026-04-06-001",
              sessionId: "session-2026-04-06-001",
              date: "2026-04-06",
              players: [
                { playerId: "jo", name: "Jo", deckId: "bad-misc" },
                { playerId: "liam", name: "Liam", deckId: "big-sues" },
              ],
              winner: "Liam",
              winnerId: "liam",
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
      schemaVersion: 1,
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
