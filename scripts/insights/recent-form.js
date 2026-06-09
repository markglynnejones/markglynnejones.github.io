(function initRecentFormModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderRecentForm = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createRecentFormModule() {
  const DEFAULT_LIMIT = 5;

  function safeISODate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;

    const date = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10) === dateStr ? date : null;
  }

  function winRate(wins, matchesPlayed) {
    if (!matchesPlayed || matchesPlayed <= 0) return 0;
    return wins / matchesPlayed;
  }

  function normalizeLimit(limit) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.floor(parsed);
  }

  function orderedMatches(matchFile) {
    return (Array.isArray(matchFile?.matches) ? matchFile.matches : [])
      .map((match, originalIndex) => ({ match, originalIndex }))
      .filter(({ match }) => safeISODate(match?.date))
      .sort(
        (a, b) =>
          String(a.match.date).localeCompare(String(b.match.date)) ||
          a.originalIndex - b.originalIndex
      );
  }

  function emptyBucket(idKey, idValue) {
    return {
      [idKey]: idValue,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      winRate: 0,
      form: "",
      streak: { result: "", count: 0 },
      results: [],
    };
  }

  function currentStreak(results) {
    if (results.length === 0) return { result: "", count: 0 };

    const latestResult = results[results.length - 1].result;
    let count = 0;

    for (let i = results.length - 1; i >= 0; i -= 1) {
      if (results[i].result !== latestResult) break;
      count += 1;
    }

    return { result: latestResult, count };
  }

  function summarizeBucket(bucket, limit) {
    const recentResults = bucket.results.slice(-limit);
    const wins = recentResults.filter((result) => result.result === "W").length;
    const matchesPlayed = recentResults.length;

    return {
      ...bucket,
      wins,
      losses: matchesPlayed - wins,
      matchesPlayed,
      winRate: winRate(wins, matchesPlayed),
      form: recentResults.map((result) => result.result).join(""),
      streak: currentStreak(recentResults),
      results: recentResults,
    };
  }

  function buildRecentForm(matchFile, options) {
    const limit = normalizeLimit(options?.limit);
    const playersByName = new Map();
    const decksById = new Map();

    for (const { match, originalIndex } of orderedMatches(matchFile)) {
      const players = Array.isArray(match.players) ? match.players : [];
      const winner = match.winner || "";

      for (const player of players) {
        const playerName = player?.name;
        const deckId = player?.deckId;
        if (!playerName) continue;

        const result = winner === playerName ? "W" : "L";
        const baseResult = {
          date: match.date,
          matchIndex: originalIndex,
          result,
          winner,
        };

        if (!playersByName.has(playerName)) {
          playersByName.set(playerName, emptyBucket("name", playerName));
        }

        playersByName.get(playerName).results.push({
          ...baseResult,
          deckId: deckId || "",
        });

        if (!deckId) continue;
        if (!decksById.has(deckId)) {
          decksById.set(deckId, emptyBucket("deckId", deckId));
        }

        decksById.get(deckId).results.push({
          ...baseResult,
          playerName,
        });
      }
    }

    return {
      limit,
      players: Array.from(playersByName.values())
        .map((bucket) => summarizeBucket(bucket, limit))
        .sort((a, b) => a.name.localeCompare(b.name)),
      decks: Array.from(decksById.values())
        .map((bucket) => summarizeBucket(bucket, limit))
        .sort((a, b) => a.deckId.localeCompare(b.deckId)),
    };
  }

  return {
    DEFAULT_LIMIT,
    buildRecentForm,
    orderedMatches,
    safeISODate,
  };
});
