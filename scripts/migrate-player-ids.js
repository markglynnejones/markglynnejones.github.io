#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { buildPlayerLookup, normalisePlayerName, playerIdFromName } = require("./player-ids");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  const { formatMatchesData } = require("./import-notes");
  fs.writeFileSync(filePath, formatMatchesData(data));
}

function parseArgs(argv) {
  const args = { year: null, write: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return args;
}

function matchesFiles(year) {
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => /^matches-\d{4}\.json$/.test(name))
    .filter((name) => !year || name === `matches-${year}.json`)
    .sort()
    .map((name) => path.join(DATA_DIR, name));
}

function addPlayerIds(matchesData, playerDefinitions, playerAliases) {
  const lookup = buildPlayerLookup(playerDefinitions, playerAliases);
  let changed = 0;
  let unresolved = 0;

  for (const match of matchesData.matches || []) {
    for (const player of match.players || []) {
      const resolved = lookup.byName.get(normalisePlayerName(player.name));
      const playerId = resolved?.id || playerIdFromName(player.name);
      if (!resolved) unresolved += 1;
      if (player.playerId !== playerId) {
        player.playerId = playerId;
        changed += 1;
      }
    }

    const winner = (match.players || []).find((player) => player.name === match.winner);
    if (winner && match.winnerId !== winner.playerId) {
      match.winnerId = winner.playerId;
      changed += 1;
    }
  }

  return { changed, unresolved };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/migrate-player-ids.js [--year 2026] [--write]");
    process.exit(0);
  }

  const playerDefinitions = readJson(path.join(DATA_DIR, "player-definitions.json"));
  const playerAliases = readJson(path.join(DATA_DIR, "player-aliases.json"));
  const files = matchesFiles(args.year);

  for (const filePath of files) {
    const data = readJson(filePath);
    const result = addPlayerIds(data, playerDefinitions, playerAliases);
    if (args.write && result.changed) writeJson(filePath, data);
    console.log(`${path.relative(REPO_ROOT, filePath)}: ${result.changed} change(s), ${result.unresolved} unresolved player reference(s)`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { addPlayerIds, matchesFiles, parseArgs };
