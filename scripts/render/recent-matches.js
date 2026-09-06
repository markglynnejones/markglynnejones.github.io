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

  function buildPlacementStats(matches, detailsById = matchDetailsById) {
    const matchesById = new Map((matches?.matches || []).map((match) => [match.id, match]));
    const players = new Map();
    const positions = new Map();
    let recordedMatches = 0;

    for (const [matchId, details] of detailsById.entries()) {
      const match = matchesById.get(matchId);
      const matchPlayers = match?.players || [];
      const playerCount = matchPlayers.length;
      if (!match || playerCount < 2) continue;

      const complete = matchPlayers.every((player) => {
        const detail = details.get(player.playerId);
        const playerOrder = Number(detail?.playerOrder);
        const finishPosition = Number(detail?.finishPosition);
        return (
          Number.isInteger(playerOrder) &&
          playerOrder >= 1 &&
          playerOrder <= playerCount &&
          Number.isInteger(finishPosition) &&
          finishPosition >= 1 &&
          finishPosition <= playerCount
        );
      });
      if (!complete) continue;

      recordedMatches += 1;

      for (const player of matchPlayers) {
        const detail = details.get(player.playerId);
        const playerOrder = Number(detail.playerOrder);
        const finishPosition = Number(detail.finishPosition);

        if (!players.has(player.playerId)) {
          players.set(player.playerId, {
            playerId: player.playerId,
            name: player.name || player.playerId,
            games: 0,
            wins: 0,
            firsts: 0,
            seconds: 0,
            thirds: 0,
            finishSum: 0,
            firstOuts: 0,
          });
        }
        const playerStats = players.get(player.playerId);
        playerStats.games += 1;
        playerStats.finishSum += finishPosition;
        if (finishPosition === 1) {
          playerStats.wins += 1;
          playerStats.firsts += 1;
        }
        if (finishPosition === 2) playerStats.seconds += 1;
        if (finishPosition === 3) playerStats.thirds += 1;
        if (finishPosition === playerCount) playerStats.firstOuts += 1;

        if (!positions.has(playerOrder)) {
          positions.set(playerOrder, { position: playerOrder, games: 0, wins: 0, finishSum: 0 });
        }
        const positionStats = positions.get(playerOrder);
        positionStats.games += 1;
        positionStats.finishSum += finishPosition;
        if (finishPosition === 1) positionStats.wins += 1;
      }
    }

    const byPlayer = [...players.values()]
      .map((entry) => ({
        ...entry,
        averageFinish: entry.games ? entry.finishSum / entry.games : 0,
        firstOutRate: entry.games ? entry.firstOuts / entry.games : 0,
      }))
      .sort((a, b) => a.averageFinish - b.averageFinish || b.wins - a.wins || a.name.localeCompare(b.name));

    const byPosition = [...positions.values()]
      .map((entry) => ({
        ...entry,
        winRate: entry.games ? entry.wins / entry.games : 0,
        averageFinish: entry.games ? entry.finishSum / entry.games : 0,
      }))
      .sort((a, b) => a.position - b.position);

    return { recordedMatches, byPlayer, byPosition };
  }

  function ensurePlacementStatsSection() {
    let section = document.getElementById("placement-stats-section");
    if (section) return section;

    const playersView = document.getElementById("view-players");
    if (!playersView) return null;

    section = document.createElement("section");
    section.id = "placement-stats-section";
    section.setAttribute("aria-labelledby", "placement-stats-heading");
    section.innerHTML = `
      <h2 id="placement-stats-heading" class="section-heading">Turn Order &amp; Placement Stats (2026 match log)</h2>
      <p id="placement-stats-note" class="section-note" aria-live="polite"></p>

      <h3 class="placement-stats-subheading">Player placements</h3>
      <p id="player-placement-scroll-hint" class="table-scroll-hint">Scroll table sideways</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Player placement statistics table, horizontally scrollable" aria-describedby="player-placement-scroll-hint">
        <table id="player-placement-table">
          <caption>Player results from matches with recorded turn order and finishing positions</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Games</th>
              <th scope="col">Wins</th>
              <th scope="col">1st</th>
              <th scope="col">2nd</th>
              <th scope="col">3rd</th>
              <th scope="col">Avg Finish</th>
              <th scope="col">First Out</th>
            </tr>
          </thead>
          <tbody id="player-placement-body"></tbody>
        </table>
      </div>

      <h3 class="placement-stats-subheading">Turn position performance</h3>
      <p id="turn-position-scroll-hint" class="table-scroll-hint">Scroll table sideways</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Turn position statistics table, horizontally scrollable" aria-describedby="turn-position-scroll-hint">
        <table id="turn-position-table">
          <caption>Performance by starting turn position</caption>
          <thead>
            <tr>
              <th scope="col">Position</th>
              <th scope="col">Games</th>
              <th scope="col">Wins</th>
              <th scope="col">Win Rate</th>
              <th scope="col">Avg Finish</th>
            </tr>
          </thead>
          <tbody id="turn-position-body"></tbody>
        </table>
      </div>
    `;

    const winsOverTimeSection = document.querySelector('[aria-labelledby="wins-over-time-heading"]');
    if (winsOverTimeSection?.parentNode === playersView) {
      playersView.insertBefore(section, winsOverTimeSection);
    } else {
      playersView.appendChild(section);
    }
    return section;
  }

  function appendStatsRow(tbody, values, rowHeaderIndex = 0) {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = index === rowHeaderIndex ? document.createElement("th") : document.createElement("td");
      if (index === rowHeaderIndex) cell.scope = "row";
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  }

  function percentage(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
  }

  function renderPlacementStats(config) {
    const section = ensurePlacementStatsSection();
    if (!section) return;

    const show = config.selectedTab === "2026" || config.selectedTab === "overall";
    section.hidden = !show;
    if (!show) return;

    const note = document.getElementById("placement-stats-note");
    const playerBody = document.getElementById("player-placement-body");
    const positionBody = document.getElementById("turn-position-body");
    if (!note || !playerBody || !positionBody) return;

    playerBody.textContent = "";
    positionBody.textContent = "";

    if (!matchDetailsLoaded) {
      note.textContent = "Loading recorded turn-order and placement data…";
      return;
    }

    const stats = buildPlacementStats(config.matches);
    if (!stats.recordedMatches) {
      note.textContent = "No matches have complete recorded turn-order and placement data yet.";
      return;
    }

    note.textContent = `Based on ${stats.recordedMatches} match${stats.recordedMatches === 1 ? "" : "es"} with complete recorded turn order and finishing positions. Older matches without this data are excluded.`;

    for (const player of stats.byPlayer) {
      appendStatsRow(playerBody, [
        player.name,
        player.games,
        player.wins,
        player.firsts,
        player.seconds,
        player.thirds,
        player.averageFinish.toFixed(2),
        `${player.firstOuts} (${percentage(player.firstOutRate)})`,
      ]);
    }

    for (const position of stats.byPosition) {
      appendStatsRow(positionBody, [
        `P${position.position}`,
        position.games,
        position.wins,
        percentage(position.winRate),
        position.averageFinish.toFixed(2),
      ]);
    }
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
    renderPlacementStats(config);

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
    buildPlacementStats,
    renderLatestSessionSummary,
    renderPlacementStats,
    renderRecentMatches,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderRecentMatches = api;
})(typeof window !== "undefined" ? window : globalThis);
