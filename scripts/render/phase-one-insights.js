"use strict";

(function initCommanderPhaseOneInsights(global) {
  function clearElement(element) {
    if (element) element.innerHTML = "";
  }

  function insightCard(label, value, detail) {
    const card = document.createElement("article");
    card.className = "summary-card";

    const labelEl = document.createElement("div");
    labelEl.className = "summary-card-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "summary-card-value";
    valueEl.textContent = value;

    const detailEl = document.createElement("div");
    detailEl.className = "summary-card-detail";
    detailEl.textContent = detail || "";

    card.append(labelEl, valueEl, detailEl);
    return card;
  }

  function topBy(rows, compare) {
    return rows.slice().sort(compare)[0] || null;
  }

  function renderRecentFormAndStreaks(config) {
    const { selectedTab, recentForm, winStreaks, pctText, deckNameFromId } = config;
    const body = document.getElementById("recent-form-streaks-body");
    const note = document.getElementById("recent-form-streaks-note");
    if (!body || !note) return;

    clearElement(body);

    if (selectedTab === "2025") {
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    const bestRecentPlayer = topBy(
      recentForm?.players || [],
      (a, b) => b.winRate - a.winRate || b.wins - a.wins || b.matchesPlayed - a.matchesPlayed || a.name.localeCompare(b.name)
    );
    const bestRecentDeck = topBy(
      recentForm?.decks || [],
      (a, b) => b.winRate - a.winRate || b.wins - a.wins || b.matchesPlayed - a.matchesPlayed || a.deckId.localeCompare(b.deckId)
    );
    const currentPlayerStreak = topBy(
      winStreaks?.players || [],
      (a, b) => b.currentWinStreak - a.currentWinStreak || b.bestWinStreak - a.bestWinStreak || a.name.localeCompare(b.name)
    );
    const bestPlayerStreak = topBy(
      winStreaks?.players || [],
      (a, b) => b.bestWinStreak - a.bestWinStreak || b.currentWinStreak - a.currentWinStreak || a.name.localeCompare(b.name)
    );
    const currentDeckStreak = topBy(
      winStreaks?.decksById || [],
      (a, b) => b.currentWinStreak - a.currentWinStreak || b.bestWinStreak - a.bestWinStreak || a.deckId.localeCompare(b.deckId)
    );
    const bestDeckStreak = topBy(
      winStreaks?.decksById || [],
      (a, b) => b.bestWinStreak - a.bestWinStreak || b.currentWinStreak - a.currentWinStreak || a.deckId.localeCompare(b.deckId)
    );

    body.append(
      insightCard(
        "Last 5 Player",
        bestRecentPlayer?.name || "None",
        bestRecentPlayer ? `${bestRecentPlayer.wins}-${bestRecentPlayer.losses}, ${pctText(bestRecentPlayer.winRate)}` : "No recent form yet"
      ),
      insightCard(
        "Last 5 Deck",
        bestRecentDeck ? deckNameFromId(bestRecentDeck.deckId) : "None",
        bestRecentDeck ? `${bestRecentDeck.wins}-${bestRecentDeck.losses}, ${pctText(bestRecentDeck.winRate)}` : "No recent form yet"
      ),
      insightCard(
        "Current Player Streak",
        currentPlayerStreak?.currentWinStreak ? currentPlayerStreak.name : "None",
        currentPlayerStreak?.currentWinStreak ? `${currentPlayerStreak.currentWinStreak} wins` : "No active win streak"
      ),
      insightCard(
        "Best Player Streak",
        bestPlayerStreak?.bestWinStreak ? bestPlayerStreak.name : "None",
        bestPlayerStreak?.bestWinStreak ? `${bestPlayerStreak.bestWinStreak} wins` : "No player streaks yet"
      ),
      insightCard(
        "Current Deck Streak",
        currentDeckStreak?.currentWinStreak ? deckNameFromId(currentDeckStreak.deckId) : "None",
        currentDeckStreak?.currentWinStreak ? `${currentDeckStreak.currentWinStreak} wins` : "No active deck streak"
      ),
      insightCard(
        "Best Deck Streak",
        bestDeckStreak?.bestWinStreak ? deckNameFromId(bestDeckStreak.deckId) : "None",
        bestDeckStreak?.bestWinStreak ? `${bestDeckStreak.bestWinStreak} wins` : "No deck streaks yet"
      )
    );

    note.textContent =
      selectedTab === "overall"
        ? "Based on the 2026 match log; 2025 aggregate data cannot support recent form."
        : "Based on the 2026 match log.";
  }

  function renderFunStats(config) {
    const { selectedTab, funStats, pctText, deckNameFromId } = config;
    const body = document.getElementById("fun-stats-body");
    const note = document.getElementById("fun-stats-note");
    if (!body || !note) return;

    clearElement(body);

    if (selectedTab === "2025") {
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    const loyal = funStats?.mostLoyalPilot;
    const nemesis = funStats?.nemesisPairing;
    const rotated = funStats?.mostRotatedPlayer;
    const comeback = funStats?.deckComeback;

    body.append(
      insightCard(
        "Most Loyal Pilot",
        loyal ? loyal.playerName : "None",
        loyal ? `${deckNameFromId(loyal.deckId)}: ${loyal.matchesPlayed} matches` : "No pilot records yet"
      ),
      insightCard(
        "Nemesis Pairing",
        nemesis ? `${nemesis.leaderName} over ${nemesis.trailingName}` : "None",
        nemesis ? `${nemesis.leaderWins}-${nemesis.trailingWins} in ${nemesis.sharedMatches} shared games` : "No clear pairing yet"
      ),
      insightCard(
        "Most Rotated Player",
        rotated ? rotated.playerName : "None",
        rotated ? `${rotated.uniqueDeckCount} decks across ${rotated.matchesPlayed} matches` : "No rotation data yet"
      ),
      insightCard(
        "Deck Comeback",
        comeback ? deckNameFromId(comeback.deckId) : "None",
        comeback
          ? `${pctText(comeback.winRate)} overall, ${pctText(comeback.recentWinRate)} recent`
          : "No comeback candidate yet"
      )
    );

    note.textContent =
      selectedTab === "overall"
        ? "Fun stats are separated from standings and use the 2026 match log only."
        : "Fun stats are separated from standings.";
  }

  const api = {
    renderFunStats,
    renderRecentFormAndStreaks,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderPhaseOneInsights = api;
})(typeof window !== "undefined" ? window : globalThis);
