"use strict";

(function initCommanderPlayerInsights(global) {
  function setPlayerDeckSectionsVisible(isVisible) {
    const select = document.getElementById("player-deck-select");
    const headToHeadSelect = document.getElementById("head-to-head-player-select");
    const recentForm = document.getElementById("recent-form-streaks-body");
    const funStats = document.getElementById("fun-stats-body");
    const chart = document.getElementById("wins-over-time-chart");

    if (select?.closest("section")) select.closest("section").style.display = isVisible ? "" : "none";
    if (headToHeadSelect?.closest("section")) headToHeadSelect.closest("section").style.display = isVisible ? "" : "none";
    if (recentForm?.closest("section")) recentForm.closest("section").style.display = isVisible ? "" : "none";
    if (funStats?.closest("section")) funStats.closest("section").style.display = isVisible ? "" : "none";
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

  function normaliseDeckName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildDeckOwnershipStats(deckDefinitions, decks2025) {
    const knownDecks = new Map();

    for (const deck of deckDefinitions?.decks || []) {
      const key = normaliseDeckName(deck.name);
      const owner = String(deck.owner || "").trim();
      if (!key || !owner) continue;

      knownDecks.set(key, {
        owner,
        active: !!deck.active,
      });
    }

    for (const deck of decks2025?.decks || []) {
      const key = normaliseDeckName(deck.name);
      const owner = String(deck.owner || "").trim();
      if (!key || !owner || knownDecks.has(key)) continue;

      knownDecks.set(key, {
        owner,
        active: !!deck.active,
      });
    }

    const byOwner = new Map();
    for (const deck of knownDecks.values()) {
      if (!byOwner.has(deck.owner)) {
        byOwner.set(deck.owner, {
          owner: deck.owner,
          total: 0,
          active: 0,
          inactive: 0,
        });
      }

      const stats = byOwner.get(deck.owner);
      stats.total += 1;
      if (deck.active) stats.active += 1;
      else stats.inactive += 1;
    }

    return [...byOwner.values()].sort(
      (a, b) => b.total - a.total || b.active - a.active || a.owner.localeCompare(b.owner)
    );
  }

  function ensureDeckOwnershipSection() {
    let section = document.getElementById("deck-ownership-section");
    if (section) return section;

    const playersView = document.getElementById("view-players");
    if (!playersView) return null;

    section = document.createElement("section");
    section.id = "deck-ownership-section";
    section.setAttribute("aria-labelledby", "deck-ownership-heading");
    section.innerHTML = `
      <h2 id="deck-ownership-heading" class="section-heading">Deck Ownership</h2>
      <p id="deck-ownership-note" class="section-note" aria-live="polite">Loading deck ownership…</p>
      <p id="deck-ownership-scroll-hint" class="table-scroll-hint">Scroll table sideways</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Deck ownership statistics table, horizontally scrollable" aria-describedby="deck-ownership-scroll-hint">
        <table id="deck-ownership-table">
          <caption>Known active and inactive decks by owner</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Total Decks</th>
              <th scope="col">Active</th>
              <th scope="col">Inactive</th>
            </tr>
          </thead>
          <tbody id="deck-ownership-body"></tbody>
        </table>
      </div>
    `;

    const firstPlayerDeckSection = document.querySelector('[aria-labelledby="player-decks-heading"]');
    if (firstPlayerDeckSection?.parentNode === playersView) {
      playersView.insertBefore(section, firstPlayerDeckSection);
    } else {
      playersView.appendChild(section);
    }

    return section;
  }

  function renderDeckOwnershipRows(rows) {
    const body = document.getElementById("deck-ownership-body");
    const note = document.getElementById("deck-ownership-note");
    if (!body || !note) return;

    body.textContent = "";

    for (const stats of rows) {
      const tr = document.createElement("tr");
      const playerCell = document.createElement("th");
      playerCell.scope = "row";
      playerCell.textContent = stats.owner;
      tr.appendChild(playerCell);

      for (const value of [stats.total, stats.active, stats.inactive]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }

    const totalDecks = rows.reduce((sum, row) => sum + row.total, 0);
    note.textContent = `${totalDecks} known decks across current deck definitions and historical 2025-only records. Historical-only decks are counted as inactive.`;
  }

  function loadDeckOwnershipStats() {
    const section = ensureDeckOwnershipSection();
    if (!section || typeof global.fetch !== "function") return;

    const isSampleMode = new URLSearchParams(global.location?.search || "").get("sample") === "1";
    const prefix = isSampleMode ? "data/sample/" : "data/";

    Promise.all([
      global.fetch(`${prefix}deck-definitions.json`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Failed to load deck definitions (${response.status}).`);
        return response.json();
      }),
      global.fetch(`${prefix}decks-2025.json`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Failed to load 2025 deck history (${response.status}).`);
        return response.json();
      }),
    ])
      .then(([deckDefinitions, decks2025]) => {
        renderDeckOwnershipRows(buildDeckOwnershipStats(deckDefinitions, decks2025));
      })
      .catch((error) => {
        const note = document.getElementById("deck-ownership-note");
        if (note) note.textContent = "Could not load deck ownership stats.";
        console.warn("Could not load deck ownership stats.", error);
      });
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
      appendRowHeaderCell,
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
      appendRowHeaderCell(tr, row.deckName);
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
      appendRowHeaderCell,
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
      appendRowHeaderCell(tr, row.opponent);
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

    const rootStyles = getComputedStyle(document.documentElement);
    const cssColor = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;
    const palette = [
      cssColor("--chart-blue", "#3f6f9f"),
      cssColor("--chart-teal", "#2f7d70"),
      cssColor("--chart-olive", "#6f7f3f"),
      cssColor("--chart-gold", "#b98925"),
      cssColor("--chart-rust", "#b65c38"),
      cssColor("--chart-violet", "#725c9f"),
      cssColor("--chart-slate", "#60717a"),
      cssColor("--chart-rose", "#b85d72"),
    ];
    const chartSurface = cssColor("--color-surface", "#ffffff");
    const chartText = cssColor("--color-text-muted", "#5f6368");
    const colorByPlayer = new Map(playerList.map((player, index) => [player, palette[index % palette.length]]));

    const chartSummary = months.map((monthKey, index) => `${monthKey}: ${totalsPerMonth[index]} win(s)`).join("; ");
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="wins-over-time-svg-title wins-over-time-svg-desc">
      <title id="wins-over-time-svg-title">Monthly wins chart</title>
      <desc id="wins-over-time-svg-desc">${chartSummary}</desc>
      <rect x="0" y="0" width="${width}" height="${height}" fill="${chartSurface}"></rect>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="${chartText}" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="${chartText}" />
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

      svg += `<text x="${x + barW / 2}" y="${height - padding + 16}" font-size="10" text-anchor="middle" fill="${chartText}">${monthKey}</text>`;
    });

    let legendX = padding;
    let legendY = 14;
    playerList.forEach((player, index) => {
      const x = legendX + (index % 5) * 170;
      const y = legendY + Math.floor(index / 5) * 16;
      svg += `<rect x="${x}" y="${y}" width="10" height="10" fill="${colorByPlayer.get(player)}"></rect>`;
      svg += `<text x="${x + 14}" y="${y + 9}" font-size="11" fill="${chartText}">${player}</text>`;
    });

    svg += "</svg>";
    container.innerHTML = svg;
  }

  const api = {
    buildDeckOwnershipStats,
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

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadDeckOwnershipStats, { once: true });
    } else {
      loadDeckOwnershipStats();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
