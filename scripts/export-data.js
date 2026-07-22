#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  buildStatsFromMatches,
  decks2026RowsFromStats,
  pctText,
  winRate,
} = require("./stats");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const FORMAT_TARGETS = {
  csv: ["matches", "players", "decks", "all"],
  json: ["matches", "special", "deck-definitions", "player-definitions", "player-aliases", "backup", "all"],
};

function usage() {
  console.log(`Usage: node scripts/export-data.js --format csv|json --year 2026 [--target target] [--out path]

Defaults:
- --target all
- all targets write files to data/exports/
- a single target writes to stdout unless --out is provided

CSV targets:
- matches
- players
- decks
- all

JSON targets:
- matches
- special
- deck-definitions
- player-definitions
- player-aliases
- backup
- all`);
}

function parseArgs(argv) {
  const args = { format: "csv", year: String(new Date().getFullYear()), target: "all", out: "", help: false };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
      args.format = argv[i + 1];
      i += 1;
    } else if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "--target") {
      args.target = argv[i + 1];
      i += 1;
    } else if (arg === "--out") {
      args.out = argv[i + 1];
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!FORMAT_TARGETS[args.format]) throw new Error(`--format must be one of: ${Object.keys(FORMAT_TARGETS).join(", ")}.`);
  if (!/^\d{4}$/.test(String(args.year))) throw new Error("--year must be a 4 digit year.");
  if (!FORMAT_TARGETS[args.format].includes(args.target)) {
    throw new Error(`--target must be one of for ${args.format}: ${FORMAT_TARGETS[args.format].join(", ")}.`);
  }
  if (args.out && args.target === "all") throw new Error("--out can only be used with a single target.");

  return args;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8"));
}

function readOptionalJson(relativePath, fallback) {
  const fullPath = path.join(REPO_ROOT, relativePath);
  return fs.existsSync(fullPath) ? JSON.parse(fs.readFileSync(fullPath, "utf8")) : fallback;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.map((column) => csvCell(column.header)).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(column.value(row))).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function deckNameMap(deckDefinitions) {
  return new Map((deckDefinitions?.decks || []).map((deck) => [deck.id, deck.name]));
}

function exportMatchesCsv(matchesData, deckDefinitions) {
  const names = deckNameMap(deckDefinitions);
  const rows = (matchesData.matches || []).map((match) => ({
    ...match,
    playerIds: (match.players || []).map((player) => player.playerId),
    playerNames: (match.players || []).map((player) => player.name),
    deckIds: (match.players || []).map((player) => player.deckId),
    deckNames: (match.players || []).map((player) => names.get(player.deckId) || player.deckId),
    tags: match.tags || [],
  }));

  return toCsv(rows, [
    { header: "id", value: (row) => row.id },
    { header: "sessionId", value: (row) => row.sessionId || "" },
    { header: "date", value: (row) => row.date },
    { header: "winnerId", value: (row) => row.winnerId || "" },
    { header: "winner", value: (row) => row.winner },
    { header: "playerIds", value: (row) => row.playerIds },
    { header: "players", value: (row) => row.playerNames },
    { header: "deckIds", value: (row) => row.deckIds },
    { header: "deckNames", value: (row) => row.deckNames },
    { header: "notes", value: (row) => row.notes || "" },
    { header: "tags", value: (row) => row.tags },
  ]);
}

function exportPlayersCsv(matchesData) {
  const rows = buildStatsFromMatches(matchesData).players
    .map((player) => ({
      ...player,
      winRate: winRate(player.wins, player.matchesPlayed),
    }))
    .sort((a, b) => b.wins - a.wins || b.matchesPlayed - a.matchesPlayed || a.name.localeCompare(b.name));

  return toCsv(rows, [
    { header: "player", value: (row) => row.name },
    { header: "wins", value: (row) => row.wins },
    { header: "matchesPlayed", value: (row) => row.matchesPlayed },
    { header: "winRate", value: (row) => pctText(row.winRate) },
  ]);
}

