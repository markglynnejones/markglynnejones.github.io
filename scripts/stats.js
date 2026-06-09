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
        deckId: deckStats.deckId,
        name: def?.name ?? deckStats.deckId,
        commanders: commanderList(def),
        owner: def?.owner ?? "",
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

  function buildSessionSummaries(matchFile) {
    const sessionsByDate = new Map();

    for (const match of matchFile?.matches ?? []) {
      if (!safeISODate(match.date)) continue;
      if (!sessionsByDate.has(match.date)) {
        sessionsByDate.set(match.date, {
          date: match.date,
          matchesPlayed: 0,
          players: new Set(),
          deckIds: new Set(),
          winsByPlayer: new Map(),
        });
      }

      const session = sessionsByDate.get(match.date);
      session.matchesPlayed += 1;
      if (match.winner) session.winsByPlayer.set(match.winner, (session.winsByPlayer.get(match.winner) ?? 0) + 1);

      for (const player of match.players || []) {
        if (player.name) session.players.add(player.name);
        if (player.deckId) session.deckIds.add(player.deckId);
      }
    }

    return Array.from(sessionsByDate.values())
      .map((session) => ({
        date: session.date,
        matchesPlayed: session.matchesPlayed,
        players: Array.from(session.players).sort(),
        deckIds: Array.from(session.deckIds).sort(),
        winsByPlayer: Array.from(session.winsByPlayer.entries())
          .map(([name, wins]) => ({ name, wins }))
          .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function latestMatchDate(matchFile) {
    const dates = (matchFile?.matches ?? [])
      .map((match) => match.date)
      .filter((date) => safeISODate(date))
      .sort();

    return dates.at(-1) || "";
  }

  function buildLatestSessionSummary(matchFile) {
    return buildSessionSummaries(matchFile)[0] || {
      date: "",
      matchesPlayed: 0,
      players: [],
      deckIds: [],
      winsByPlayer: [],
    };
  }

  function buildDashboardSummary(config) {
    const { players = [], decks = [], matchFile = null } = config || {};
    const activePlayers = players.filter((player) => (player.matchesPlayed ?? 0) > 0);
    const playedDecks = decks.filter((deck) => (deck.matchesPlayed ?? 0) > 0);
    const sessions = matchFile ? buildSessionSummaries(matchFile) : [];
    const totalMatches = players.reduce((total, player) => total + (player.wins ?? 0), 0);

    const topPlayer = activePlayers
      .slice()
      .sort(
        (a, b) =>
          (b.wins ?? 0) - (a.wins ?? 0) ||
          winRate(b.wins, b.matchesPlayed) - winRate(a.wins, a.matchesPlayed) ||
          String(a.name).localeCompare(String(b.name))
      )[0] || null;

    const bestWinRatePlayer = activePlayers
      .slice()
      .sort(
        (a, b) =>
          winRate(b.wins, b.matchesPlayed) - winRate(a.wins, a.matchesPlayed) ||
          (b.wins ?? 0) - (a.wins ?? 0) ||
          String(a.name).localeCompare(String(b.name))
      )[0] || null;

    const mostPlayedDeck = playedDecks
      .slice()
      .sort(
        (a, b) =>
          (b.matchesPlayed ?? 0) - (a.matchesPlayed ?? 0) ||
          (b.wins ?? 0) - (a.wins ?? 0) ||
          String(a.name).localeCompare(String(b.name))
      )[0] || null;

    return {
      totalMatches,
      sessionCount: sessions.length,
      latestSessionDate: sessions[0]?.date || "",
      activePlayerCount: activePlayers.length,
      decksPlayedCount: playedDecks.length,
      topPlayer: topPlayer
        ? {
            name: topPlayer.name,
            wins: topPlayer.wins ?? 0,
            matchesPlayed: topPlayer.matchesPlayed ?? 0,
            winRate: winRate(topPlayer.wins, topPlayer.matchesPlayed),
          }
        : null,
      bestWinRatePlayer: bestWinRatePlayer
        ? {
            name: bestWinRatePlayer.name,
            wins: bestWinRatePlayer.wins ?? 0,
            matchesPlayed: bestWinRatePlayer.matchesPlayed ?? 0,
            winRate: winRate(bestWinRatePlayer.wins, bestWinRatePlayer.matchesPlayed),
          }
        : null,
      mostPlayedDeck: mostPlayedDeck
        ? {
            name: mostPlayedDeck.name,
            wins: mostPlayedDeck.wins ?? 0,
            matchesPlayed: mostPlayedDeck.matchesPlayed ?? 0,
            winRate: winRate(mostPlayedDeck.wins, mostPlayedDeck.matchesPlayed),
          }
        : null,
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
        deckId: deck.id ?? "",
        name: deck.name,
        commanders: commanderList(deck),
        owner: deck.owner ?? "",
        active: !!deck.active,
        wins: deck.wins ?? 0,
        matchesPlayed: deck.matchesPlayed ?? 0,
      });
    }

    for (const deck of decks26) {
      if (!map.has(deck.name)) {
        map.set(deck.name, {
          deckId: deck.deckId ?? "",
          name: deck.name,
          commanders: deck.commanders,
          owner: deck.owner ?? "",
          active: !!deck.active,
          wins: 0,
          matchesPlayed: 0,
        });
      }

      const entry = map.get(deck.name);
      entry.wins += deck.wins ?? 0;
      entry.matchesPlayed += deck.matchesPlayed ?? 0;
      entry.active = entry.active || !!deck.active;
      if (!entry.deckId && deck.deckId) entry.deckId = deck.deckId;
      if (!entry.owner && deck.owner) entry.owner = deck.owner;

      if ((!entry.commanders || entry.commanders.length === 0) && deck.commanders?.length) {
        entry.commanders = deck.commanders;
      }
    }

    return Array.from(map.values());
  }

  return {
    buildDashboardSummary,
    buildMonthlyWins2026,
    buildLatestSessionSummary,
    buildPlayerDeckStats2026,
    buildSessionSummaries,
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
