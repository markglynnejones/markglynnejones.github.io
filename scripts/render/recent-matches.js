"use strict";

(function initCommanderRecentMatches(global) {
  let matchDetailsById = new Map();
  let matchDetailsLoaded = false;
  let matchDetailsPromise = null;
  let renderCounter = 0;

  function ordinal(value) {
    const number = Number(value);
    if (!Number.isInteger(number)) return String(value);

    const mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${number}th`;

    switch (number % 10) {
      case 1:
        return `${number}st`;
      case 2:
        return `${number}nd`;
      case 3:
        return `${number}rd`;
      default:
        return `${number}th`;
    }
  }

  function loadMatchDetails() {
    if (matchDetailsLoaded) return Promise.resolve();
    if (matchDetailsPromise) return matchDetailsPromise;

    const isSampleMode = new URLSearchParams(global.location?.search || "").get("sample") === "1";
    if (isSampleMode || typeof global.fetch !== "function") {
      matchDetailsLoaded = true;
      return Promise.resolve();
    }

    matchDetailsPromise = global
      .fetch("data/match-details-2026.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load match details (${response.status}).`);
        return response.json();
      })
      .then((data) => {
        matchDetailsById = new Map(
          (data?.matches || []).map((match) => [
            match.matchId,
            new Map((match.players || []).map((player) => [player.playerId, player])),
          ])
        );
      })
      .catch((error) => {
        console.warn("Could not load match order/finish details.", error);
        matchDetailsById = new Map();
      })
      .finally(() => {
        matchDetailsLoaded = true;
      });

    return matchDetailsPromise;
  }

  function outcomeText(detail, playerCount) {
    const finishPosition = Number(detail?.finishPosition);
    if (!Number.isInteger(finishPosition) || finishPosition < 1) return "";
    if (finishPosition === 1) return "Winner";

    const eliminationOrder = playerCount - finishPosition + 1;
    if (!Number.isInteger(eliminationOrder) || eliminationOrder < 1) return ordinal(finishPosition);
    return `Out ${ordinal(eliminationOrder)}`;
  }

  function appendMatchDetailsTable(container, match, players, details, deckNameFromId) {
    const orderedPlayers = [...players].sort((a, b) => {
      const aOrder = Number(details.get(a.playerId)?.playerOrder);
      const bOrder = Number(details.get(b.playerId)?.playerOrder);
      const safeA = Number.isInteger(aOrder) ? aOrder : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isInteger(bOrder) ? bOrder : Number.MAX_SAFE_INTEGER;
      return safeA - safeB;
    });

    const table = document.createElement("table");
    table.className = "recent-pod-table";

    const caption = document.createElement("caption");
    caption.textContent = `Player order and result for ${match.id || "this match"}`;
    table.appendChild(caption);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of ["Player #", "Player", "Deck", "Result"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const player of orderedPlayers) {
      const detail = details.get(player.playerId);
      const playerOrder = Number(detail?.playerOrder);
      const outcome = outcomeText(detail, players.length);
      const row = document.createElement("tr");
      const values = [
        Number.isInteger(playerOrder) ? `P${playerOrder}` : "—",
        player.name || "Unknown",
        deckNameFromId(player.deckId),
        outcome || "—",
      ];

      values.forEach((value, index) => {
        const cell = index === 1 ? document.createElement("th") : document.createElement("td");
        if (index === 1) cell.scope = "row";
        cell.textContent = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

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

    const renderId = ++renderCounter;
    body.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      if (showMoreButton) showMoreButton.hidden = true;
      return;
    }

    if (!matchDetailsLoaded) {
      loadMatchDetails().then(() => {
        if (renderId === renderCounter) renderRecentMatches(config);
      });
    }

    const datedMatches = [...(matches?.matches ?? [])]
      .filter((match) => safeISODate(match.date))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const recent = datedMatches.slice(0, recentMatchesLimit);
    const hasMatchDetails = recent.some((match) => matchDetailsById.has(match.id));

    note.textContent = recent.length
      ? `Latest ${recent.length} of ${datedMatches.length} matches from the 2026 match log.${hasMatchDetails ? " Player # = turn order; Result = winner/elimination order." : ""}`
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
      const details = matchDetailsById.get(match.id);

      tdDate.scope = "row";
      tdDate.textContent = shortDisplayDate(match.date);
      tdWinner.textContent = match.winner || "Unknown";
      tdPod.className = "recent-pod";

      if (details) {
        appendMatchDetailsTable(tdPod, match, players, details, deckNameFromId);
      } else {
        const playerLine = document.createElement("p");
        playerLine.textContent = players.map((player) => player.name).join(" · ");

        const deckLine = document.createElement("p");
        deckLine.textContent = players.map((player) => `(${deckNameFromId(player.deckId)})`).join(" · ");

        tdPod.appendChild(playerLine);
        tdPod.appendChild(deckLine);
      }

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
