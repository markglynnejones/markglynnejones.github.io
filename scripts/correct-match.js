#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createIssueCollector, readDataSet, validateData } = require("./check-data");
const { formatMatchesData } = require("./import-notes");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

const SET_FIELDS = new Set(["winnerId", "notes", "tags"]);
const CLEAR_FIELDS = new Set(["notes", "tags"]);

function usage() {
  console.log(`Usage: node scripts/correct-match.js --id YYYY-MM-DD-001 [--year 2026] [options] [--write]

Preview is the default. Add --write to update data/matches-YYYY.json after validation.

Options:
- --set winnerId=player-id
- --set notes=Some note text
- --set tags=tag-one,tag-two
- --clear notes|tags
- --player-deck player-id=deck-id`);
}

function parseArgs(argv) {
  const args = {
    id: "",
    year: "",
    sets: [],
    clears: [],
    playerDecks: [],
    write: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--id") {
      args.id = argv[i + 1];
      i += 1;
    } else if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "--set") {
      args.sets.push(parseKeyValue(argv[i + 1], "--set"));
      i += 1;
    } else if (arg === "--clear") {
      args.clears.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--player-deck") {
      args.playerDecks.push(parseKeyValue(argv[i + 1], "--player-deck"));
      i += 1;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (args.help) return args;
  if (!args.id) throw new Error("--id is required.");
  if (!/^\d{4}-\d{2}-\d{2}-\d{3}$/.test(args.id)) throw new Error("--id must use YYYY-MM-DD-001 format.");
  if (args.year && !/^\d{4}$/.test(String(args.year))) throw new Error("--year must be a 4 digit year.");
  if (!args.year) args.year = args.id.slice(0, 4);
  if (!args.id.startsWith(`${args.year}-`)) throw new Error("--year must match the year in --id.");

  for (const { key } of args.sets) {
    if (!SET_FIELDS.has(key)) throw new Error(`--set supports: ${Array.from(SET_FIELDS).join(", ")}.`);
  }

  for (const field of args.clears) {
    if (!CLEAR_FIELDS.has(field)) throw new Error(`--clear supports: ${Array.from(CLEAR_FIELDS).join(", ")}.`);
  }

  if (!args.sets.length && !args.clears.length && !args.playerDecks.length) {
    throw new Error("At least one correction option is required.");
  }

  return args;
}

function parseKeyValue(value, label) {
  const text = String(value || "");
  const index = text.indexOf("=");
  if (index <= 0) throw new Error(`${label} must use key=value syntax.`);
  return {
    key: text.slice(0, index),
    value: text.slice(index + 1),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function playerNameById(match, playerId) {
  return (match.players || []).find((player) => player.playerId === playerId)?.name || "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined) return "(unset)";
  return String(value);
}

function pushChange(changes, field, before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  changes.push({ field, before, after });
}

function tagList(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function applyCorrections(matchesData, args) {
  const nextData = clone(matchesData);
  const match = (nextData.matches || []).find((entry) => entry.id === args.id);
  if (!match) throw new Error(`Could not find match ${args.id} in matches-${args.year}.json.`);

  const changes = [];

  for (const { key, value } of args.playerDecks) {
    const player = (match.players || []).find((entry) => entry.playerId === key);
    if (!player) throw new Error(`Match ${args.id} does not include playerId "${key}".`);
    pushChange(changes, `players.${key}.deckId`, player.deckId, value);
    player.deckId = value;
  }

  for (const { key, value } of args.sets) {
    if (key === "winnerId") {
      const winnerName = playerNameById(match, value);
      if (!winnerName) throw new Error(`Match ${args.id} does not include winnerId "${value}".`);
      pushChange(changes, "winnerId", match.winnerId, value);
      pushChange(changes, "winner", match.winner, winnerName);
      match.winnerId = value;
      match.winner = winnerName;
    } else if (key === "notes") {
      pushChange(changes, "notes", match.notes, value);
      match.notes = value;
    } else if (key === "tags") {
      const tags = tagList(value);
      pushChange(changes, "tags", match.tags, tags);
      match.tags = tags;
    }
  }

  for (const field of args.clears) {
    pushChange(changes, field, match[field], undefined);
    delete match[field];
  }

  return { data: nextData, match, changes };
}

function validateCorrectedData(year, correctedMatchesData) {
  const issues = createIssueCollector();
  const dataSet = readDataSet(DATA_DIR, issues);
  const targetLabel = `data/matches-${year}.json`;
  const matchesFile = (dataSet.matchesFiles || []).find((file) => file.label === targetLabel);
  if (!matchesFile) {
    issues.fail(`${targetLabel} was not found.`);
  } else {
    matchesFile.data = correctedMatchesData;
  }

  validateData(dataSet, issues);
  return issues;
}

function printPreview(filePath, matchId, changes, write) {
  console.log(`${path.relative(REPO_ROOT, filePath)} ${matchId}`);
  if (!changes.length) {
    console.log("No changes.");
    return;
  }

  for (const change of changes) {
    console.log(`- ${change.field}: ${formatValue(change.before)} -> ${formatValue(change.after)}`);
  }

  if (write) {
    console.log("Updated JSON.");
  } else {
    console.log("Preview only. Re-run with --write to update JSON.");
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const matchesPath = path.join(DATA_DIR, `matches-${args.year}.json`);
  const matchesData = readJson(matchesPath);
  const result = applyCorrections(matchesData, args);
  const issues = validateCorrectedData(args.year, result.data);

  if (issues.errors.length) {
    console.error(`Correction failed validation with ${issues.errors.length} error(s):`);
    for (const error of issues.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  if (args.write && result.changes.length) fs.writeFileSync(matchesPath, formatMatchesData(result.data));
  printPreview(matchesPath, args.id, result.changes, args.write);
}

if (require.main === module) {
  main();
}

module.exports = {
  applyCorrections,
  parseArgs,
  tagList,
  validateCorrectedData,
};
