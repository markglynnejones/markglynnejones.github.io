"use strict";

(function initCommanderDashboardSummary(global) {
  function card(label, value, detail) {
    const item = document.createElement("article");
    item.className = "summary-card";

    const labelEl = document.createElement("div");
    labelEl.className = "summary-card-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "summary-card-value";
    valueEl.textContent = value;

    const detailEl = document.createElement("div");
    detailEl.className = "summary-card-detail";
    detailEl.textContent = detail || "";

    item.append(labelEl, valueEl, detailEl);
    return item;
  }

  function renderDashboardSummary(config) {
    const { selectedTab, summary, shortDisplayDate, pctText } = config;
    const body = document.getElementById("dashboard-summary-body");
    const note = document.getElementById("dashboard-summary-note");
    if (!body || !note || !summary) return;

    const sessionDetail = selectedTab === "2025" ? "No session log for 2025" : "From the 2026 match log";
    const latestSession = summary.latestSessionDate ? shortDisplayDate(summary.latestSessionDate) : "Not tracked";
    const sessionCount = selectedTab === "2025" ? "Not tracked" : String(summary.sessionCount);
    const topPlayer = summary.topPlayer;
    const bestWinRatePlayer = summary.bestWinRatePlayer;
    const mostPlayedDeck = summary.mostPlayedDeck;

    body.innerHTML = "";
    body.append(
      card("Matches", String(summary.totalMatches), "Total wins recorded"),
      card("Sessions", sessionCount, sessionDetail),
      card("Players", String(summary.activePlayerCount), "With recorded matches"),
      card("Decks Played", String(summary.decksPlayedCount), "With recorded matches"),
      card("Latest Session", latestSession, sessionDetail),
      card(
        "Top Player",
        topPlayer ? topPlayer.name : "None",
        topPlayer ? `${topPlayer.wins} wins, ${pctText(topPlayer.winRate)}` : "No matches yet"
      ),
      card(
        "Best Win Rate",
        bestWinRatePlayer ? bestWinRatePlayer.name : "None",
        bestWinRatePlayer
          ? `${pctText(bestWinRatePlayer.winRate)} across ${bestWinRatePlayer.matchesPlayed} matches`
          : "No matches yet"
      ),
      card(
        "Most Played Deck",
        mostPlayedDeck ? mostPlayedDeck.name : "None",
        mostPlayedDeck ? `${mostPlayedDeck.matchesPlayed} matches, ${mostPlayedDeck.wins} wins` : "No decks played yet"
      )
    );

    note.textContent =
      selectedTab === "overall"
        ? "Overall combines 2025 aggregate stats with the 2026 match log; session cards use 2026 logged sessions."
        : selectedTab === "2025"
          ? "2025 uses aggregate player and deck stats; sessions were not logged separately."
          : "2026 uses the detailed match log.";
  }

  const api = {
    renderDashboardSummary,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderDashboardSummary = api;
})(typeof window !== "undefined" ? window : globalThis);
