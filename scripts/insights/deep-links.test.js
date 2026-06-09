#!/usr/bin/env node

const assert = require("assert");

const {
  anchorId,
  buildHashLink,
  cleanHash,
  deckAnchorId,
  parseHashLink,
  playerAnchorId,
  sessionAnchorId,
  stableHashPart,
  tabAnchorId,
} = require("./deep-links");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("stableHashPart preserves existing deck id characters and sanitizes unsafe characters", () => {
  assert.strictEqual(stableHashPart("ring-sting"), "ring-sting");
  assert.strictEqual(stableHashPart("Deck_ID-2026"), "Deck_ID-2026");
  assert.strictEqual(stableHashPart(" Mark's Mardu Deck "), "Mark-s-Mardu-Deck");
  assert.strictEqual(stableHashPart("A/B:C"), "A-B-C");
});

test("anchor helpers produce stable player, deck, session, and tab ids", () => {
  assert.strictEqual(playerAnchorId("Jo Smith"), "player-row-Jo-Smith");
  assert.strictEqual(deckAnchorId("ring-sting"), "deck-row-ring-sting");
  assert.strictEqual(sessionAnchorId("2026-05-29"), "session-2026-05-29");
  assert.strictEqual(tabAnchorId("2026"), "tab-2026");
  assert.strictEqual(anchorId("deck", "bad misc"), "deck-row-bad-misc");
  assert.strictEqual(anchorId("unknown", "value"), "");
});

test("deckAnchorId preserves the existing deck-row compatibility format", () => {
  assert.strictEqual(deckAnchorId("ghalta"), "deck-row-ghalta");
  assert.deepStrictEqual(parseHashLink("#deck-row-ghalta"), {
    tab: "",
    kind: "deck",
    value: "ghalta",
    anchorId: "deck-row-ghalta",
  });
});

test("buildHashLink creates query-style hashes with encoded values", () => {
  assert.strictEqual(buildHashLink({ tab: "2026" }), "#tab=2026");
  assert.strictEqual(buildHashLink({ tab: "2026", player: "Jo Smith" }), "#tab=2026&player=Jo+Smith");
  assert.strictEqual(buildHashLink({ tab: "overall", deck: "bad-misc" }), "#tab=overall&deck=bad-misc");
  assert.strictEqual(buildHashLink({ session: "2026-05-29" }), "#session=2026-05-29");
});

test("parseHashLink reads query-style player, deck, session, and tab hashes", () => {
  assert.deepStrictEqual(parseHashLink("#tab=2026&player=Jo+Smith"), {
    tab: "2026",
    kind: "player",
    value: "Jo Smith",
    anchorId: "player-row-Jo-Smith",
  });

  assert.deepStrictEqual(parseHashLink("#tab=overall&deck=bad-misc"), {
    tab: "overall",
    kind: "deck",
    value: "bad-misc",
    anchorId: "deck-row-bad-misc",
  });

  assert.deepStrictEqual(parseHashLink("#session=2026-05-29"), {
    tab: "",
    kind: "session",
    value: "2026-05-29",
    anchorId: "session-2026-05-29",
  });

  assert.deepStrictEqual(parseHashLink("#tab=2025"), {
    tab: "2025",
    kind: "",
    value: "",
    anchorId: "tab-2025",
  });
});

test("parseHashLink handles empty hashes and legacy non-deck anchors", () => {
  assert.deepStrictEqual(parseHashLink(""), { tab: "", kind: "", value: "", anchorId: "" });
  assert.strictEqual(cleanHash("#tab=2026"), "tab=2026");
  assert.deepStrictEqual(parseHashLink("#player-row-Mark"), {
    tab: "",
    kind: "player",
    value: "Mark",
    anchorId: "player-row-Mark",
  });
  assert.deepStrictEqual(parseHashLink("#session-2026-04-06"), {
    tab: "",
    kind: "session",
    value: "2026-04-06",
    anchorId: "session-2026-04-06",
  });
});