function exportDecksCsv(matchesData, deckDefinitions) {
  const stats = buildStatsFromMatches(matchesData);
  const rows = decks2026RowsFromStats(stats.decksById, deckDefinitions)
    .map((deck) => ({
      ...deck,
      winRate: winRate(deck.wins, deck.matchesPlayed),
    }))
    .sort((a, b) => b.wins - a.wins || b.matchesPlayed - a.matchesPlayed || a.name.localeCompare(b.name));

  return toCsv(rows, [
    { header: "deckId", value: (row) => row.deckId },
    { header: "deckName", value: (row) => row.name },
    { header: "commanders", value: (row) => row.commanders },
    { header: "owner", value: (row) => row.owner },
    { header: "active", value: (row) => row.active },
    { header: "wins", value: (row) => row.wins },
    { header: "matchesPlayed", value: (row) => row.matchesPlayed },
    { header: "winRate", value: (row) => pctText(row.winRate) },
  ]);
}

function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildBackupJson(year) {
  return {
    schemaVersion: 1,
    year,
    files: {
      [`matches-${year}.json`]: readJson(`data/matches-${year}.json`),
      [`special-matches-${year}.json`]: readOptionalJson(`data/special-matches-${year}.json`, {
        schemaVersion: 1,
        specialMatches: [],
      }),
      "deck-definitions.json": readJson("data/deck-definitions.json"),
      "player-definitions.json": readJson("data/player-definitions.json"),
      "player-aliases.json": readJson("data/player-aliases.json"),
      "players-2025.json": readJson("data/players-2025.json"),
      "decks-2025.json": readJson("data/decks-2025.json"),
      "combinations.json": readJson("data/combinations.json"),
      "doubles.json": readJson("data/doubles.json"),
    },
  };
}

function buildJsonExports(year, target) {
  const exports = {};

  if (target === "matches" || target === "all") exports.matches = toJson(readJson(`data/matches-${year}.json`));
  if (target === "special" || target === "all") {
    exports.special = toJson(
      readOptionalJson(`data/special-matches-${year}.json`, {
        schemaVersion: 1,
        specialMatches: [],
      })
    );
  }
  if (target === "deck-definitions" || target === "all") {
    exports["deck-definitions"] = toJson(readJson("data/deck-definitions.json"));
  }
  if (target === "player-definitions" || target === "all") {
    exports["player-definitions"] = toJson(readJson("data/player-definitions.json"));
  }
  if (target === "player-aliases" || target === "all") {
    exports["player-aliases"] = toJson(readJson("data/player-aliases.json"));
  }
  if (target === "backup" || target === "all") exports.backup = toJson(buildBackupJson(year));

  return exports;
}

function buildExports(config) {
  const { format = "csv", year, target } = config;
  if (format === "json") return buildJsonExports(year, target);

  const matchesData = readJson(`data/matches-${year}.json`);
  const deckDefinitions = readJson("data/deck-definitions.json");
  const exports = {};

  if (target === "matches" || target === "all") exports.matches = exportMatchesCsv(matchesData, deckDefinitions);
  if (target === "players" || target === "all") exports.players = exportPlayersCsv(matchesData);
  if (target === "decks" || target === "all") exports.decks = exportDecksCsv(matchesData, deckDefinitions);

  return exports;
}

function writeExports(args, exports) {
  const entries = Object.entries(exports);
  const extension = args.format === "json" ? "json" : "csv";

  if (args.out) {
    fs.writeFileSync(path.resolve(process.cwd(), args.out), entries[0][1]);
    return;
  }

  if (entries.length === 1) {
    process.stdout.write(entries[0][1]);
    return;
  }

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  for (const [target, content] of entries) {
    fs.writeFileSync(path.join(EXPORT_DIR, `${args.year}-${target}.${extension}`), content);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const exports = buildExports(args);
  writeExports(args, exports);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildBackupJson,
  buildExports,
  csvCell,
  exportDecksCsv,
  exportMatchesCsv,
  exportPlayersCsv,
  parseArgs,
  toCsv,
  toJson,
};
