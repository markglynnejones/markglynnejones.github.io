#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const ALLOWED_COLORS = new Set(["White", "Blue", "Black", "Red", "Green", "Colorless"]);

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function rel(filePath) {
  return path.relative(REPO_ROOT, filePath);
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${rel(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function commanderList(deck) {
  return (Array.isArray(deck.commander) ? deck.commander : [deck.commander]).filter(Boolean);
}

function checkDeckDefinitions(deckDefinitions) {
  const decks = deckDefinitions?.decks;
  if (!Array.isArray(decks)) {
    fail("data/deck-definitions.json must contain a decks array.");
    return new Map();
  }

  const deckById = new Map();
  const aliases = new Map();

  decks.forEach((deck, index) => {
    const label = `data/deck-definitions.json decks[${index}]`;

    if (!isNonEmptyString(deck.id)) fail(`${label} must have a non-empty id.`);
    if (!isNonEmptyString(deck.name)) fail(`${label} (${deck.id || "missing id"}) must have a non-empty name.`);
    if (typeof deck.active !== "boolean") fail(`${label} (${deck.id || "missing id"}) must have a boolean active value.`);

    const commanders = commanderList(deck);
    if (!commanders.length || commanders.some((commander) => !isNonEmptyString(commander))) {
      fail(`${label} (${deck.id || "missing id"}) must have a commander string or non-empty commander array.`);
    }

    if (deck.id) {
      if (deckById.has(deck.id)) fail(`Duplicate deck id "${deck.id}" in data/deck-definitions.json.`);
      deckById.set(deck.id, deck);
    }

    for (const alias of deck.aliases || []) {
      if (!isNonEmptyString(alias)) {
        fail(`${label} (${deck.id || "missing id"}) has an empty alias.`);
        continue;
      }

      const key = normalise(alias);
      if (!aliases.has(key)) aliases.set(key, []);
      aliases.get(key).push(deck.id);
    }
  });

  for (const [alias, deckIds] of aliases.entries()) {
    const uniqueDeckIds = [...new Set(deckIds)];
    if (uniqueDeckIds.length > 1) fail(`Alias "${alias}" is used by multiple decks: ${uniqueDeckIds.join(", ")}.`);
  }

  return deckById;
}

function checkMatchesFile(filePath, deckById) {
  const data = readJson(filePath);
  const matches = data?.matches;
  if (!Array.isArray(matches)) {
    fail(`${rel(filePath)} must contain a matches array.`);
    return;
  }

  let previousDate = "";
  const signatures = new Set();

  matches.forEach((match, index) => {
    const label = `${rel(filePath)} matches[${index}]`;

    if (!validIsoDate(match.date)) fail(`${label} has invalid date "${match.date}".`);
    if (previousDate && String(match.date).localeCompare(previousDate) < 0) {
      warn(`${label} is out of date order: ${match.date} appears after ${previousDate}.`);
    }
    previousDate = String(match.date || previousDate);

    if (!Array.isArray(match.players) || match.players.length < 2) {
      fail(`${label} must have at least two players.`);
      return;
    }

    const playerNames = new Set();
    match.players.forEach((player, playerIndex) => {
      const playerLabel = `${label} players[${playerIndex}]`;
      if (!isNonEmptyString(player.name)) fail(`${playerLabel} must have a non-empty name.`);
      if (!isNonEmptyString(player.deckId)) fail(`${playerLabel} must have a non-empty deckId.`);
      if (player.deckId && !deckById.has(player.deckId)) fail(`${playerLabel} references unknown deckId "${player.deckId}".`);
      if (player.name) {
        if (playerNames.has(player.name)) fail(`${label} contains duplicate player "${player.name}".`);
        playerNames.add(player.name);
      }
    });

    if (!isNonEmptyString(match.winner)) {
      fail(`${label} must have a winner.`);
    } else if (!playerNames.has(match.winner)) {
      fail(`${label} winner "${match.winner}" is not one of the match players.`);
    }

    const signature = `${match.date}|${match.winner}|${match.players.map((player) => `${player.name}:${player.deckId}`).sort().join(",")}`;
    if (signatures.has(signature)) fail(`${label} duplicates an earlier match in ${rel(filePath)}.`);
    signatures.add(signature);
  });
}

function checkHistoricPlayers(players2025) {
  const players = players2025?.players;
  if (!Array.isArray(players)) {
    fail("data/players-2025.json must contain a players array.");
    return;
  }

  const names = new Set();
  players.forEach((player, index) => {
    const label = `data/players-2025.json players[${index}]`;
    if (!isNonEmptyString(player.name)) fail(`${label} must have a non-empty name.`);
    if (!isNonNegativeNumber(player.wins)) fail(`${label} must have non-negative numeric wins.`);
    if (!isNonNegativeNumber(player.matchesPlayed)) fail(`${label} must have non-negative numeric matchesPlayed.`);
    if (player.wins > player.matchesPlayed) fail(`${label} has more wins than matchesPlayed.`);
    if (player.name) {
      if (names.has(player.name)) fail(`Duplicate player "${player.name}" in data/players-2025.json.`);
      names.add(player.name);
    }
  });
}

function checkHistoricDecks(decks2025) {
  const decks = decks2025?.decks;
  if (!Array.isArray(decks)) {
    fail("data/decks-2025.json must contain a decks array.");
    return;
  }

  decks.forEach((deck, index) => {
    const label = `data/decks-2025.json decks[${index}]`;
    if (!isNonEmptyString(deck.name)) fail(`${label} must have a non-empty name.`);
    if (!commanderList(deck).length) fail(`${label} (${deck.name || "missing name"}) must have commander data.`);
    if (!isNonNegativeNumber(deck.wins)) fail(`${label} (${deck.name || "missing name"}) must have non-negative numeric wins.`);
    if (!isNonNegativeNumber(deck.matchesPlayed)) fail(`${label} (${deck.name || "missing name"}) must have non-negative numeric matchesPlayed.`);
    if (typeof deck.active !== "boolean") fail(`${label} (${deck.name || "missing name"}) must have a boolean active value.`);
    if (deck.wins > deck.matchesPlayed) fail(`${label} (${deck.name || "missing name"}) has more wins than matchesPlayed.`);
  });
}

function checkCombinations(combinationsData) {
  const combinations = combinationsData?.combinations;
  if (!combinations || typeof combinations !== "object" || Array.isArray(combinations)) {
    fail("data/combinations.json must contain a combinations object.");
    return;
  }

  for (const [name, colors] of Object.entries(combinations)) {
    if (!Array.isArray(colors) || !colors.length) {
      fail(`Combination "${name}" must be a non-empty color array.`);
      continue;
    }
    for (const color of colors) {
      if (!ALLOWED_COLORS.has(color)) fail(`Combination "${name}" contains unknown color "${color}".`);
    }
  }
}

function checkPlayerAliases(playerAliases) {
  if (!playerAliases || typeof playerAliases !== "object" || Array.isArray(playerAliases)) {
    fail("data/player-aliases.json must contain an alias-to-player object.");
    return;
  }

  const seen = new Set();
  for (const [alias, canonical] of Object.entries(playerAliases)) {
    const key = normalise(alias);
    if (!key) fail("data/player-aliases.json contains an empty alias.");
    if (!isNonEmptyString(canonical)) fail(`Player alias "${alias}" must point at a non-empty player name.`);
    if (seen.has(key)) fail(`Duplicate normalised player alias "${key}" in data/player-aliases.json.`);
    seen.add(key);
  }
}

function checkStaticReferences() {
  const html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("#")) continue;
    const cleanRef = ref.split(/[?#]/)[0];
    if (!cleanRef) continue;
    if (!fs.existsSync(path.join(REPO_ROOT, cleanRef))) fail(`index.html references missing file "${ref}".`);
  }
}

function main() {
  const deckDefinitions = readJson(path.join(DATA_DIR, "deck-definitions.json"));
  const decks2025 = readJson(path.join(DATA_DIR, "decks-2025.json"));
  const players2025 = readJson(path.join(DATA_DIR, "players-2025.json"));
  const combinationsData = readJson(path.join(DATA_DIR, "combinations.json"));
  const playerAliases = readJson(path.join(DATA_DIR, "player-aliases.json"));
  readJson(path.join(DATA_DIR, "doubles.json"));

  const deckById = checkDeckDefinitions(deckDefinitions);
  checkHistoricDecks(decks2025);
  checkHistoricPlayers(players2025);
  checkCombinations(combinationsData);
  checkPlayerAliases(playerAliases);

  for (const file of fs.readdirSync(DATA_DIR).filter((name) => /^matches-\d{4}\.json$/.test(name)).sort()) {
    checkMatchesFile(path.join(DATA_DIR, file), deckById);
  }

  checkStaticReferences();

  for (const warning of warnings) console.warn(`Warning: ${warning}`);

  if (errors.length) {
    console.error(`Data check failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Data check passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);
}

main();
