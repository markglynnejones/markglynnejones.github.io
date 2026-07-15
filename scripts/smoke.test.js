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
    "scripts/insights/recent-form.js",
    "scripts/insights/streaks.js",
    "scripts/insights/fun-stats.js",
    "scripts/insights/deep-links.js",
    "scripts/player-ids.js",
    "scripts/import-parser.js",
    "scripts/scryfall.js",
    "scripts/render/dashboard-summary.js",
    "scripts/render/phase-one-insights.js",
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
    "view-overview",
    "view-players",
    "view-decks",
    "view-sessions",
    "view-fun",
    "view-special",
    "view-import",
    "tab-overall",
    "tab-2025",
    "tab-2026",
    "dashboard-summary-body",
    "wins-table-body",
    "player-decks-body",
    "head-to-head-body",
    "recent-form-streaks-body",
    "fun-stats-body",
    "special-games-body",
    "latest-session-summary",
    "recent-matches-body",
    "show-more-recent-matches",
    "sessions-body",
    "wins-over-time-chart",
    "decks-table-body",
    "import-notes",
    "import-preview-body",
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} should exist`);
  }
});

test("sessions render as tabbed compact panels", () => {
  assert.match(html, /id="sessions-body" class="sessions-list"/);
  assert.doesNotMatch(html, /id="sessions-table"/);
});

test("app view navigation is hash based", () => {
  assert.match(html, /href="#\/overview"[^>]+data-view-link="overview"/);
  assert.match(html, /href="#\/players"[^>]+data-view-link="players"/);
  assert.match(html, /href="#\/decks"[^>]+data-view-link="decks"/);
  assert.match(html, /href="#\/sessions"[^>]+data-view-link="sessions"/);
  assert.match(html, /href="#\/fun"[^>]+data-view-link="fun"/);
  assert.match(html, /href="#\/special"[^>]+data-view-link="special"/);
  assert.match(html, /href="#\/import"[^>]+data-view-link="import"/);
});

test("year tabs control the shared tab panel", () => {
  for (const tabId of ["tab-overall", "tab-2025", "tab-2026"]) {
    assert.match(html, new RegExp(`id="${tabId}"[\\s\\S]*?aria-controls="tab-panel"`));
  }
});

test("page includes baseline accessibility hooks", () => {
  assert.match(html, /class="skip-link" href="#tab-panel"/);
  assert.match(html, /aria-label="Commander stats dashboard"/);
  assert.match(html, /class="table-scroll"[^>]+role="region"/);
  assert.match(html, /<caption>Singles standings for the selected year view<\/caption>/);
  assert.match(html, /<caption>Deck records for the selected year view<\/caption>/);
  assert.match(html, /id="player-search-status"[^>]+aria-live="polite"/);
  assert.match(html, /id="deck-search-status"[^>]+aria-live="polite"/);
});

test("sortable table headers use real buttons", () => {
  assert.match(html, /id="sort-player"[^>]+scope="col"[\s\S]*?<button type="button" class="sort-button"/);
  assert.match(html, /id="sort-deck-name"[^>]+scope="col"[\s\S]*?<button type="button" class="sort-button"/);
  assert.doesNotMatch(html, /<th[^>]+role="button"/);
});

test("helper modules expose the globals used by scripts.js", () => {
  const stats = require("./stats");
  const recentForm = require("./insights/recent-form");
  const streaks = require("./insights/streaks");
  const funStats = require("./insights/fun-stats");
  const deepLinks = require("./insights/deep-links");
  const playerIds = require("./player-ids");
  const importParser = require("./import-parser");
  const scryfall = require("./scryfall");
  const dashboardSummary = require("./render/dashboard-summary");
  const phaseOneInsights = require("./render/phase-one-insights");
  const decks = require("./render/decks-table");
  const playerInsights = require("./render/player-insights");
  const recentMatches = require("./render/recent-matches");
  const sessions = require("./render/sessions");
  const singles = require("./render/singles-table");

  assert.strictEqual(typeof stats.buildStatsFromMatches, "function");
  assert.strictEqual(typeof stats.winRate, "function");
  assert.strictEqual(typeof recentForm.buildRecentForm, "function");
  assert.strictEqual(typeof streaks.buildWinStreaks, "function");
  assert.strictEqual(typeof funStats.buildFunStats, "function");
  assert.strictEqual(typeof deepLinks.deckAnchorId, "function");
  assert.strictEqual(typeof playerIds.buildPlayerLookup, "function");
  assert.strictEqual(typeof importParser.parseNotes, "function");
  assert.strictEqual(typeof scryfall.createCommanderScryfallClient, "function");
  assert.strictEqual(typeof scryfall.normaliseCommanderName, "function");
  assert.strictEqual(typeof dashboardSummary.renderDashboardSummary, "function");
  assert.strictEqual(typeof phaseOneInsights.renderRecentFormAndStreaks, "function");
  assert.strictEqual(typeof phaseOneInsights.renderFunStats, "function");
  assert.strictEqual(typeof decks.renderDecksTable, "function");
  assert.strictEqual(typeof playerInsights.renderHeadToHeadStats, "function");
  assert.strictEqual(typeof playerInsights.renderPlayerDeckStats, "function");
  assert.strictEqual(typeof recentMatches.renderRecentMatches, "function");
  assert.strictEqual(typeof sessions.renderSessions, "function");
  assert.strictEqual(typeof singles.renderSinglesTable, "function");
});
