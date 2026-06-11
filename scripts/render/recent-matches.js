"use strict";

(function initCommanderRecentMatches(global) {
  function renderLatestSessionSummary(config) {
    const {
      selectedTab,
      matches,
      buildLatestSessionSummary,
      shortDisplayDate,
    } = config;
    const container = document.getElementById("latest-session-summary");
    if (!container) return;

    container.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      container.hidden = true;
      return;
    }

    const summary = buildLatestSessionSummary(matches);
    if (!summary.date) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    const heading = document.createElement("h3");
    heading.textContent = `Latest session: ${shortDisplayDate(summary.date)}`;

    const stats = document.createElement("div");
    stats.className = "latest-session-stats";

    const statItems = [
      ["Games", summary.matchesPlayed],
      ["Players", summary.players.length],
      ["Decks", summary.deckIds.length],
    ];

    for (const [label, value] of statItems) {
      const item = document.createElement("div");
      const valueEl = document.createElement("strong");
      const labelEl = document.createElement("span");

      valueEl.textContent = String(value);
      labelEl.textContent = label;
      item.appendChild(valueEl);
      item.appendChild(labelEl);
      stats.appendChild(item);
    }

    const winners = document.createElement("p");
    winners.className = "latest-session-winners";
    winners.textContent = summary.winsByPlayer.length
      ? summary.winsByPlayer.map((player) => `${player.name} ${player.wins}`).join(" · ")
      : "No winners recorded";

    container.appendChild(heading);
    container.appendChild(stats);
    container.appendChild(winners);
  }

  function renderRecentMatches(config) {
    const {
      selectedTab,
      matches,
      recentMatchesLimit,
      nextRecentMatchLimit,
      safeISODate,
      shortDisplayDate,
      deckNameFromId,
    } = config;
    const body = document.getElementById("recent-matches-body");
    const note = document.getElementById("recent-matches-note");
    const showMoreButton = document.getElementById("show-more-recent-matches");
    if (!body || !note) return;

    body.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      if (showMoreButton) showMoreButton.hidden = true;
      return;
    }

    const datedMatches = [...(matches?.matches ?? [])]
      .filter((match) => safeISODate(match.date))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const recent = datedMatches.slice(0, recentMatchesLimit);

    note.textContent = recent.length
      ? `Latest ${recent.length} of ${datedMatches.length} matches from the 2026 match log.`
      : "No 2026 matches logged yet.";

    if (showMoreButton) {
      const nextLimit = nextRecentMatchLimit();
      const hasMore = recent.length < datedMatches.length && nextLimit > recentMatchesLimit;
      showMoreButton.hidden = !hasMore;
      showMoreButton.textContent = `Show ${nextLimit} matches`;
    }

    for (const match of recent) {
      const tr = document.createElement("tr");
      const tdDate = document.createElement("th");
      const tdWinner = document.createElement("td");
      const tdPod = document.createElement("td");
      const players = match.players || [];

      tdDate.scope = "row";
      tdDate.textContent = shortDisplayDate(match.date);
      tdWinner.textContent = match.winner || "Unknown";
      tdPod.className = "recent-pod";

      const playerLine = document.createElement("p");
      playerLine.textContent = players.map((player) => player.name).join(" · ");

      const deckLine = document.createElement("p");
      deckLine.textContent = players.map((player) => `(${deckNameFromId(player.deckId)})`).join(" · ");

      tdPod.appendChild(playerLine);
      tdPod.appendChild(deckLine);

      tr.appendChild(tdDate);
      tr.appendChild(tdWinner);
      tr.appendChild(tdPod);
      body.appendChild(tr);
    }
  }

  const api = {
    renderLatestSessionSummary,
    renderRecentMatches,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderRecentMatches = api;
})(typeof window !== "undefined" ? window : globalThis);
