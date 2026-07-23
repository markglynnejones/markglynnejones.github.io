#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { matchIdDate, validMatchId } = require("./match-ids");
const { normalisePlayerName, validPlayerId } = require("./player-ids");
const { sessionIdDate, validSessionId } = require("./session-ids");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const ALLOWED_COLORS = new Set(["White", "Blue", "Black", "Red", "Green", "Colorless"]);
const CURRENT_SCHEMA_VERSION = 1;
const METADATA_KEYS = new Set(["schemaVersion"]);

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

function checkSchemaVersion(fileLabel, data, issues) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    issues.fail(`${fileLabel} must contain a JSON object.`);
    return;
  }

  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    issues.fail(`${fileLabel} must have schemaVersion ${CURRENT_SCHEMA_VERSION}.`);
  }
}

function isNormalisedTag(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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
    if (deck.owner !== undefined && !isNonEmptyString(deck.owner)) issues.fail(`${label} (${deck.id || "missing id"}) has an empty owner.`);
    if (deck.needsReview !== undefined && typeof deck.needsReview !== "boolean") {
      issues.fail(`${label} (${deck.id || "missing id"}) needsReview must be boolean when present.`);
    }
    if (deck.reviewNote !== undefined && !isNonEmptyString(deck.reviewNote)) {
      issues.fail(`${label} (${deck.id || "missing id"}) has an empty reviewNote.`);
    }
    if (deck.needsReview === true) issues.warn(`${label} (${deck.id}) is marked needsReview.`);

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

function checkPlayerDefinitions(playerDefinitions, issues) {
  const players = playerDefinitions?.players;
  if (!Array.isArray(players)) {
    issues.fail("data/player-definitions.json must contain a players array.");
    return new Map();
  }

  const playerById = new Map();
  const names = new Map();

  players.forEach((player, index) => {
    const label = `data/player-definitions.json players[${index}]`;

    if (!validPlayerId(player.id)) issues.fail(`${label} must have a normalized player id.`);
    if (!isNonEmptyString(player.name)) issues.fail(`${label} (${player.id || "missing id"}) must have a non-empty name.`);
    if (typeof player.active !== "boolean") issues.fail(`${label} (${player.id || "missing id"}) must have a boolean active value.`);

    if (player.id) {
      if (playerById.has(player.id)) issues.fail(`Duplicate player id "${player.id}" in data/player-definitions.json.`);
      playerById.set(player.id, player);
    }

    if (player.name) {
      const key = normalisePlayerName(player.name);
      if (names.has(key)) issues.fail(`Duplicate player name "${player.name}" in data/player-definitions.json.`);
      names.set(key, player.id);
    }

    for (const alias of player.aliases || []) {
      if (!isNonEmptyString(alias)) issues.fail(`${label} (${player.id || "missing id"}) has an empty alias.`);
    }
  });

  return playerById;
}

function checkMatchesData(fileLabel, data, deckById, playerById, issues) {
  const matches = data?.matches;
  if (!Array.isArray(matches)) {
    issues.fail(`${fileLabel} must contain a matches array.`);
    return;
  }

  let previousDate = "";
  const signatures = new Set();
  const ids = new Set();

  matches.forEach((match, index) => {
    const label = `${fileLabel} matches[${index}]`;

    if (!validMatchId(match.id)) {
      issues.fail(`${label} has invalid id "${match.id}". Expected YYYY-MM-DD-001 format.`);
    } else {
      if (ids.has(match.id)) issues.fail(`${label} duplicates match id "${match.id}" in ${fileLabel}.`);
      ids.add(match.id);
      if (validIsoDate(match.date) && matchIdDate(match.id) !== match.date) {
        issues.fail(`${label} id "${match.id}" does not match date "${match.date}".`);
      }
    }

    if (!validSessionId(match.sessionId)) {
      issues.fail(`${label} has invalid sessionId "${match.sessionId}". Expected session-YYYY-MM-DD-001 format.`);
    } else if (validIsoDate(match.date) && sessionIdDate(match.sessionId) !== match.date) {
      issues.fail(`${label} sessionId "${match.sessionId}" does not match date "${match.date}".`);
    }

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
    const playerIds = new Set();
    match.players.forEach((player, playerIndex) => {
      const playerLabel = `${label} players[${playerIndex}]`;
      const playerDefinition = playerById.get(player.playerId);

      if (!validPlayerId(player.playerId)) issues.fail(`${playerLabel} must have a normalized playerId.`);
      if (player.playerId && !playerDefinition) issues.fail(`${playerLabel} references unknown playerId "${player.playerId}".`);
      if (!isNonEmptyString(player.name)) issues.fail(`${playerLabel} must have a non-empty name.`);
      if (playerDefinition && player.name !== playerDefinition.name) {
        issues.fail(`${playerLabel} name "${player.name}" does not match playerId "${player.playerId}" (${playerDefinition.name}).`);
      }
      if (!isNonEmptyString(player.deckId)) issues.fail(`${playerLabel} must have a non-empty deckId.`);
      if (player.deckId && !deckById.has(player.deckId)) issues.fail(`${playerLabel} references unknown deckId "${player.deckId}".`);

      if (player.playerId) {
        if (playerIds.has(player.playerId)) issues.fail(`${label} contains duplicate playerId "${player.playerId}".`);
        playerIds.add(player.playerId);
      }
      if (player.name) {
        if (playerNames.has(player.name)) issues.fail(`${label} contains duplicate player "${player.name}".`);
        playerNames.add(player.name);
      }
    });

    let winnerNameIsPlayer = false;
    if (!isNonEmptyString(match.winner)) {
      issues.fail(`${label} must have a winner.`);
    } else if (!playerNames.has(match.winner)) {
      issues.fail(`${label} winner "${match.winner}" is not one of the match players.`);
    } else {
      winnerNameIsPlayer = true;
    }

    if (!validPlayerId(match.winnerId)) {
      issues.fail(`${label} must have a normalized winnerId.`);
    } else if (!playerIds.has(match.winnerId)) {
      issues.fail(`${label} winnerId "${match.winnerId}" is not one of the match playerIds.`);
    } else if (winnerNameIsPlayer) {
      const winnerPlayer = match.players.find((player) => player.playerId === match.winnerId);
      if (winnerPlayer?.name !== match.winner) {
        issues.fail(`${label} winner "${match.winner}" does not match winnerId "${match.winnerId}".`);
      }
    }

    if (match.notes !== undefined && !isNonEmptyString(match.notes)) {
      issues.fail(`${label} notes must be a non-empty string when present.`);
    }

    if (match.tags !== undefined) {
      if (!Array.isArray(match.tags)) {
        issues.fail(`${label} tags must be an array when present.`);
      } else {
        const tags = new Set();
        match.tags.forEach((tag, tagIndex) => {
          if (!isNormalisedTag(tag)) {
            issues.fail(`${label} tags[${tagIndex}] must be a non-empty lowercase slug.`);
            return;
          }
          if (tags.has(tag)) issues.fail(`${label} tags contains duplicate tag "${tag}".`);
          tags.add(tag);
        });
      }
    }

    const signature = `${match.date}|${match.winner}|${match.players.map((player) => `${player.name}:${player.deckId}`).sort().join(",")}`;
    if (signatures.has(signature)) issues.fail(`${label} duplicates an earlier match in ${fileLabel}.`);
    signatures.add(signature);
  });
}

function checkSpecialMatchesData(fileLabel, data, playerById, issues) {
  const matches = data?.specialMatches;
  if (!Array.isArray(matches)) {
    issues.fail(`${fileLabel} must contain a specialMatches array.`);
    return;
  }

  const ids = new Set();
  matches.forEach((match, index) => {
    const label = `${fileLabel} specialMatches[${index}]`;

    if (!/^special-\d{4}-\d{2}-\d{2}-\d{3}$/.test(String(match.id || ""))) {
      issues.fail(`${label} has invalid id "${match.id}". Expected special-YYYY-MM-DD-001 format.`);
    } else {
      if (ids.has(match.id)) issues.fail(`${label} duplicates special match id "${match.id}" in ${fileLabel}.`);
      ids.add(match.id);
      if (validIsoDate(match.date) && match.id.slice(8, 18) !== match.date) {
        issues.fail(`${label} id "${match.id}" does not match date "${match.date}".`);
      }
    }

    if (!validIsoDate(match.date)) issues.fail(`${label} has invalid date "${match.date}".`);
    if (!isNonEmptyString(match.event)) issues.fail(`${label} must have a non-empty event.`);
    if (!isNormalisedTag(match.format)) issues.fail(`${label} format must be a non-empty lowercase slug.`);
    if (match.notes !== undefined && !isNonEmptyString(match.notes)) {
      issues.fail(`${label} notes must be a non-empty string when present.`);
    }

    if (!Array.isArray(match.players) || match.players.length < 2) {
      issues.fail(`${label} must have at least two players.`);
      return;
    }

    const playerIds = new Set();
    const playerNames = new Set();
    match.players.forEach((player, playerIndex) => {
      const playerLabel = `${label} players[${playerIndex}]`;
      const playerDefinition = playerById.get(player.playerId);

      if (!validPlayerId(player.playerId)) issues.fail(`${playerLabel} must have a normalized playerId.`);
      if (player.playerId && !playerDefinition) issues.fail(`${playerLabel} references unknown playerId "${player.playerId}".`);
      if (!isNonEmptyString(player.name)) issues.fail(`${playerLabel} must have a non-empty name.`);
      if (playerDefinition && player.name !== playerDefinition.name) {
        issues.fail(`${playerLabel} name "${player.name}" does not match playerId "${player.playerId}" (${playerDefinition.name}).`);
      }
      if (!isNonEmptyString(player.deckName)) issues.fail(`${playerLabel} must have a non-empty deckName.`);
      if (!Array.isArray(player.commanders) || !player.commanders.length) {
        issues.fail(`${playerLabel} must have a non-empty commanders array.`);
      } else {
        player.commanders.forEach((commander, commanderIndex) => {
          if (!isNonEmptyString(commander)) issues.fail(`${playerLabel} commanders[${commanderIndex}] must be a non-empty string.`);
        });
      }

      if (player.playerId) {
        if (playerIds.has(player.playerId)) issues.fail(`${label} contains duplicate playerId "${player.playerId}".`);
        playerIds.add(player.playerId);
      }
      if (player.name) {
        if (playerNames.has(player.name)) issues.fail(`${label} contains duplicate player "${player.name}".`);
        playerNames.add(player.name);
      }
    });

    let winnerNameIsPlayer = false;
    if (!isNonEmptyString(match.winner)) {
      issues.fail(`${label} must have a winner.`);
    } else if (!playerNames.has(match.winner)) {
      issues.fail(`${label} winner "${match.winner}" is not one of the special match players.`);
    } else {
      winnerNameIsPlayer = true;
    }

    if (!validPlayerId(match.winnerId)) {
      issues.fail(`${label} must have a normalized winnerId.`);
    } else if (!playerIds.has(match.winnerId)) {
      issues.fail(`${label} winnerId "${match.winnerId}" is not one of the special match playerIds.`);
    } else if (winnerNameIsPlayer) {
      const winnerPlayer = match.players.find((player) => player.playerId === match.winnerId);
      if (winnerPlayer?.name !== match.winner) {
        issues.fail(`${label} winner "${match.winner}" does not match winnerId "${match.winnerId}".`);
      }
    }
  });
}

function checkHistoricPlayers(players2025, playerById, issues) {
  const players = players2025?.players;
  if (!Array.isArray(players)) {
    issues.fail("data/players-2025.json must contain a players array.");
    return;
  }

  const names = new Set();
  const knownNames = new Set(Array.from(playerById.values()).map((player) => normalisePlayerName(player.name)));
  players.forEach((player, index) => {
    const label = `data/players-2025.json players[${index}]`;
    if (!isNonEmptyString(player.name)) issues.fail(`${label} must have a non-empty name.`);
    if (player.name && !knownNames.has(normalisePlayerName(player.name))) {
      issues.fail(`${label} references unknown player "${player.name}".`);
    }
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

function checkPlayerAliases(playerAliases, playerById, issues) {
  if (!playerAliases || typeof playerAliases !== "object" || Array.isArray(playerAliases)) {
    issues.fail("data/player-aliases.json must contain an alias-to-player object.");
    return;
  }

  const seen = new Set();
  for (const [alias, canonical] of Object.entries(playerAliases)) {
    if (METADATA_KEYS.has(alias)) continue;
    const key = normalise(alias);
    if (!key) issues.fail("data/player-aliases.json contains an empty alias.");
    if (!isNonEmptyString(canonical)) issues.fail(`Player alias "${alias}" must point at a non-empty player name.`);
    if (isNonEmptyString(canonical)) {
      const player = Array.from(playerById.values()).find((entry) => normalisePlayerName(entry.name) === normalisePlayerName(canonical));
      if (!player) issues.fail(`Player alias "${alias}" points at unknown player "${canonical}".`);
    }
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
  checkSchemaVersion("data/deck-definitions.json", data.deckDefinitions, issues);
  checkSchemaVersion("data/decks-2025.json", data.decks2025, issues);
  checkSchemaVersion("data/players-2025.json", data.players2025, issues);
  checkSchemaVersion("data/player-definitions.json", data.playerDefinitions, issues);
  checkSchemaVersion("data/combinations.json", data.combinationsData, issues);
  checkSchemaVersion("data/player-aliases.json", data.playerAliases, issues);

  const deckById = checkDeckDefinitions(data.deckDefinitions, issues);
  const playerById = checkPlayerDefinitions(data.playerDefinitions, issues);
  checkHistoricDecks(data.decks2025, issues);
  checkHistoricPlayers(data.players2025, playerById, issues);
  checkCombinations(data.combinationsData, issues);
  checkPlayerAliases(data.playerAliases, playerById, issues);

  for (const matchesFile of data.matchesFiles || []) {
    checkSchemaVersion(matchesFile.label, matchesFile.data, issues);
    checkMatchesData(matchesFile.label, matchesFile.data, deckById, playerById, issues);
  }

  for (const specialMatchesFile of data.specialMatchesFiles || []) {
    checkSchemaVersion(specialMatchesFile.label, specialMatchesFile.data, issues);
    checkSpecialMatchesData(specialMatchesFile.label, specialMatchesFile.data, playerById, issues);
  }

  return issues;
}

function readDataSet(dataDir, issues) {
  const deckDefinitions = readJson(path.join(dataDir, "deck-definitions.json"), issues);
  const playerDefinitions = readJson(path.join(dataDir, "player-definitions.json"), issues);
  const decks2025 = readJson(path.join(dataDir, "decks-2025.json"), issues);
  const players2025 = readJson(path.join(dataDir, "players-2025.json"), issues);
  const combinationsData = readJson(path.join(dataDir, "combinations.json"), issues);
  const playerAliases = readJson(path.join(dataDir, "player-aliases.json"), issues);

  const matchesFiles = fs.readdirSync(dataDir)
    .filter((name) => /^matches-\d{4}\.json$/.test(name))
    .sort()
    .map((file) => {
      const filePath = path.join(dataDir, file);
      return {
        label: rel(filePath),
        data: readJson(filePath, issues),
      };
    });

  const specialMatchesFiles = fs.readdirSync(dataDir)
    .filter((name) => /^special-matches-\d{4}\.json$/.test(name))
    .sort()
    .map((file) => {
      const filePath = path.join(dataDir, file);
      return {
        label: rel(filePath),
        data: readJson(filePath, issues),
      };
    });

  return { deckDefinitions, playerDefinitions, decks2025, players2025, combinationsData, playerAliases, matchesFiles, specialMatchesFiles };
}

function main() {
  const issues = createIssueCollector();
  const doublesData = readJson(path.join(DATA_DIR, "doubles.json"), issues);

  validateData(readDataSet(DATA_DIR, issues), issues);
  const sampleDataDir = path.join(DATA_DIR, "sample");
  if (fs.existsSync(sampleDataDir)) validateData(readDataSet(sampleDataDir, issues), issues);
  checkSchemaVersion("data/doubles.json", doublesData, issues);

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
  checkPlayerDefinitions,
  checkSpecialMatchesData,
  createIssueCollector,
  CURRENT_SCHEMA_VERSION,
  readDataSet,
  validateData,
  validIsoDate,
};
