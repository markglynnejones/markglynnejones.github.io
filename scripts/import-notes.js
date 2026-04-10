#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DECKS_PATH = path.join(REPO_ROOT, "data", "deck-definitions.json");

const PLAYER_ALIASES = new Map([
  ["olly", "Ollie"],
]);

const NEW_DECK_HINTS = [
  {
    id: "bad-misc",
    name: "Bad Misc",
    commander: "Ragost, Deft Gastronaut",
    active: true,
    aliases: ["bad misc", "bd misc", "ragost", "ragost deft gastronomaut"],
    tokens: ["bad misc", "bd misc", "ragost", "ragost deft gastronomaut"],
  },
  {
    id: "big-sues",
    name: "Big Sue's",
    commander: ["Susan Foreman", "The Twelfth Doctor"],
    active: true,
    aliases: ["big sues", "big sue's", "susan foreman", "the twelveth doctor", "the twelfth doctor"],
    tokens: ["big sues", "big sue's", "susan foreman", "the twelveth doctor", "the twelfth doctor"],
  },
];

function usage() {
  console.log(`Usage: node scripts/import-notes.js <notes-file> [--year 2026] [--write]

Preview is the default. Add --write to update data/deck-definitions.json and data/matches-YYYY.json.`);
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

function slugify(value) {
  return normalise(value).replace(/\s+/g, "-");
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  const lines = ["{", '  "matches": ['];

  data.matches.forEach((match, matchIndex) => {
    lines.push("    {");
    lines.push(`      "date": ${JSON.stringify(match.date)},`);
    lines.push('      "players": [');
    match.players.forEach((player, playerIndex) => {
      const suffix = playerIndex === match.players.length - 1 ? "" : ",";
      lines.push(`        { "name": ${JSON.stringify(player.name)}, "deckId": ${JSON.stringify(player.deckId)} }${suffix}`);
    });
    lines.push("      ],");
    lines.push(`      "winner": ${JSON.stringify(match.winner)}`);
    lines.push(`    }${matchIndex === data.matches.length - 1 ? "" : ","}`);
  });

  lines.push("  ]");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function parseDateFromLine(line, fallbackYear) {
  const match = String(line || "").match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : Number(fallbackYear);
  if (year < 100) year = 2000 + year;

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return null;
  return iso;
}

function splitIntoBlocks(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (/^(-{3,}|—{1,}|–{1,})$/.test(line)) {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length) blocks.push(current);
  return blocks;
}

function buildDeckLookup(deckDefinitions) {
  const exact = new Map();
  const decks = deckDefinitions.decks || [];

  function add(key, deck) {
    const normalised = normalise(key);
    if (!normalised) return;
    if (!exact.has(normalised)) exact.set(normalised, []);
    const matches = exact.get(normalised);
    if (!matches.some((match) => match.id === deck.id)) matches.push(deck);
  }

  for (const deck of decks) {
    add(deck.id, deck);
    add(deck.name, deck);
    for (const alias of deck.aliases || []) add(alias, deck);
    const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander];
    for (const commander of commanders.filter(Boolean)) add(commander, deck);
  }

  return { exact, decks };
}

function resolveDeck(tokens, deckDefinitions) {
  const lookup = buildDeckLookup(deckDefinitions);
  const normalisedTokens = tokens.map(normalise).filter(Boolean);

  for (const token of normalisedTokens) {
    const exact = lookup.exact.get(token) || [];
    if (exact.length === 1) return { deckId: exact[0].id, matched: token };
    if (exact.length > 1) return { error: `Ambiguous deck token "${token}".` };
  }

  for (const token of normalisedTokens) {
    const contains = lookup.decks.filter((deck) => {
      const keys = [deck.id, deck.name, ...(deck.aliases || [])];
      const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander];
      keys.push(...commanders.filter(Boolean));
      return keys.some((key) => normalise(key).includes(token));
    });
    if (contains.length === 1) return { deckId: contains[0].id, matched: token };
    if (contains.length > 1) return { error: `Ambiguous deck token "${token}".` };
  }

  for (const hint of NEW_DECK_HINTS) {
    if (normalisedTokens.some((token) => hint.tokens.map(normalise).includes(token))) {
      return { deckId: hint.id, newDeck: hint };
    }
  }

  return { error: `Couldn't resolve deck from "${tokens.join(" / ")}".` };
}

function canonicalPlayerName(name) {
  const key = normalise(name);
  return PLAYER_ALIASES.get(key) || titleCase(name);
}

function parsePlayerLine(line, deckDefinitions) {
  const parts = String(line || "")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return { error: `Can't parse line "${line}". Expected: Player - Deck [- win].` };

  const name = canonicalPlayerName(parts[0]);
  const hasWin = parts.some((part) => normalise(part) === "win");
  const deckTokens = parts.slice(1).filter((part) => normalise(part) !== "win");
  const resolved = resolveDeck(deckTokens, deckDefinitions);

  if (resolved.error) return { error: `${resolved.error} Line: "${line}".` };
  return { player: { name, deckId: resolved.deckId }, winner: hasWin ? name : null, newDeck: resolved.newDeck || null };
}

