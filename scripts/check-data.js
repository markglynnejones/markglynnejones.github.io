#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const ALLOWED_COLORS = new Set(["White", "Blue", "Black", "Red", "Green", "Colorless"]);

function createIssueCollector() {
  return {
    errors: [],
    warnings: [],
    fail(message) {
      this.errors.push(message);
    },
    warn(message) {
      this.warnings.push(message);
    },
  };
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

function readJson(filePath, issues) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    issues.fail(`${rel(filePath)} is not valid JSON: ${error.message}`);
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

function checkDeckDefinitions(deckDefinitions, issues) {
  const decks = deckDefinitions?.decks;
  if (!Array.isArray(decks)) {
    issues.fail("data/deck-definitions.json must contain a decks array.");
    return new Map();
  }

  const deckById = new Map();
  const aliases = new Map();

  decks.forEach((deck, index) => {
    const label = `data/deck-definitions.json decks[${index}]`;

    if (!isNonEmptyString(deck.id)) issues.fail(`${label} must have a non-empty id.`);
    if (!isNonEmptyString(deck.name)) issues.fail(`${label} (${deck.id || "missing id"}) must have a non-empty name.`);
    if (typeof deck.active !== "boolean") issues.fail(`${label} (${deck.id || "missing id"}) must have a boolean active value.`);

    const commanders = commanderList(deck);
    if (!commanders.length || commanders.some((commander) => !isNonEmptyString(commander))) {
      issues.fail(`${label} (${deck.id || "missing id"}) must have a commander string or non-empty commander array.`);
    }

    if (deck.id) {
      if (deckById.has(deck.id)) issues.fail(`Duplicate deck id "${deck.id}" in data/deck-definitions.json.`);
      deckById.set(deck.id, deck);
    }

    for (const alias of deck.aliases || []) {
      if (!isNonEmptyString(alias)) {
        issues.fail(`${label} (${deck.id || "missing id"}) has an empty alias.`);
        continue;
      }

      const key = normalise(alias);
      if (!aliases.has(key)) aliases.set(key, []);
      aliases.get(key).push(deck.id);
    }
  });

  for (const [alias, deckIds] of aliases.entries()) {
    const uniqueDeckIds = [...new Set(deckIds)];
    if (uniqueDeckIds.length > 1) issues.fail(`Alias "${alias}" is used by multiple decks: ${uniqueDeckIds.join(", ")}.`);
  }

  return deckById;
}

function checkMatchesData(fileLabel, data, deckById, issues) {
  const matches = data?.matches;
  if (!Array.isArray(matches)) {
    issues.fail(`${fileLabel} must contain a matches array.`);
    return;
  }

  let previousDate = "";
  const signatures = new Set();

  matches.forEach((match, index) => {
    const label = `${fileLabel} matches[${index}]`;

    if (!validIsoDate(match.date)) issues.fail(`${label} has invalid date "${match.date}".`);
    if (previousDate && String(match.date).localeCompare(previousDate) < 0) {
      issues.warn(`${label} is out of date order: ${match.date} appears after ${previousDate}.`);
    }
    previousDate = String(match.date || previousDate);

    if (!Array.isArray(match.players) || match.players.length < 2) {
      issues.fail(`${label} must have at least two players.`);
      return;
    }

    const playerNames = new Set();
    match.players.forEach((player, playerIndex) => {
      const playerLabel = `${label} players[${playerIndex}]`;
      if (!isNonEmptyString(player.name)) issues.fail(`${playerLabel} must have a non-empty name.`);
      if (!isNonEmptyString(player.deckId)) issues.fail(`${playerLabel} must have a non-empty deckId.`);
      if (player.deckId && !deckById.has(player.deckId)) issues.fail(`${playerLabel} references unknown deckId "${player.deckId}".`);
      if (player.name) {
        if (playerNames.has(player.name)) issues.fail(`${label} contains duplicate player "${player.name}".`);
        playerNames.add(player.name);
      }
    });

    if (!isNonEmptyString(match.winner)) {
      issues.fail(`${label} must have a winner.`);
    } else if (!playerNames.has(match.winner)) {
      issues.fail(`${label} winner "${match.winner}" is not one of the match players.`);
    }

    const signature = `${match.date}|${match.winner}|${match.players.map((player) => `${player.name}:${player.deckId}`).sort().join(",")}`;
    if (signatures.has(signature)) issues.fail(`${label} duplicates an earlier match in ${fileLabel}.`);
    signatures.add(signature);
  });
}

function checkHistoricPlayers(players2025, issues) {
  const players = players2025?.players;
  if (!Array.isArray(players)) {
    issues.fail("data/players-2025.json must contain a players array.");
    return;
  }

  const names = new Set();
  players.forEach((player, index) => {
    const label = `data/players-2025.json players[${index}]`;
    if (!isNonEmptyString(player.name)) issues.fail(`${label} must have a non-empty name.`);
    if (!isNonNegativeNumber(player.wins)) issues.fail(`${label} must have non-negative numeric wins.`);
    if (!isNonNegativeNumber(player.matchesPlayed)) issues.fail(`${label} must have non-negative numeric matchesPlayed.`);
    if (player.wins > player.matchesPlayed) issues.fail(`${label} has more wins than matchesPlayed.`);
    if (player.name) {
      if (names.has(player.name)) issues.fail(`Duplicate player "${player.name}" in data/players-2025.json.`);
      names.add(player.name);
    }
  });
}

function checkHistoricDecks(decks2025, issues) {
  const decks = decks2025?.decks;
  if (!Array.isArray(decks)) {
    issues.fail("data/decks-2025.json must contain a decks array.");
    return;
  }

  decks.forEach((deck, index) => {
    const label = `data/decks-2025.json decks[${index}]`;
    if (!isNonEmptyString(deck.name)) issues.fail(`${label} must have a non-empty name.`);
    if (!commanderList(deck).length) issues.fail(`${label} (${deck.name || "missing name"}) must have commander data.`);
    if (!isNonNegativeNumber(deck.wins)) issues.fail(`${label} (${deck.name || "missing name"}) must have non-negative numeric wins.`);
    if (!isNonNegativeNumber(deck.matchesPlayed)) issues.fail(`${label} (${deck.name || "missing name"}) must have non-negative numeric matchesPlayed.`);
    if (typeof deck.active !== "boolean") issues.fail(`${label} (${deck.name || "missing name"}) must have a boolean active value.`);
    if (deck.wins > deck.matchesPlayed) issues.fail(`${label} (${deck.name || "missing name"}) has more wins than matchesPlayed.`);
  });
}

function checkCombinations(combinationsData, issues) {
  const combinations = combinationsData?.combinations;
  if (!combinations || typeof combinations !== "object" || Array.isArray(combinations)) {
    issues.fail("data/combinations.json must contain a combinations object.");
    return;
  }

  for (const [name, colors] of Object.entries(combinations)) {
    if (!Array.isArray(colors) || !colors.length) {
      issues.fail(`Combination "${name}" must be a non-empty color array.`);
      continue;
    }
    for (const color of colors) {
      if (!ALLOWED_COLORS.has(color)) issues.fail(`Combination "${name}" contains unknown color "${color}".`);
    }
  }
}

function checkPlayerAliases(playerAliases, issues) {
  if (!playerAliases || typeof playerAliases !== "object" || Array.isArray(playerAliases)) {
    issues.fail("data/player-aliases.json must contain an alias-to-player object.");
    return;
  }

  const seen = new Set();
  for (const [alias, canonical] of Object.entries(playerAliases)) {
    const key = normalise(alias);
    if (!key) issues.fail("data/player-aliases.json contains an empty alias.");
    if (!isNonEmptyString(canonical)) issues.fail(`Player alias "${alias}" must point at a non-empty player name.`);
    if (seen.has(key)) issues.fail(`Duplicate normalised player alias "${key}" in data/player-aliases.json.`);
    seen.add(key);
  }
}

function checkStaticReferences(issues) {
  const html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("#")) continue;
    const cleanRef = ref.split(/[?#]/)[0];
    if (!cleanRef) continue;
    if (!fs.existsSync(path.join(REPO_ROOT, cleanRef))) issues.fail(`index.html references missing file "${ref}".`);
  }
}

function validateData(data, issues = createIssueCollector()) {
  const deckById = checkDeckDefinitions(data.deckDefinitions, issues);
  checkHistoricDecks(data.decks2025, issues);
  checkHistoricPlayers(data.players2025, issues);
  checkCombinations(data.combinationsData, issues);
  checkPlayerAliases(data.playerAliases, issues);

  for (const matchesFile of data.matchesFiles || []) {
    checkMatchesData(matchesFile.label, matchesFile.data, deckById, issues);
  }

  return issues;
}

function main() {
  const issues = createIssueCollector();
  const deckDefinitions = readJson(path.join(DATA_DIR, "deck-definitions.json"), issues);
  const decks2025 = readJson(path.join(DATA_DIR, "decks-2025.json"), issues);
  const players2025 = readJson(path.join(DATA_DIR, "players-2025.json"), issues);
  const combinationsData = readJson(path.join(DATA_DIR, "combinations.json"), issues);
  const playerAliases = readJson(path.join(DATA_DIR, "player-aliases.json"), issues);
  readJson(path.join(DATA_DIR, "doubles.json"), issues);

  const matchesFiles = fs.readdirSync(DATA_DIR)
    .filter((name) => /^matches-\d{4}\.json$/.test(name))
    .sort()
    .map((file) => {
      const filePath = path.join(DATA_DIR, file);
      return {
        label: rel(filePath),
        data: readJson(filePath, issues),
      };
    });

  validateData({ deckDefinitions, decks2025, players2025, combinationsData, playerAliases, matchesFiles }, issues);

  checkStaticReferences(issues);

  for (const warning of issues.warnings) console.warn(`Warning: ${warning}`);

  if (issues.errors.length) {
    console.error(`Data check failed with ${issues.errors.length} error(s):`);
    for (const error of issues.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Data check passed${issues.warnings.length ? ` with ${issues.warnings.length} warning(s)` : ""}.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkMatchesData,
  createIssueCollector,
  validateData,
  validIsoDate,
};
