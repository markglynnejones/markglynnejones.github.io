#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const html = readRepoFile("index.html");

test("index.html references existing local assets", () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("#")) continue;
    const cleanRef = ref.split(/[?#]/)[0];
    if (!cleanRef) continue;
    assert.ok(fs.existsSync(path.join(REPO_ROOT, cleanRef)), `${ref} should exist`);
  }
});

test("browser scripts load in dependency order", () => {
  const scriptRefs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1].split(/[?#]/)[0]);

  assert.deepStrictEqual(scriptRefs, [
    "scripts/stats.js",
    "scripts/scryfall.js",
    "scripts/render/dashboard-summary.js",
    "scripts/render/decks-table.js",
    "scripts/render/player-insights.js",
    "scripts/render/recent-matches.js",
    "scripts/render/sessions.js",
    "scripts/render/singles-table.js",
    "scripts.js",
  ]);
});

test("page keeps the core render targets", () => {
  const requiredIds = [
    "last-updated-note",
    "tab-overall",
    "tab-2025",
    "tab-2026",
    "dashboard-summary-body",
    "wins-table-body",
    "player-decks-body",
    "latest-session-summary",
    "recent-matches-body",
    "show-more-recent-matches",
    "sessions-body",
    "wins-over-time-chart",
    "decks-table-body",
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} should exist`);
  }
});

test("sessions render as tabbed compact panels", () => {
  assert.match(html, /id="sessions-body" class="sessions-list"/);
  assert.doesNotMatch(html, /id="sessions-table"/);
});

test("helper modules expose the globals used by scripts.js", () => {
  const stats = require("./stats");
  const scryfall = require("./scryfall");
  const dashboardSummary = require("./render/dashboard-summary");
  const decks = require("./render/decks-table");
  const playerInsights = require("./render/player-insights");
  const recentMatches = require("./render/recent-matches");
  const sessions = require("./render/sessions");
  const singles = require("./render/singles-table");

  assert.strictEqual(typeof stats.buildStatsFromMatches, "function");
  assert.strictEqual(typeof stats.winRate, "function");
  assert.strictEqual(typeof scryfall.createCommanderScryfallClient, "function");
  assert.strictEqual(typeof scryfall.normaliseCommanderName, "function");
  assert.strictEqual(typeof dashboardSummary.renderDashboardSummary, "function");
  assert.strictEqual(typeof decks.renderDecksTable, "function");
  assert.strictEqual(typeof playerInsights.renderPlayerDeckStats, "function");
  assert.strictEqual(typeof recentMatches.renderRecentMatches, "function");
  assert.strictEqual(typeof sessions.renderSessions, "function");
  assert.strictEqual(typeof singles.renderSinglesTable, "function");
});
