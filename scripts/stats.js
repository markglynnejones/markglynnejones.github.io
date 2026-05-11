(function initStatsModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderStats = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createStatsModule() {
  function winRate(wins, matches) {
    if (!matches || matches <= 0) return 0;
    return wins / matches;
  }

  function pctText(rate) {
    return `${(rate * 100).toFixed(2)}%`;
  }

  function safeISODate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;

    const date = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10) === dateStr ? date : null;
  }

  function monthKey(dateObj) {
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function commanderList(deck) {
    return (Array.isArray(deck?.commander) ? deck.commander : [deck?.commander]).filter(Boolean);
  }

  function buildStatsFromMatches(matchFile) {
    const matches = matchFile?.matches ?? [];

    const playerStats = new Map();
    const deckStats = new Map();

    for (const match of matches) {
      const players = Array.isArray(match.players) ? match.players : [];
      const winner = match.winner;

      for (const player of players) {
        const playerName = player?.name;
        const deckId = player?.deckId;
        const didWin = winner && winner === playerName;

        if (playerName) {
          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, { name: playerName, wins: 0, matchesPlayed: 0 });
          }
          const stats = playerStats.get(playerName);
          stats.matchesPlayed += 1;
          if (didWin) stats.wins += 1;
        }

        if (deckId) {
          if (!deckStats.has(deckId)) {
            deckStats.set(deckId, { deckId, wins: 0, matchesPlayed: 0 });
          }
          const stats = deckStats.get(deckId);
          stats.matchesPlayed += 1;
          if (didWin) stats.wins += 1;
        }
      }
    }

    return {
      players: Array.from(playerStats.values()),
      decksById: Array.from(deckStats.values()),
    };
  }

  function decks2026RowsFromStats(decksById, deckDefinitions) {
    const defs = Array.isArray(deckDefinitions?.decks) ? deckDefinitions.decks : [];
    const defById = new Map(defs.map((deck) => [deck.id, deck]));

    return decksById.map((deckStats) => {
      const def = defById.get(deckStats.deckId);

      return {
        name: def?.name ?? deckStats.deckId,
        commanders: commanderList(def),
        active: def?.active ?? true,
        wins: deckStats.wins,
        matchesPlayed: deckStats.matchesPlayed,
      };
    });
  }

  function buildPlayerDeckStats2026(matchFile) {
    const matches = matchFile?.matches ?? [];
    const stats = new Map();

    for (const match of matches) {
      const players = Array.isArray(match.players) ? match.players : [];
      const winner = match.winner;

      for (const player of players) {
        const playerName = player?.name;
        const deckId = player?.deckId;
        if (!playerName || !deckId) continue;

        if (!stats.has(playerName)) stats.set(playerName, new Map());
        const byDeck = stats.get(playerName);

        if (!byDeck.has(deckId)) byDeck.set(deckId, { wins: 0, matchesPlayed: 0 });
        const entry = byDeck.get(deckId);

        entry.matchesPlayed += 1;
        if (winner && winner === playerName) entry.wins += 1;
      }
    }

    return stats;
  }

  function buildMonthlyWins2026(matchFile) {
    const matches = matchFile?.matches ?? [];
    const byMonth = new Map();

    for (const match of matches) {
      const date = safeISODate(match.date);
      if (!date || !match.winner) continue;

      const key = monthKey(date);
      if (!byMonth.has(key)) byMonth.set(key, new Map());
      const winsMap = byMonth.get(key);

      winsMap.set(match.winner, (winsMap.get(match.winner) ?? 0) + 1);
    }

    return {
      months: Array.from(byMonth.keys()).sort(),
      byMonth,
    };
  }

  function latestMatchDate(matchFile) {
    const dates = (matchFile?.matches ?? [])
      .map((match) => match.date)
      .filter((date) => safeISODate(date))
      .sort();

    return dates.at(-1) || "";
  }

  function buildLatestSessionSummary(matchFile) {
    const matches = (matchFile?.matches ?? []).filter((match) => safeISODate(match.date));
    const latestDate = matches.map((match) => match.date).sort().at(-1) || "";
    const sessionMatches = latestDate ? matches.filter((match) => match.date === latestDate) : [];
    const winsByPlayer = new Map();
    const players = new Set();
    const deckIds = new Set();

    for (const match of sessionMatches) {
      if (match.winner) winsByPlayer.set(match.winner, (winsByPlayer.get(match.winner) ?? 0) + 1);

      for (const player of match.players || []) {
        if (player.name) players.add(player.name);
        if (player.deckId) deckIds.add(player.deckId);
      }
    }

    return {
      date: latestDate,
      matchesPlayed: sessionMatches.length,
      players: Array.from(players).sort(),
      deckIds: Array.from(deckIds).sort(),
      winsByPlayer: Array.from(winsByPlayer.entries())
        .map(([name, wins]) => ({ name, wins }))
        .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
    };
  }

  function mergePlayersOverall(players25, players26) {
    const map = new Map();

    for (const player of players25) {
      map.set(player.name, {
        name: player.name,
        wins: player.wins ?? 0,
        matchesPlayed: player.matchesPlayed ?? 0,
      });
    }

    for (const player of players26) {
      if (!map.has(player.name)) map.set(player.name, { name: player.name, wins: 0, matchesPlayed: 0 });
      const entry = map.get(player.name);
      entry.wins += player.wins ?? 0;
      entry.matchesPlayed += player.matchesPlayed ?? 0;
    }

    return Array.from(map.values());
  }

  function mergeDecksOverall(decks25raw, decks26) {
    const map = new Map();

    for (const deck of decks25raw) {
      map.set(deck.name, {
        name: deck.name,
        commanders: commanderList(deck),
        active: !!deck.active,
        wins: deck.wins ?? 0,
        matchesPlayed: deck.matchesPlayed ?? 0,
      });
    }

    for (const deck of decks26) {
      if (!map.has(deck.name)) {
        map.set(deck.name, {
          name: deck.name,
          commanders: deck.commanders,
          active: !!deck.active,
          wins: 0,
          matchesPlayed: 0,
        });
      }

      const entry = map.get(deck.name);
      entry.wins += deck.wins ?? 0;
      entry.matchesPlayed += deck.matchesPlayed ?? 0;
      entry.active = entry.active || !!deck.active;

      if ((!entry.commanders || entry.commanders.length === 0) && deck.commanders?.length) {
        entry.commanders = deck.commanders;
      }
    }

    return Array.from(map.values());
  }

  return {
    buildMonthlyWins2026,
    buildLatestSessionSummary,
    buildPlayerDeckStats2026,
    buildStatsFromMatches,
    decks2026RowsFromStats,
    latestMatchDate,
    mergeDecksOverall,
    mergePlayersOverall,
    monthKey,
    pctText,
    safeISODate,
    winRate,
  };
});
