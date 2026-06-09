(function initFunStatsModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderFunStats = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createFunStatsModule() {
  const DEFAULT_RECENT_LIMIT = 5;
  const DEFAULT_MIN_NEMESIS_MATCHES = 3;
  const DEFAULT_MIN_COMEBACK_MATCHES = 4;
  const DEFAULT_MAX_OVERALL_WIN_RATE = 0.35;
  const DEFAULT_MIN_RECENT_WIN_RATE = 0.5;

  function winRate(wins, matches) {
    if (!matches || matches <= 0) return 0;
    return wins / matches;
  }

  function safeISODate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;

    const date = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10) === dateStr ? date : null;
  }

  function matchList(matchFile) {
    if (Array.isArray(matchFile)) return matchFile;
    return Array.isArray(matchFile?.matches) ? matchFile.matches : [];
  }

  function playerEntries(match) {
    const seen = new Set();
    const entries = [];

    for (const player of Array.isArray(match?.players) ? match.players : []) {
      const name = player?.name;
      const deckId = player?.deckId;
      if (!name || !deckId) continue;

      const key = `${name}\u0000${deckId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ name, deckId });
    }

    return entries;
  }

  function orderedDatedMatches(matches) {
    return matches
      .map((match, index) => ({ match, index, date: safeISODate(match?.date) }))
      .filter((entry) => entry.date)
      .sort((a, b) => String(a.match.date).localeCompare(String(b.match.date)) || a.index - b.index)
      .map((entry) => entry.match);
  }

  function bestBy(rows, compare) {
    const sorted = rows.slice().sort(compare);
    return sorted[0] || null;
  }

  function buildMostLoyalPilot(matchFile) {
    const byPair = new Map();

    for (const match of matchList(matchFile)) {
      for (const player of playerEntries(match)) {
        const key = `${player.name}\u0000${player.deckId}`;
        if (!byPair.has(key)) {
          byPair.set(key, {
            playerName: player.name,
            deckId: player.deckId,
            matchesPlayed: 0,
            wins: 0,
          });
        }

        const entry = byPair.get(key);
        entry.matchesPlayed += 1;
        if (match.winner === player.name) entry.wins += 1;
      }
    }

    const best = bestBy(
      Array.from(byPair.values()),
      (a, b) =>
        b.matchesPlayed - a.matchesPlayed ||
        b.wins - a.wins ||
        a.playerName.localeCompare(b.playerName) ||
        a.deckId.localeCompare(b.deckId)
    );

    return best ? { ...best, winRate: winRate(best.wins, best.matchesPlayed) } : null;
  }

  function buildMostRotatedPlayer(matchFile) {
    const byPlayer = new Map();

    for (const match of matchList(matchFile)) {
      for (const player of playerEntries(match)) {
        if (!byPlayer.has(player.name)) {
          byPlayer.set(player.name, {
            playerName: player.name,
            deckIds: new Set(),
            matchesPlayed: 0,
            wins: 0,
          });
        }

        const entry = byPlayer.get(player.name);
        entry.deckIds.add(player.deckId);
        entry.matchesPlayed += 1;
        if (match.winner === player.name) entry.wins += 1;
      }
    }

    const rows = Array.from(byPlayer.values()).map((entry) => ({
      playerName: entry.playerName,
      uniqueDeckCount: entry.deckIds.size,
      deckIds: Array.from(entry.deckIds).sort(),
      matchesPlayed: entry.matchesPlayed,
      wins: entry.wins,
      winRate: winRate(entry.wins, entry.matchesPlayed),
    }));

    return bestBy(
      rows,
      (a, b) =>
        b.uniqueDeckCount - a.uniqueDeckCount ||
        b.matchesPlayed - a.matchesPlayed ||
        b.wins - a.wins ||
        a.playerName.localeCompare(b.playerName)
    );
  }

  function buildNemesisPairing(matchFile, options = {}) {
    const minSharedMatches = options.minSharedMatches ?? DEFAULT_MIN_NEMESIS_MATCHES;
    const pairs = new Map();

    for (const match of matchList(matchFile)) {
      const players = Array.from(new Set(playerEntries(match).map((player) => player.name))).sort((a, b) =>
        a.localeCompare(b)
      );

      for (let i = 0; i < players.length; i += 1) {
        for (let j = i + 1; j < players.length; j += 1) {
          const playerA = players[i];
          const playerB = players[j];
          const key = `${playerA}\u0000${playerB}`;

          if (!pairs.has(key)) {
            pairs.set(key, {
              playerA,
              playerB,
              sharedMatches: 0,
              playerAWins: 0,
              playerBWins: 0,
              otherWins: 0,
            });
          }

          const pair = pairs.get(key);
          pair.sharedMatches += 1;
          if (match.winner === playerA) pair.playerAWins += 1;
          else if (match.winner === playerB) pair.playerBWins += 1;
          else pair.otherWins += 1;
        }
      }
    }

    const rows = Array.from(pairs.values())
      .filter((pair) => pair.sharedMatches >= minSharedMatches)
      .map((pair) => {
        const leaderName = pair.playerAWins > pair.playerBWins ? pair.playerA : pair.playerB;
        const trailingName = leaderName === pair.playerA ? pair.playerB : pair.playerA;
        const leaderWins = Math.max(pair.playerAWins, pair.playerBWins);
        const trailingWins = Math.min(pair.playerAWins, pair.playerBWins);
        const winMargin = leaderWins - trailingWins;

        return {
          ...pair,
          leaderName,
          trailingName,
          leaderWins,
          trailingWins,
          winMargin,
          leaderWinRate: winRate(leaderWins, pair.sharedMatches),
        };
      })
      .filter((pair) => pair.winMargin > 0);

    return bestBy(
      rows,
      (a, b) =>
        b.winMargin - a.winMargin ||
        b.leaderWinRate - a.leaderWinRate ||
        b.sharedMatches - a.sharedMatches ||
        b.leaderWins - a.leaderWins ||
        a.leaderName.localeCompare(b.leaderName) ||
        a.trailingName.localeCompare(b.trailingName)
    );
  }

  function buildDeckComeback(matchFile, options = {}) {
    const recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;
    const minMatches = options.minMatches ?? DEFAULT_MIN_COMEBACK_MATCHES;
    const maxOverallWinRate = options.maxOverallWinRate ?? DEFAULT_MAX_OVERALL_WIN_RATE;
    const minRecentWinRate = options.minRecentWinRate ?? DEFAULT_MIN_RECENT_WIN_RATE;
    const byDeck = new Map();

    for (const match of orderedDatedMatches(matchList(matchFile))) {
      for (const player of playerEntries(match)) {
        if (!byDeck.has(player.deckId)) {
          byDeck.set(player.deckId, {
            deckId: player.deckId,
            matchesPlayed: 0,
            wins: 0,
            recentResults: [],
          });
        }

        const entry = byDeck.get(player.deckId);
        const didWin = match.winner === player.name;
        entry.matchesPlayed += 1;
        if (didWin) entry.wins += 1;
        entry.recentResults.push(didWin);
      }
    }

    const rows = Array.from(byDeck.values()).map((entry) => {
      const recentResults = entry.recentResults.slice(-recentLimit);
      const recentWins = recentResults.filter(Boolean).length;
      const overallWinRate = winRate(entry.wins, entry.matchesPlayed);
      const recentWinRate = winRate(recentWins, recentResults.length);

      return {
        deckId: entry.deckId,
        matchesPlayed: entry.matchesPlayed,
        wins: entry.wins,
        winRate: overallWinRate,
        recentLimit,
        recentMatchesPlayed: recentResults.length,
        recentWins,
        recentWinRate,
        improvement: recentWinRate - overallWinRate,
      };
    });

    const candidates = rows.filter(
      (entry) =>
        entry.matchesPlayed >= minMatches &&
        entry.recentMatchesPlayed > 0 &&
        entry.winRate <= maxOverallWinRate &&
        entry.recentWinRate >= minRecentWinRate &&
        entry.improvement > 0
    );

    return bestBy(
      candidates,
      (a, b) =>
        b.improvement - a.improvement ||
        b.recentWinRate - a.recentWinRate ||
        b.recentWins - a.recentWins ||
        b.matchesPlayed - a.matchesPlayed ||
        a.deckId.localeCompare(b.deckId)
    );
  }

  function buildFunStats(matchFile, options = {}) {
    return {
      mostLoyalPilot: buildMostLoyalPilot(matchFile),
      nemesisPairing: buildNemesisPairing(matchFile, options.nemesis),
      mostRotatedPlayer: buildMostRotatedPlayer(matchFile),
      deckComeback: buildDeckComeback(matchFile, options.deckComeback),
    };
  }

  return {
    buildDeckComeback,
    buildFunStats,
    buildMostLoyalPilot,
    buildMostRotatedPlayer,
    buildNemesisPairing,
    safeISODate,
    winRate,
  };
});
