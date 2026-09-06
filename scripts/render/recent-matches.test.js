#!/usr/bin/env node

const assert = require("assert");
const { buildPlacementStats } = require("./recent-matches");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const matches = {
  matches: [
    {
      id: "game-1",
      players: [
        { playerId: "jake", name: "Jake", deckId: "saruman" },
        { playerId: "ollie", name: "Ollie", deckId: "abzan" },
        { playerId: "mark", name: "Mark", deckId: "ring-sting" },
      ],
      winner: "Jake",
    },
    {
      id: "game-2",
      players: [
        { playerId: "jake", name: "Jake", deckId: "uwu-otters" },
        { playerId: "ollie", name: "Ollie", deckId: "hostage-taker" },
        { playerId: "mark", name: "Mark", deckId: "quintorius" },
      ],
      winner: "Mark",
    },
    {
      id: "game-3",
      players: [
        { playerId: "mark", name: "Mark", deckId: "revival-trance" },
        { playerId: "jake", name: "Jake", deckId: "the-frog-is-loose" },
        { playerId: "ollie", name: "Ollie", deckId: "hostage-taker" },
      ],
      winner: "Jake",
    },
  ],
};

const details = new Map([
  [
    "game-1",
    new Map([
      ["jake", { playerOrder: 1, finishPosition: 1 }],
      ["ollie", { playerOrder: 2, finishPosition: 3 }],
      ["mark", { playerOrder: 3, finishPosition: 2 }],
    ]),
  ],
  [
    "game-2",
    new Map([
      ["jake", { playerOrder: 1, finishPosition: 2 }],
      ["ollie", { playerOrder: 2, finishPosition: 3 }],
      ["mark", { playerOrder: 3, finishPosition: 1 }],
    ]),
  ],
  [
    "game-3",
    new Map([
      ["mark", { playerOrder: 1, finishPosition: 2 }],
      ["jake", { playerOrder: 2, finishPosition: 1 }],
      ["ollie", { playerOrder: 3, finishPosition: 3 }],
    ]),
  ],
]);

test("buildPlacementStats calculates the three remembered games", () => {
  const result = buildPlacementStats(matches, details);

  assert.strictEqual(result.recordedMatches, 3);
  assert.deepStrictEqual(
    result.byPlayer.map((player) => ({
      name: player.name,
      games: player.games,
      wins: player.wins,
      averageFinish: Number(player.averageFinish.toFixed(2)),
      firstOuts: player.firstOuts,
    })),
    [
      { name: "Jake", games: 3, wins: 2, averageFinish: 1.33, firstOuts: 0 },
      { name: "Mark", games: 3, wins: 1, averageFinish: 1.67, firstOuts: 0 },
      { name: "Ollie", games: 3, wins: 0, averageFinish: 3, firstOuts: 3 },
    ]
  );

  assert.deepStrictEqual(
    result.byPosition.map((position) => ({
      position: position.position,
      games: position.games,
      wins: position.wins,
      winRate: Number(position.winRate.toFixed(3)),
      averageFinish: Number(position.averageFinish.toFixed(2)),
    })),
    [
      { position: 1, games: 3, wins: 1, winRate: 0.333, averageFinish: 1.67 },
      { position: 2, games: 3, wins: 1, winRate: 0.333, averageFinish: 2.33 },
      { position: 3, games: 3, wins: 1, winRate: 0.333, averageFinish: 2 },
    ]
  );
});

test("buildPlacementStats excludes incomplete recorded matches", () => {
  const incomplete = new Map(details);
  incomplete.set(
    "game-1",
    new Map([
      ["jake", { playerOrder: 1, finishPosition: 1 }],
      ["ollie", { playerOrder: 2, finishPosition: 3 }],
    ])
  );

  const result = buildPlacementStats(matches, incomplete);
  assert.strictEqual(result.recordedMatches, 2);
});
