#!/usr/bin/env node

const assert = require("assert");

const {
  assignMissingMatchIds,
  createMatchIdGenerator,
  formatMatchId,
  validMatchId,
} = require("./match-ids");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("validMatchId accepts the generated id format only", () => {
  assert.strictEqual(validMatchId("2026-06-14-001"), true);
  assert.strictEqual(validMatchId("2026-6-14-001"), false);
  assert.strictEqual(validMatchId("2026-06-14-1"), false);
  assert.strictEqual(validMatchId("match-1"), false);
});

test("formatMatchId pads the sequence", () => {
  assert.strictEqual(formatMatchId("2026-06-14", 7), "2026-06-14-007");
});

test("createMatchIdGenerator continues from existing ids per date", () => {
  const next = createMatchIdGenerator([
    { id: "2026-06-14-001", date: "2026-06-14" },
    { id: "2026-06-14-004", date: "2026-06-14" },
    { id: "2026-06-15-002", date: "2026-06-15" },
  ]);

  assert.strictEqual(next("2026-06-14"), "2026-06-14-005");
  assert.strictEqual(next("2026-06-14"), "2026-06-14-006");
  assert.strictEqual(next("2026-06-15"), "2026-06-15-003");
  assert.strictEqual(next("2026-06-16"), "2026-06-16-001");
});

test("assignMissingMatchIds fills only missing ids", () => {
  const matches = [
    { id: "2026-06-14-003", date: "2026-06-14" },
    { date: "2026-06-14" },
    { date: "2026-06-15" },
  ];

  assert.strictEqual(assignMissingMatchIds(matches), 2);
  assert.deepStrictEqual(matches.map((match) => match.id), [
    "2026-06-14-003",
    "2026-06-14-004",
    "2026-06-15-001",
  ]);
});
