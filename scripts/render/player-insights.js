"use strict";

(function initCommanderPlayerInsights(global) {
  function setPlayerDeckSectionsVisible(isVisible) {
    const select = document.getElementById("player-deck-select");
    const headToHeadSelect = document.getElementById("head-to-head-player-select");
    const chart = document.getElementById("wins-over-time-chart");

    if (select?.closest("section")) select.closest("section").style.display = isVisible ? "" : "none";
    if (headToHeadSelect?.closest("section")) headToHeadSelect.closest("section").style.display = isVisible ? "" : "none";
    if (chart?.closest("section")) chart.closest("section").style.display = isVisible ? "" : "none";
  }

  function wirePlayerDeckSelect(config) {
    const { onChange } = config;
    const select = document.getElementById("player-deck-select");
    if (!select) return;

    select.addEventListener("change", () => {
      onChange(select.value);
    });
  }

  function wireHeadToHeadSelect(config) {
    const { onChange } = config;
    const select = document.getElementById("head-to-head-player-select");
    if (!select) return;

    select.addEventListener("change", () => {
      onChange(select.value);
    });
  }

  function populatePlayerSelect(selectId, playersIn2026) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = "";

    if (!playersIn2026.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No 2026 players";
      select.appendChild(opt);
      return;
    }

    for (const player of playersIn2026) {
      const opt = document.createElement("option");
      opt.value = player;
      opt.textContent = player;
      select.appendChild(opt);
    }
  }

  function populatePlayerDeckSelect(config) {
    populatePlayerSelect("player-deck-select", config.playersIn2026);
  }

  function populateHeadToHeadSelect(config) {
    populatePlayerSelect("head-to-head-player-select", config.playersIn2026);
  }

  function renderPlayerDeckStats(config) {
    const {
      selectedTab,
      playerDeckStats2026,
      playersIn2026,
      selectedPlayer,
      setSelectedPlayer,
      deckNameFromId,
      winRate,
      pctText,
      appendTextCell,
      appendEmptyRow,
    } = config;
    const select = document.getElementById("player-deck-select");
    const body = document.getElementById("player-decks-body");
    const note = document.getElementById("player-deck-note");

    if (!select || !body || !note) return;

    body.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    if (!playerDeckStats2026 || playersIn2026.length === 0) {
      note.textContent = "No 2026 matches yet.";
      return;
    }

    let activePlayer = selectedPlayer;
    if (!activePlayer || !playersIn2026.includes(activePlayer)) {
      activePlayer = playersIn2026[0];
      setSelectedPlayer(activePlayer);
      select.value = activePlayer;
    }

    const byDeck = playerDeckStats2026.get(activePlayer) || new Map();
    const rows = Array.from(byDeck.entries()).map(([deckId, stats]) => ({
      deckId,
      deckName: deckNameFromId(deckId),
      wins: stats.wins,
      matchesPlayed: stats.matchesPlayed,
      winrate: winRate(stats.wins, stats.matchesPlayed),
    }));

    rows.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || a.deckName.localeCompare(b.deckName));

    note.textContent = `Showing ${activePlayer}'s deck performance from 2026 matches.`;

    for (const row of rows) {
      const tr = document.createElement("tr");
      appendTextCell(tr, row.deckName);
      appendTextCell(tr, row.wins);
      appendTextCell(tr, row.matchesPlayed);
      appendTextCell(tr, pctText(row.winrate));
      body.appendChild(tr);
    }

    if (rows.length === 0) {
      appendEmptyRow(body, 4, "No matches logged for this player yet.");
    }
  }

  function renderHeadToHeadStats(config) {
    const {
      selectedTab,
      headToHeadStats2026,
      playersIn2026,
      selectedPlayer,
      setSelectedPlayer,
      pctText,
      winRate,
      appendTextCell,
      appendEmptyRow,
    } = config;
    const select = document.getElementById("head-to-head-player-select");
    const body = document.getElementById("head-to-head-body");
    const note = document.getElementById("head-to-head-note");

    if (!select || !body || !note) return;

    body.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    if (!headToHeadStats2026 || playersIn2026.length === 0) {
      note.textContent = "No 2026 matches yet.";
      return;
    }

    let activePlayer = selectedPlayer;
    if (!activePlayer || !playersIn2026.includes(activePlayer)) {
      activePlayer = playersIn2026[0];
      setSelectedPlayer(activePlayer);
      select.value = activePlayer;
    }

    const rows = headToHeadStats2026
      .filter((pair) => pair.playerA === activePlayer || pair.playerB === activePlayer)
      .map((pair) => {
        const isPlayerA = pair.playerA === activePlayer;
        const opponent = isPlayerA ? pair.playerB : pair.playerA;
        const playerWins = isPlayerA ? pair.playerAWins : pair.playerBWins;
        const opponentWins = isPlayerA ? pair.playerBWins : pair.playerAWins;

        return {
          opponent,
          sharedMatches: pair.sharedMatches,
          playerWins,
          opponentWins,
          otherWins: pair.otherWins,
          playerWinRate: winRate(playerWins, pair.sharedMatches),
        };
      })
      .sort(
        (a, b) =>
          b.sharedMatches - a.sharedMatches ||
          b.playerWins - a.playerWins ||
          a.opponent.localeCompare(b.opponent)
      );

    note.textContent = `Showing ${activePlayer}'s pod records against each opponent from 2026 matches.`;

    for (const row of rows) {
      const tr = document.createElement("tr");
      appendTextCell(tr, row.opponent);
      appendTextCell(tr, row.sharedMatches);
      appendTextCell(tr, row.playerWins);
      appendTextCell(tr, row.opponentWins);
      appendTextCell(tr, row.otherWins);
      appendTextCell(tr, pctText(row.playerWinRate));
      body.appendChild(tr);
    }

    if (rows.length === 0) {
      appendEmptyRow(body, 6, "No shared matches logged for this player yet.");
    }
  }

  function renderWinsOverTimeChart(config) {
    const {
      selectedTab,
      matches,
      buildMonthlyWins2026,
    } = config;
    const container = document.getElementById("wins-over-time-chart");
    const note = document.getElementById("wins-over-time-note");
    if (!container || !note) return;

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      container.innerHTML = "";
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    const { months, byMonth } = buildMonthlyWins2026(matches);

    if (!months.length) {
      container.innerHTML = "";
      note.textContent = "No dated matches in 2026 yet.";
      return;
    }

    const players = new Set();
    for (const monthKey of months) {
      const winsMap = byMonth.get(monthKey);
      for (const player of winsMap.keys()) players.add(player);
    }
    const playerList = Array.from(players).sort();

    const totalsPerMonth = months.map((monthKey) => {
      const winsMap = byMonth.get(monthKey);
      let total = 0;
      for (const value of winsMap.values()) total += value;
      return total;
    });

    const maxTotal = Math.max(...totalsPerMonth, 1);

    note.textContent =
      selectedTab === "overall"
        ? "Overall tab chart is based on 2026 matches only."
        : "Based on 2026 matches.";

    const width = 900;
    const height = 240;
    const padding = 32;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;
    const barCount = months.length;
    const barW = Math.max(18, Math.floor(chartW / barCount) - 6);
    const gap = 6;

    const palette = [
      "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
      "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab",
    ];
    const colorByPlayer = new Map(playerList.map((player, index) => [player, palette[index % palette.length]]));

    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly wins chart">
      <rect x="0" y="0" width="${width}" height="${height}" fill="white"></rect>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333" />
    `;

    months.forEach((monthKey, index) => {
      const x = padding + index * (barW + gap);
      const winsMap = byMonth.get(monthKey);
      let stack = 0;

      playerList.forEach((player) => {
        const wins = winsMap.get(player) ?? 0;
        if (!wins) return;

        const segmentH = (wins / maxTotal) * chartH;
        const y = height - padding - ((stack / maxTotal) * chartH) - segmentH;

        svg += `<rect x="${x}" y="${y}" width="${barW}" height="${segmentH}"
          fill="${colorByPlayer.get(player)}">
          <title>${monthKey} • ${player}: ${wins} win(s)</title>
        </rect>`;

        stack += wins;
      });

      svg += `<text x="${x + barW / 2}" y="${height - padding + 16}" font-size="10" text-anchor="middle" fill="#333">${monthKey}</text>`;
    });

    let legendX = padding;
    let legendY = 14;
    playerList.forEach((player, index) => {
      const x = legendX + (index % 5) * 170;
      const y = legendY + Math.floor(index / 5) * 16;
      svg += `<rect x="${x}" y="${y}" width="10" height="10" fill="${colorByPlayer.get(player)}"></rect>`;
      svg += `<text x="${x + 14}" y="${y + 9}" font-size="11" fill="#333">${player}</text>`;
    });

    svg += "</svg>";
    container.innerHTML = svg;
  }

  const api = {
    populateHeadToHeadSelect,
    populatePlayerDeckSelect,
    renderHeadToHeadStats,
    renderPlayerDeckStats,
    renderWinsOverTimeChart,
    setPlayerDeckSectionsVisible,
    wireHeadToHeadSelect,
    wirePlayerDeckSelect,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderPlayerInsights = api;
})(typeof window !== "undefined" ? window : globalThis);
