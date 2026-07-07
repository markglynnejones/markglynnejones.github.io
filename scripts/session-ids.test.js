#!/usr/bin/env node

const assert = require("assert");

const { assignMissingSessionIds, formatSessionId, sessionIdDate, validSessionId } = require("./session-ids");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("formatSessionId creates explicit dated session ids", () => {
  assert.strictEqual(formatSessionId("2026-06-14"), "session-2026-06-14-001");
  assert.strictEqual(formatSessionId("2026-06-14", 2), "session-2026-06-14-002");
});

test("validSessionId accepts session ids only", () => {
  assert.strictEqual(validSessionId("session-2026-06-14-001"), true);
  assert.strictEqual(validSessionId("2026-06-14-001"), false);
  assert.strictEqual(validSessionId("session-2026-6-14-1"), false);
});

test("sessionIdDate extracts the date", () => {
  assert.strictEqual(sessionIdDate("session-2026-06-14-001"), "2026-06-14");
  assert.strictEqual(sessionIdDate("bad"), "");
});

test("assignMissingSessionIds reuses one session id per date", () => {
  const matches = [
    { date: "2026-06-14" },
    { date: "2026-06-14" },
    { date: "2026-06-15", sessionId: "session-2026-06-15-001" },
  ];

  assert.strictEqual(assignMissingSessionIds(matches), 2);
  assert.strictEqual(matches[0].sessionId, "session-2026-06-14-001");
  assert.strictEqual(matches[1].sessionId, "session-2026-06-14-001");
  assert.strictEqual(matches[2].sessionId, "session-2026-06-15-001");
});
