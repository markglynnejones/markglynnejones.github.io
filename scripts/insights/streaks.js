(function initStreaksModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderStreaks = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createStreaksModule() {
  function ensureEntry(stats, key, labelKey) {
    if (!stats.has(key)) {
      stats.set(key, {
        [labelKey]: key,
        currentWinStreak: 0,
        bestWinStreak: 0,
      });
    }

    return stats.get(key);
  }

  function recordAppearance(entry, didWin) {
    if (didWin) {
      entry.currentWinStreak += 1;
      entry.bestWinStreak = Math.max(entry.bestWinStreak, entry.currentWinStreak);
      return;
    }

    entry.currentWinStreak = 0;
  }

  function sortedByLabel(entries, labelKey) {
    return Array.from(entries.values()).sort((a, b) => a[labelKey].localeCompare(b[labelKey]));
  }

  function playerResultsForMatch(match) {
    const players = Array.isArray(match?.players) ? match.players : [];
    const results = new Map();

    for (const player of players) {
      const name = player?.name;
      if (!name || results.has(name)) continue;

      results.set(name, match.winner === name);
    }

    return results;
  }

  function deckResultsForMatch(match) {
    const players = Array.isArray(match?.players) ? match.players : [];
    const results = new Map();

    for (const player of players) {
      const deckId = player?.deckId;
      if (!deckId) continue;

      const didWin = match.winner === player?.name;
      results.set(deckId, (results.get(deckId) ?? false) || didWin);
    }

    return results;
  }

  function buildPlayerWinStreaks(matchFile) {
    const stats = new Map();

    for (const match of matchFile?.matches ?? []) {
      for (const [name, didWin] of playerResultsForMatch(match)) {
        recordAppearance(ensureEntry(stats, name, "name"), didWin);
      }
    }

    return sortedByLabel(stats, "name");
  }

  function buildDeckWinStreaks(matchFile) {
    const stats = new Map();

    for (const match of matchFile?.matches ?? []) {
      for (const [deckId, didWin] of deckResultsForMatch(match)) {
        recordAppearance(ensureEntry(stats, deckId, "deckId"), didWin);
      }
    }

    return sortedByLabel(stats, "deckId");
  }

  function buildWinStreaks(matchFile) {
    return {
      players: buildPlayerWinStreaks(matchFile),
      decksById: buildDeckWinStreaks(matchFile),
    };
  }

  return {
    buildDeckWinStreaks,
    buildPlayerWinStreaks,
    buildWinStreaks,
  };
});
