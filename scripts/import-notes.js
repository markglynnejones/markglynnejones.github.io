#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { assignMissingMatchIds, createMatchIdGenerator } = require("./match-ids");
const ImportParser = require("./import-parser");
const { assignMissingSessionIds } = require("./session-ids");

const REPO_ROOT = path.resolve(__dirname, "..");
const DECKS_PATH = path.join(REPO_ROOT, "data", "deck-definitions.json");
const PLAYERS_PATH = path.join(REPO_ROOT, "data", "player-definitions.json");
const PLAYER_ALIASES_PATH = path.join(REPO_ROOT, "data", "player-aliases.json");
const CURRENT_SCHEMA_VERSION = 1;

function usage() {
  console.log(`Usage: node scripts/import-notes.js <notes-file> [--year 2026] [--write]

Preview is the default. Add --write to update data/deck-definitions.json and data/matches-YYYY.json.`);
}

function parseArgs(argv) {
  const args = { file: null, year: String(new Date().getFullYear()), write: false };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--year") {
      args.year = argv[i + 1];
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (!args.file) {
      args.file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!/^\d{4}$/.test(String(args.year))) throw new Error("--year must be a 4 digit year.");
  return args;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  if (/matches-\d{4}\.json$/.test(filePath) && Array.isArray(data.matches)) {
    fs.writeFileSync(filePath, formatMatchesData(data));
    return;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function formatMatchesData(data) {
  const schemaVersion = data.schemaVersion || CURRENT_SCHEMA_VERSION;
  const lines = ["{", `  "schemaVersion": ${JSON.stringify(schemaVersion)},`, '  "matches": ['];

  data.matches.forEach((match, matchIndex) => {
    lines.push("    {");
    if (match.id) lines.push(`      "id": ${JSON.stringify(match.id)},`);
    if (match.sessionId) lines.push(`      "sessionId": ${JSON.stringify(match.sessionId)},`);
    lines.push(`      "date": ${JSON.stringify(match.date)},`);
    lines.push('      "players": [');
    match.players.forEach((player, playerIndex) => {
      const suffix = playerIndex === match.players.length - 1 ? "" : ",";
      lines.push(
        `        { "playerId": ${JSON.stringify(player.playerId)}, "name": ${JSON.stringify(player.name)}, "deckId": ${JSON.stringify(player.deckId)} }${suffix}`
      );
    });
    lines.push("      ],");
    const hasNotes = typeof match.notes === "string";
    const hasTags = Array.isArray(match.tags);
    lines.push(`      "winner": ${JSON.stringify(match.winner)},`);
    lines.push(`      "winnerId": ${JSON.stringify(match.winnerId)}${hasNotes || hasTags ? "," : ""}`);
    if (hasNotes) lines.push(`      "notes": ${JSON.stringify(match.notes)}${hasTags ? "," : ""}`);
    if (hasTags) lines.push(`      "tags": ${JSON.stringify(match.tags)}`);
    lines.push(`    }${matchIndex === data.matches.length - 1 ? "" : ","}`);
  });

  lines.push("  ]");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function appendMatches(matchesData, matches) {
  if (!Array.isArray(matchesData.matches)) matchesData.matches = [];
  assignMissingMatchIds(matchesData.matches);
  assignMissingSessionIds(matchesData.matches);

  const existing = new Set(matchesData.matches.map(ImportParser.matchSignature));
  const nextMatchId = createMatchIdGenerator(matchesData.matches);
  let added = 0;
  let skipped = 0;

  for (const match of matches) {
    const signature = ImportParser.matchSignature(match);
    if (existing.has(signature)) {
      skipped += 1;
      continue;
    }

    if (!match.id) match.id = nextMatchId(match.date);
    matchesData.matches.push(match);
    assignMissingSessionIds(matchesData.matches);
    existing.add(signature);
    added += 1;
  }

  matchesData.matches.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { added, skipped };
}

function summariseDeckDefinitionChanges(beforeData, afterData) {
  const beforeById = new Map((beforeData?.decks || []).map((deck) => [deck.id, deck]));
  const afterById = new Map((afterData?.decks || []).map((deck) => [deck.id, deck]));
  const added = [];
  const changed = [];

  for (const [id, afterDeck] of afterById.entries()) {
    const beforeDeck = beforeById.get(id);
    if (!beforeDeck) {
      added.push(afterDeck);
      continue;
    }

    if (JSON.stringify(beforeDeck) !== JSON.stringify(afterDeck)) changed.push(afterDeck);
  }

  return { added, changed };
}

function printDeckDefinitionChanges(beforeData, afterData) {
  const { added, changed } = summariseDeckDefinitionChanges(beforeData, afterData);

  if (!added.length && !changed.length) {
    console.log("Deck definitions: no changes made by importer.");
    return;
  }

  console.log("Deck definitions:");
  for (const deck of added) console.log(`  added ${ImportParser.deckLabel(deck)}`);
  for (const deck of changed) console.log(`  changed ${ImportParser.deckLabel(deck)}`);
}

function printSummary(result, deckDefinitions) {
  const deckById = new Map((deckDefinitions.decks || []).map((deck) => [deck.id, deck]));

  if (result.matches.length) {
    console.log("Matches:");
    result.matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.date} - winner: ${match.winner}`);
      for (const player of match.players) {
        const deckName = deckById.get(player.deckId)?.name || player.deckId;
        console.log(`   ${player.name}: ${deckName} [${player.deckId}]`);
      }
    });
    console.log("");
  }

  if (result.errors.length) {
    console.log("Errors:");
    for (const error of result.errors) console.log(`- ${error}`);
    console.log("");
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const notesPath = path.resolve(process.cwd(), args.file);
  const deckDefinitions = readJson(DECKS_PATH, { decks: [] });
  const deckDefinitionsBeforeWrite = JSON.parse(JSON.stringify(deckDefinitions));
  const playerDefinitions = readJson(PLAYERS_PATH, { players: [] });
  const playerAliases = ImportParser.buildPlayerAliases(readJson(PLAYER_ALIASES_PATH, {}));
  const notes = fs.readFileSync(notesPath, "utf8");
  const result = ImportParser.parseNotes(notes, args.year, deckDefinitions, playerAliases, playerDefinitions);

  printSummary(result, deckDefinitions);

  if (result.errors.length) {
    console.log("No files changed. Fix the notes or aliases above and run again.");
    process.exit(1);
  }

  if (!args.write) {
    console.log("Preview only. Re-run with --write to update JSON.");
    return;
  }

  const years = Array.from(new Set(result.matches.map((match) => match.date.slice(0, 4))));
  console.log(`Parsed ${result.matches.length} match(es).`);
  printDeckDefinitionChanges(deckDefinitionsBeforeWrite, deckDefinitions);
  for (const year of years) {
    const matchesPath = path.join(REPO_ROOT, "data", `matches-${year}.json`);
    const matchesData = readJson(matchesPath, { matches: [] });
    const { added, skipped } = appendMatches(matchesData, result.matches.filter((match) => match.date.startsWith(year)));
    writeJson(matchesPath, matchesData);
    console.log(`Updated ${path.relative(REPO_ROOT, matchesPath)}: added ${added}, skipped ${skipped} already imported.`);
  }
}

module.exports = {
  appendMatches,
  buildPlayerAliases: ImportParser.buildPlayerAliases,
  formatMatchesData,
  parseNotes: ImportParser.parseNotes,
  resolveDeck: ImportParser.resolveDeck,
  summariseDeckDefinitionChanges,
  suggestedDeckStub: ImportParser.suggestedDeckStub,
};

if (require.main === module) {
  main();
}
