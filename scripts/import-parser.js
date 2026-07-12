(function initImportParserModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./player-ids"));
  } else {
    root.CommanderImportParser = factory(root.CommanderPlayerIds);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createImportParserModule(playerIds) {
const { buildPlayerLookup, playerIdFromName } = playerIds;

const METADATA_KEYS = new Set(["schemaVersion"]);

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

function uniqueById(decks) {
  const seen = new Set();
  const unique = [];
  for (const deck of decks) {
    if (seen.has(deck.id)) continue;
    seen.add(deck.id);
    unique.push(deck);
  }
  return unique;
}

function commanderText(deck) {
  return (Array.isArray(deck.commander) ? deck.commander : [deck.commander]).filter(Boolean).join(" / ");
}

function deckLabel(deck) {
  const commander = commanderText(deck);
  return commander ? `${deck.id}: ${deck.name} (${commander})` : `${deck.id}: ${deck.name}`;
}

function deckSearchValues(deck) {
  const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander];
  return [deck.id, deck.name, ...(deck.aliases || []), ...commanders.filter(Boolean)].filter(Boolean);
}

function scoreDeckAgainstTokens(deck, tokens) {
  const deckValues = deckSearchValues(deck).map(normalise);
  let score = 0;

  for (const token of tokens) {
    if (!token) continue;
    const tokenWords = token.split(" ").filter(Boolean);
    for (const value of deckValues) {
      if (!value) continue;
      if (value === token) score += 100;
      else if (value.includes(token)) score += 50;
      else if (token.includes(value)) score += 40;

      const valueWords = new Set(value.split(" ").filter(Boolean));
      for (const word of tokenWords) {
        if (valueWords.has(word)) score += 10;
        else if ([...valueWords].some((valueWord) => valueWord.startsWith(word) || word.startsWith(valueWord))) score += 4;
      }
    }
  }

  return score;
}

function closestDecks(tokens, decks, limit = 5) {
  return decks
    .map((deck) => ({ deck, score: scoreDeckAgainstTokens(deck, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.deck.name.localeCompare(b.deck.name))
    .slice(0, limit)
    .map((entry) => entry.deck);
}

function suggestedDeckStub(tokens) {
  const source = tokens.map((token) => token.trim()).filter(Boolean).at(-1) || tokens[0] || "unknown deck";
  const name = titleCase(source);
  return {
    id: slugify(source),
    name,
    commander: "",
    active: true,
    aliases: [normalise(source)],
  };
}

function formatResolveError(message, tokens, decks) {
  const normalisedTokens = tokens.map(normalise).filter(Boolean);
  const suggestions = closestDecks(normalisedTokens, decks);
  const lines = [message];

  if (suggestions.length) {
    lines.push("Closest existing decks:");
    suggestions.forEach((deck) => lines.push(`  - ${deckLabel(deck)}`));
  }

  lines.push("Suggested new deck stub:");
  lines.push(JSON.stringify(suggestedDeckStub(tokens), null, 2));
  return lines.join("\n");
}

function buildPlayerAliases(aliasData) {
  const aliases = new Map();
  for (const [alias, canonical] of Object.entries(aliasData || {})) {
    if (METADATA_KEYS.has(alias)) continue;
    aliases.set(normalise(alias), canonical);
  }
  return aliases;
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
  const exactMatches = [];

  for (const token of normalisedTokens) {
    const exact = lookup.exact.get(token) || [];
    if (exact.length === 1) exactMatches.push({ token, deck: exact[0] });
    if (exact.length > 1) {
      return {
        error: formatResolveError(
          `Ambiguous deck token "${token}" matched ${exact.map((deck) => deck.name).join(", ")}.`,
          tokens,
          exact
        ),
      };
    }
  }

  const exactDecks = uniqueById(exactMatches.map((match) => match.deck));
  if (exactDecks.length === 1) return { deckId: exactDecks[0].id, matched: exactMatches[0].token };
  if (exactDecks.length > 1) {
    return {
      error: formatResolveError(
        `Conflicting deck tokens "${tokens.join(" / ")}" matched ${exactDecks.map((deck) => deck.name).join(", ")}.`,
        tokens,
        exactDecks
      ),
    };
  }

  const containsMatches = [];
  for (const token of normalisedTokens) {
    const contains = lookup.decks.filter((deck) => deckSearchValues(deck).some((key) => normalise(key).includes(token)));
    if (contains.length === 1) containsMatches.push({ token, deck: contains[0] });
    if (contains.length > 1) {
      return {
        error: formatResolveError(
          `Ambiguous deck token "${token}" matched ${contains.map((deck) => deck.name).join(", ")}.`,
          tokens,
          contains
        ),
      };
    }
  }

  const containsDecks = uniqueById(containsMatches.map((match) => match.deck));
  if (containsDecks.length === 1) return { deckId: containsDecks[0].id, matched: containsMatches[0].token };
  if (containsDecks.length > 1) {
    return {
      error: formatResolveError(
        `Conflicting deck tokens "${tokens.join(" / ")}" matched ${containsDecks.map((deck) => deck.name).join(", ")}.`,
        tokens,
        containsDecks
      ),
    };
  }

  return { error: formatResolveError(`Couldn't resolve deck from "${tokens.join(" / ")}".`, tokens, lookup.decks) };
}

function canonicalPlayerName(name, playerAliases) {
  const key = normalise(name);
  return playerAliases.get(key) || titleCase(name);
}

function parsePlayerLine(line, deckDefinitions, playerAliases, playerLookup) {
  const parts = String(line || "")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return { error: `Can't parse line "${line}". Expected: Player - Deck [- win].` };

  const name = canonicalPlayerName(parts[0], playerAliases);
  const playerId = playerLookup?.byName.get(normalise(name))?.id || playerIdFromName(name);
  const hasWin = parts.some((part) => normalise(part) === "win");
  const deckTokens = parts.slice(1).filter((part) => normalise(part) !== "win");
  const resolved = resolveDeck(deckTokens, deckDefinitions);

  if (resolved.error) return { error: `Line: "${line}".\n${resolved.error}` };
  return { player: { playerId, name, deckId: resolved.deckId }, winner: hasWin ? name : null, winnerId: hasWin ? playerId : null };
}

function parseNotes(text, fallbackYear, deckDefinitions, playerAliases = new Map(), playerDefinitions = null) {
  const playerLookup = playerDefinitions ? buildPlayerLookup(playerDefinitions, Object.fromEntries(playerAliases)) : null;
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

  blocks.forEach((block, index) => {
    const date = block.map((line) => parseDateFromLine(line, fallbackYear)).find(Boolean) || fallbackDate;
    if (!date) {
      errors.push(`Block ${index + 1}: no date found.`);
      return;
    }

    const playerLines = block.filter((line) => !parseDateFromLine(line, fallbackYear));
    const players = [];
    let winner = null;
    let winnerId = null;

    for (const line of playerLines) {
      const parsed = parsePlayerLine(line, deckDefinitions, playerAliases, playerLookup);
      if (parsed.error) {
        errors.push(`Block ${index + 1}: ${parsed.error}`);
        return;
      }

      players.push(parsed.player);

      if (parsed.winner) {
        if (winner && winner !== parsed.winner) {
          errors.push(`Block ${index + 1}: multiple winners marked.`);
          return;
        }
        winner = parsed.winner;
        winnerId = parsed.winnerId;
      }
    }

    const playerIds = players.map((player) => player.playerId);
    if (players.length < 2) {
      errors.push(`Block ${index + 1}: need at least two players.`);
      return;
    }
    if (new Set(playerIds).size !== playerIds.length) {
      errors.push(`Block ${index + 1}: duplicate player name.`);
      return;
    }
    if (!winner) {
      errors.push(`Block ${index + 1}: no winner marked.`);
      return;
    }

    matches.push({ date, players, winner, winnerId });
  });

  return { matches, errors };
}

return {
  buildPlayerAliases,
  deckLabel,
  normalise,
  parseDateFromLine,
  parseNotes,
  resolveDeck,
  splitIntoBlocks,
  suggestedDeckStub,
};
});