function parseNotes(text, fallbackYear, deckDefinitions) {
  const blocks = splitIntoBlocks(text);
  let fallbackDate = null;

  for (const block of blocks) {
    for (const line of block) {
      fallbackDate = parseDateFromLine(line, fallbackYear);
      if (fallbackDate) break;
    }
    if (fallbackDate) break;
  }

  const matches = [];
  const errors = [];
  const newDecks = new Map();

  blocks.forEach((block, index) => {
    const date = block.map((line) => parseDateFromLine(line, fallbackYear)).find(Boolean) || fallbackDate;
    if (!date) {
      errors.push(`Block ${index + 1}: no date found.`);
      return;
    }

    const playerLines = block.filter((line) => !parseDateFromLine(line, fallbackYear));
    const players = [];
    let winner = null;

    for (const line of playerLines) {
      const parsed = parsePlayerLine(line, deckDefinitions);
      if (parsed.error) {
        errors.push(`Block ${index + 1}: ${parsed.error}`);
        return;
      }

      players.push(parsed.player);
      if (parsed.newDeck) newDecks.set(parsed.newDeck.id, parsed.newDeck);

      if (parsed.winner) {
        if (winner && winner !== parsed.winner) {
          errors.push(`Block ${index + 1}: multiple winners marked.`);
          return;
        }
        winner = parsed.winner;
      }
    }

    const names = players.map((player) => player.name);
    if (players.length < 2) {
      errors.push(`Block ${index + 1}: need at least two players.`);
      return;
    }
    if (new Set(names).size !== names.length) {
      errors.push(`Block ${index + 1}: duplicate player name.`);
      return;
    }
    if (!winner) {
      errors.push(`Block ${index + 1}: no winner marked.`);
      return;
    }

    matches.push({ date, players, winner });
  });

  return { matches, errors, newDecks: Array.from(newDecks.values()) };
}

function ensureDecks(deckDefinitions, newDecks) {
  const existing = new Set((deckDefinitions.decks || []).map((deck) => deck.id));
  for (const deck of newDecks) {
    if (existing.has(deck.id)) continue;
    const { tokens, ...deckDefinition } = deck;
    deckDefinitions.decks.push(deckDefinition);
    existing.add(deck.id);
  }
}

function matchSignature(match) {
  return `${match.date}|${match.winner}|${match.players.map((player) => `${player.name}:${player.deckId}`).sort().join(",")}`;
}

function appendMatches(matchesData, matches) {
  if (!Array.isArray(matchesData.matches)) matchesData.matches = [];
  const existing = new Set(matchesData.matches.map(matchSignature));
  let added = 0;

  for (const match of matches) {
    const signature = matchSignature(match);
    if (existing.has(signature)) continue;
    matchesData.matches.push(match);
    existing.add(signature);
    added += 1;
  }

  matchesData.matches.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return added;
}

function printSummary(result, deckDefinitions) {
  const deckById = new Map((deckDefinitions.decks || []).map((deck) => [deck.id, deck]));

  if (result.newDecks.length) {
    console.log("New decks:");
    for (const deck of result.newDecks) {
      const commanders = Array.isArray(deck.commander) ? deck.commander.join(" / ") : deck.commander;
      console.log(`- ${deck.id}: ${deck.name} (${commanders})`);
    }
    console.log("");
  }

  if (result.matches.length) {
    console.log("Matches:");
    result.matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.date} - winner: ${match.winner}`);
      for (const player of match.players) {
        const deckName = deckById.get(player.deckId)?.name || result.newDecks.find((deck) => deck.id === player.deckId)?.name || player.deckId;
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
  const notes = fs.readFileSync(notesPath, "utf8");
  const result = parseNotes(notes, args.year, deckDefinitions);

  printSummary(result, deckDefinitions);

  if (result.errors.length) {
    console.log("No files changed. Fix the notes or aliases above and run again.");
    process.exit(1);
  }

  if (!args.write) {
    console.log("Preview only. Re-run with --write to update JSON.");
    return;
  }

  ensureDecks(deckDefinitions, result.newDecks);
  writeJson(DECKS_PATH, deckDefinitions);

  const years = Array.from(new Set(result.matches.map((match) => match.date.slice(0, 4))));
  for (const year of years) {
    const matchesPath = path.join(REPO_ROOT, "data", `matches-${year}.json`);
    const matchesData = readJson(matchesPath, { matches: [] });
    const added = appendMatches(matchesData, result.matches.filter((match) => match.date.startsWith(year)));
    writeJson(matchesPath, matchesData);
    console.log(`Updated ${path.relative(REPO_ROOT, matchesPath)} (${added} new match(es)).`);
  }

  console.log(`Updated ${path.relative(REPO_ROOT, DECKS_PATH)}.`);
}

main();
