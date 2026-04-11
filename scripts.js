document.addEventListener("DOMContentLoaded", () => {
  const {
    buildMonthlyWins2026,
    buildPlayerDeckStats2026,
    buildStatsFromMatches,
    decks2026RowsFromStats,
    latestMatchDate,
    mergeDecksOverall,
    mergePlayersOverall,
    pctText,
    safeISODate,
    winRate,
  } = window.CommanderStats;
  const commanderScryfall = window.CommanderScryfall.createCommanderScryfallClient();

  // -----------------------------
  // Config
  // -----------------------------
  const YEARS = ["2025", "2026"];
  const TAB_KEYS = ["overall", ...YEARS];

  // -----------------------------
  // State
  // -----------------------------
  let selectedTab = "overall";
  let showInactiveDecks = false;
  let playerSearchQuery = "";
  let deckSearchQuery = "";

  const sortIcons = { up: "↑", down: "↓", both: "↕" };

  const singlesSortState = {
    column: "wins",
    ascending: false,
  };

  const decksSortState = {
    column: "winrate",
    ascending: false,
  };

  // Player deck stats state (from 2026 match log)
  let playerDeckStats2026 = null; // Map player -> Map deckId -> {wins,matches}
  let playersIn2026 = []; // list of players (sorted)
  let selectedPlayerForDeckStats = ""; // chosen in dropdown

  // -----------------------------
  // Data caches
  // -----------------------------
  let players2025 = null;
  let decks2025 = null;

  let deckDefinitions = null;
  let matches2026 = null;

  let combinationsData = null;

  // -----------------------------
  // Utilities
  // -----------------------------
  function fetchJSON(path) {
    const resolved = new URL(path, window.location.href).toString();
    return fetch(path, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${path} (${res.status}). URL: ${resolved}`);
      return res.json();
    });
  }

  function showFatalError(message, error) {
    const banner = document.createElement("div");
    banner.style.background = "#b00020";
    banner.style.color = "white";
    banner.style.padding = "12px";
    banner.style.margin = "12px";
    banner.style.borderRadius = "6px";
    banner.style.fontWeight = "bold";
    banner.innerHTML = `
      <div>❌ Data loading error</div>
      <div style="margin-top: 6px;">${message}</div>
      <pre style="white-space: pre-wrap; font-weight: normal; margin-top: 8px;">${String(error)}</pre>
    `;
    document.body.prepend(banner);
  }

  function normaliseText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function makeSortable(th, onActivate) {
    if (!th) return;
    th.classList.add("sortable");
    th.setAttribute("role", "button");
    th.setAttribute("tabindex", "0");

    th.addEventListener("click", onActivate);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    });
  }

  function setAriaSort(th, direction) {
    if (!th) return;
    th.setAttribute("aria-sort", direction);
  }

  // -----------------------------
  // Combinations
  // -----------------------------
  function matchCombination(combinedColors) {
    const combos = combinationsData?.combinations || {};
    const normalized = [...new Set(combinedColors)].sort();

    const matchedKey = Object.keys(combos).find((key) => {
      const comboColors = (combos[key] || []).slice().sort();
      if (comboColors.length !== normalized.length) return false;
      return comboColors.every((c) => normalized.includes(c));
    });

    return matchedKey || "Unknown";
  }

  function renderLastUpdated() {
    const note = document.getElementById("last-updated-note");
    if (!note) return;

    const latest = latestMatchDate(matches2026);
    note.textContent = latest ? `Latest match logged: ${latest}` : "No 2026 matches logged yet.";
  }

  function shortDisplayDate(isoDate) {
    const [year, month, day] = String(isoDate || "").split("-");
    if (!year || !month || !day) return isoDate || "";
    return `${day}/${month}/${year.slice(-2)}`;
  }

  function renderRecentMatches() {
    const body = document.getElementById("recent-matches-body");
    const note = document.getElementById("recent-matches-note");
    if (!body || !note) return;

    body.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    const recent = [...(matches2026?.matches ?? [])]
      .filter((match) => safeISODate(match.date))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);

    note.textContent = recent.length ? "Latest 5 matches from the 2026 match log." : "No 2026 matches logged yet.";

    for (const match of recent) {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      const tdWinner = document.createElement("td");
      const tdPod = document.createElement("td");
      const players = match.players || [];

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

  // -----------------------------
  // Player deck stats render
  // -----------------------------
  function setPlayerDeckSectionsVisible(isVisible) {
    const select = document.getElementById("player-deck-select");
    const table = document.getElementById("player-decks-table");
    const chart = document.getElementById("wins-over-time-chart");

    // hide the whole section blocks by hiding their parent section
    if (select?.closest("section")) select.closest("section").style.display = isVisible ? "" : "none";
    if (chart?.closest("section")) chart.closest("section").style.display = isVisible ? "" : "none";
  }

  function deckNameFromId(deckId) {
    const defs = deckDefinitions?.decks ?? [];
    const def = defs.find((d) => d.id === deckId);
    return def?.name ?? deckId;
  }

  function wirePlayerDeckSelect() {
    const select = document.getElementById("player-deck-select");
    if (!select) return;

    select.addEventListener("change", () => {
      selectedPlayerForDeckStats = select.value;
      renderPlayerDeckStats();
    });
  }

  function renderPlayerDeckStats() {
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

    // Default selection
    if (!selectedPlayerForDeckStats || !playersIn2026.includes(selectedPlayerForDeckStats)) {
      selectedPlayerForDeckStats = playersIn2026[0];
      select.value = selectedPlayerForDeckStats;
    }

    const byDeck = playerDeckStats2026.get(selectedPlayerForDeckStats) || new Map();
    const rows = Array.from(byDeck.entries()).map(([deckId, stats]) => {
      return {
        deckId,
        deckName: deckNameFromId(deckId),
        wins: stats.wins,
        matchesPlayed: stats.matchesPlayed,
        winrate: winRate(stats.wins, stats.matchesPlayed),
      };
    });

    rows.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || a.deckName.localeCompare(b.deckName));

    note.textContent = `Showing ${selectedPlayerForDeckStats}'s deck performance from 2026 matches.`;

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.deckName}</td>
        <td>${r.wins}</td>
        <td>${r.matchesPlayed}</td>
        <td>${pctText(r.winrate)}</td>
      `;
      body.appendChild(tr);
    }

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">No matches logged for this player yet.</td>`;
      body.appendChild(tr);
    }
  }

  function populatePlayerDeckSelect() {
    const select = document.getElementById("player-deck-select");
    if (!select) return;

    select.innerHTML = "";

    if (!playersIn2026.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No 2026 players";
      select.appendChild(opt);
      return;
    }

    for (const p of playersIn2026) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    }
  }

  // -----------------------------
  // Chart render (monthly wins from 2026 matches)
  // -----------------------------
  function renderWinsOverTimeChart() {
    const container = document.getElementById("wins-over-time-chart");
    const note = document.getElementById("wins-over-time-note");
    if (!container || !note) return;

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      container.innerHTML = "";
      note.textContent = "Not available for 2025 (no match log).";
      return;
    }

    const { months, byMonth } = buildMonthlyWins2026(matches2026);

    if (!months.length) {
      container.innerHTML = "";
      note.textContent = "No dated matches in 2026 yet.";
      return;
    }

    // Determine players set
    const players = new Set();
    for (const mk of months) {
      const winsMap = byMonth.get(mk);
      for (const p of winsMap.keys()) players.add(p);
    }
    const playerList = Array.from(players).sort();

    // Aggregate totals per month for chart height baseline
    const totalsPerMonth = months.map((mk) => {
      const winsMap = byMonth.get(mk);
      let total = 0;
      for (const v of winsMap.values()) total += v;
      return total;
    });

    const maxTotal = Math.max(...totalsPerMonth, 1);

    note.textContent =
      selectedTab === "overall"
        ? "Overall tab chart is based on 2026 matches only."
        : "Based on 2026 matches.";

    // Simple SVG stacked bar chart (stacked by player)
    const width = 900;
    const height = 240;
    const padding = 32;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const barCount = months.length;
    const barW = Math.max(18, Math.floor(chartW / barCount) - 6);
    const gap = 6;

    // Colour palette (no hard requirements; browser default not available for SVG)
    const palette = [
      "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
      "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"
    ];
    const colorByPlayer = new Map(playerList.map((p, i) => [p, palette[i % palette.length]]));

    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly wins chart">
      <rect x="0" y="0" width="${width}" height="${height}" fill="white"></rect>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#333" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#333" />
    `;

    // Bars
    months.forEach((mk, i) => {
      const x = padding + i * (barW + gap);
      const winsMap = byMonth.get(mk);

      // stacked segments
      let stack = 0;
      playerList.forEach((p) => {
        const w = winsMap.get(p) ?? 0;
        if (!w) return;

        const total = totalsPerMonth[i];
        const segmentH = (w / maxTotal) * chartH;
        const y = height - padding - ((stack / maxTotal) * chartH) - segmentH;

        svg += `<rect x="${x}" y="${y}" width="${barW}" height="${segmentH}"
          fill="${colorByPlayer.get(p)}">
          <title>${mk} • ${p}: ${w} win(s)</title>
        </rect>`;

        stack += w;
      });

      // x labels
      const label = mk;
      svg += `<text x="${x + barW / 2}" y="${height - padding + 16}" font-size="10" text-anchor="middle" fill="#333">${label}</text>`;
    });

    // Legend
    let lx = padding;
    let ly = 14;
    playerList.forEach((p, idx) => {
      const x = lx + (idx % 5) * 170;
      const y = ly + Math.floor(idx / 5) * 16;
      svg += `<rect x="${x}" y="${y}" width="10" height="10" fill="${colorByPlayer.get(p)}"></rect>`;
      svg += `<text x="${x + 14}" y="${y + 9}" font-size="11" fill="#333">${p}</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  // -----------------------------
  // Choose data based on tab
  // -----------------------------
  function getTabData(tabKey) {
    const players25 = players2025?.players ?? [];

    const decks25raw = decks2025?.decks ?? [];
    const decks25 = decks25raw.map((d) => ({
      name: d.name,
      commanders: Array.isArray(d.commander) ? d.commander : [d.commander],
      active: !!d.active,
      wins: d.wins ?? 0,
      matchesPlayed: d.matchesPlayed ?? 0,
    }));

    const stats26 = buildStatsFromMatches(matches2026);
    const players26 = stats26.players;
    const decks26 = decks2026RowsFromStats(stats26.decksById, deckDefinitions);

    if (tabKey === "2025") return { players: players25, decks: decks25 };

    if (tabKey === "2026") {
      const defs = deckDefinitions?.decks ?? [];
      const existingNames = new Set(decks26.map((d) => d.name));
      for (const def of defs) {
        if (!existingNames.has(def.name)) {
          const commandersRaw = def.commander ?? [];
          const commanders = Array.isArray(commandersRaw) ? commandersRaw : [commandersRaw];
          decks26.push({ name: def.name, commanders, active: !!def.active, wins: 0, matchesPlayed: 0 });
        }
      }
      return { players: players26, decks: decks26 };
    }

    // overall
    const playersOverall = mergePlayersOverall(players25, players26);
    const decksOverall = mergeDecksOverall(decks25raw, decks26);
    return { players: playersOverall, decks: decksOverall };
  }

  function renderForSelectedTab() {
    const { players, decks } = getTabData(selectedTab);

    renderLastUpdated();
    renderRecentMatches();
    renderSinglesTable(players);
    renderDecksTable(decks);

    // Only show player deck stats + charts on Overall/2026
    const showExtras = selectedTab === "overall" || selectedTab === "2026";
    setPlayerDeckSectionsVisible(showExtras);

    if (showExtras) {
      renderPlayerDeckStats();
      renderWinsOverTimeChart();
    }
  }

  // -----------------------------
  // Wire up existing sorting etc.
  // -----------------------------
  function wireTabs() {
    const tabs = TAB_KEYS.map((k) => document.getElementById(`tab-${k}`)).filter(Boolean);

    for (const tab of tabs) {
      tab.addEventListener("click", () => selectTab(tab.dataset.tab));

      tab.addEventListener("keydown", (e) => {
        const currentIndex = tabs.indexOf(tab);
        if (currentIndex === -1) return;

        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const next = (currentIndex + delta + tabs.length) % tabs.length;
          tabs[next].focus();
        }

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectTab(tab.dataset.tab);
        }
      });
    }
  }

  function selectTab(tabKey) {
    if (!TAB_KEYS.includes(tabKey)) return;

    selectedTab = tabKey;

    const tabPanel = document.getElementById("tab-panel");
    if (tabPanel) tabPanel.setAttribute("aria-labelledby", `tab-${tabKey}`);

    for (const key of TAB_KEYS) {
      const tab = document.getElementById(`tab-${key}`);
      if (!tab) continue;

      const selected = key === tabKey;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }

    renderForSelectedTab();
  }

  // -----------------------------
  // Singles & Decks rendering
  // -----------------------------
  function updateSinglesSortArrows() {
    const mapping = {
      player: { thId: "sort-player", arrowId: "arrow-player" },
      wins: { thId: "sort-wins-singles", arrowId: "arrow-wins-singles" },
      matches: { thId: "sort-matches-singles", arrowId: "arrow-matches-singles" },
      winrate: { thId: "sort-winrate-singles", arrowId: "arrow-winrate-singles" },
    };

    for (const { thId, arrowId } of Object.values(mapping)) {
      const th = document.getElementById(thId);
      const arrow = document.getElementById(arrowId);
      if (arrow) arrow.textContent = sortIcons.both;
      setAriaSort(th, "none");
    }

    const current = mapping[singlesSortState.column];
    if (!current) return;

    const arrow = document.getElementById(current.arrowId);
    const th = document.getElementById(current.thId);

    if (arrow) arrow.textContent = singlesSortState.ascending ? sortIcons.up : sortIcons.down;
    setAriaSort(th, singlesSortState.ascending ? "ascending" : "descending");
  }

  function getSinglesSortedPlayers(players) {
    const arr = [...players];

    arr.sort((a, b) => {
      const wrA = winRate(a.wins, a.matchesPlayed);
      const wrB = winRate(b.wins, b.matchesPlayed);

      let cmp = 0;
      switch (singlesSortState.column) {
        case "player":
          cmp = String(a.name).localeCompare(String(b.name));
          break;
        case "wins":
          cmp = (a.wins ?? 0) - (b.wins ?? 0);
          break;
        case "matches":
          cmp = (a.matchesPlayed ?? 0) - (b.matchesPlayed ?? 0);
          break;
        case "winrate":
          cmp = wrA - wrB;
          break;
        default:
          cmp = 0;
      }

      if (!singlesSortState.ascending) cmp *= -1;
      return cmp;
    });

    return arr;
  }

  function renderSinglesTable(players) {
    const body = document.getElementById("wins-table-body");
    if (!body) return;

    body.innerHTML = "";

    const query = normaliseText(playerSearchQuery);
    const filtered = query
      ? players.filter((p) => normaliseText(p.name).includes(query))
      : players;
    const sorted = getSinglesSortedPlayers(filtered);

    for (const p of sorted) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.wins ?? 0}</td>
        <td>${p.matchesPlayed ?? 0}</td>
        <td>${pctText(winRate(p.wins, p.matchesPlayed))}</td>
      `;
      body.appendChild(tr);
    }

    if (sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">No players match your search.</td>`;
      body.appendChild(tr);
    }

    updateSinglesSortArrows();
  }

  function wireSinglesSorting(onChange) {
    makeSortable(document.getElementById("sort-player"), () => {
      if (singlesSortState.column === "player") singlesSortState.ascending = !singlesSortState.ascending;
      else {
        singlesSortState.column = "player";
        singlesSortState.ascending = true;
      }
      onChange();
    });

    makeSortable(document.getElementById("sort-wins-singles"), () => {
      if (singlesSortState.column === "wins") singlesSortState.ascending = !singlesSortState.ascending;
      else {
        singlesSortState.column = "wins";
        singlesSortState.ascending = false;
      }
      onChange();
    });

    makeSortable(document.getElementById("sort-matches-singles"), () => {
      if (singlesSortState.column === "matches") singlesSortState.ascending = !singlesSortState.ascending;
      else {
        singlesSortState.column = "matches";
        singlesSortState.ascending = false;
      }
      onChange();
    });

    makeSortable(document.getElementById("sort-winrate-singles"), () => {
      if (singlesSortState.column === "winrate") singlesSortState.ascending = !singlesSortState.ascending;
      else {
        singlesSortState.column = "winrate";
        singlesSortState.ascending = false;
      }
      onChange();
    });
  }

  function updateDecksSortArrows() {
    const idMap = {
      name: "sort-deck-name",
      wins: "sort-wins",
      matches: "sort-matches",
      winrate: "sort-winrate",
    };

    for (const thId of Object.values(idMap)) {
      const th = document.getElementById(thId);
      const arrow = document.getElementById(`arrow-${thId}`);
      if (arrow) arrow.textContent = sortIcons.both;
      setAriaSort(th, "none");
    }

    const activeThId = idMap[decksSortState.column];
    const arrow = document.getElementById(`arrow-${activeThId}`);
    const th = document.getElementById(activeThId);

    if (arrow) arrow.textContent = decksSortState.ascending ? sortIcons.up : sortIcons.down;
    setAriaSort(th, decksSortState.ascending ? "ascending" : "descending");
  }

  function getSortedDeckRows(deckRows) {
    const arr = [...deckRows];

    arr.sort((a, b) => {
      const wrA = winRate(a.wins, a.matchesPlayed);
      const wrB = winRate(b.wins, b.matchesPlayed);

      let cmp = 0;
      switch (decksSortState.column) {
        case "name":
          cmp = String(a.name).localeCompare(String(b.name));
          break;
        case "wins":
          cmp = (a.wins ?? 0) - (b.wins ?? 0);
          break;
        case "matches":
          cmp = (a.matchesPlayed ?? 0) - (b.matchesPlayed ?? 0);
          break;
        case "winrate":
          cmp = wrA - wrB;
          break;
        default:
          cmp = 0;
      }

      if (!decksSortState.ascending) cmp *= -1;
      return cmp;
    });

    return arr;
  }

  async function fillDeckCommanderInfo({ commanders, tdColours, tdCombinations, tdImage }) {
    tdColours.textContent = "…";
    tdCombinations.textContent = "…";
    tdImage.textContent = "…";

    const results = await Promise.all(commanders.map(commanderScryfall.fetchCommander));
    const combinedColors = [...new Set(results.flatMap((r) => r.colors))].filter(Boolean);
    const comboName = matchCombination(combinedColors);

    tdColours.innerHTML = combinedColors
      .map((color) => `<img class="mana-symbol" src="images/${color}.svg" alt="${color} mana" />`)
      .join(" ");

    tdCombinations.textContent = comboName;

    tdImage.innerHTML = results
      .map((r, i) => {
        const name = commanders[i];
        if (!r.image) return `<span>Image not available</span>`;
        return `<img class="commander-image" src="${r.image}" alt="${name} card art" loading="lazy" />`;
      })
      .join("<br>");
  }

  function renderDecksTable(deckRows) {
    const body = document.getElementById("decks-table-body");
    if (!body) return;

    body.innerHTML = "";

    let rows = deckRows;
    if (!showInactiveDecks) rows = rows.filter((r) => r.active);
    const query = normaliseText(deckSearchQuery);
    if (query) {
      rows = rows.filter((r) => {
        const commanders = (r.commanders || []).join(" ");
        return normaliseText(`${r.name} ${commanders}`).includes(query);
      });
    }

    const sorted = getSortedDeckRows(rows);

    for (const r of sorted) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const tdCommander = document.createElement("td");
      const tdColours = document.createElement("td");
      const tdCombinations = document.createElement("td");
      const tdWins = document.createElement("td");
      const tdMatches = document.createElement("td");
      const tdWinPct = document.createElement("td");
      const tdImage = document.createElement("td");
      const tdActive = document.createElement("td");

      tdName.textContent = r.name;
      tdCommander.innerHTML = r.commanders.map((c) => `<span>${c}</span>`).join("<br>");
      tdWins.textContent = String(r.wins ?? 0);
      tdMatches.textContent = String(r.matchesPlayed ?? 0);
      tdWinPct.textContent = pctText(winRate(r.wins, r.matchesPlayed));
      tdActive.textContent = r.active ? "Yes" : "No";

      tr.appendChild(tdName);
      tr.appendChild(tdCommander);
      tr.appendChild(tdColours);
      tr.appendChild(tdCombinations);
      tr.appendChild(tdWins);
      tr.appendChild(tdMatches);
      tr.appendChild(tdWinPct);
      tr.appendChild(tdImage);
      tr.appendChild(tdActive);

      body.appendChild(tr);

      fillDeckCommanderInfo({
        commanders: r.commanders,
        tdColours,
        tdCombinations,
        tdImage,
      }).catch(() => {
        tdColours.textContent = "Unknown";
        tdCombinations.textContent = "Unknown";
        tdImage.textContent = "Unavailable";
      });
    }

    if (sorted.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9">No decks match your search.</td>`;
      body.appendChild(tr);
    }

    updateDecksSortArrows();
    updateToggleButton();
  }

  function updateToggleButton() {
    const btn = document.getElementById("toggle-inactive-decks");
    if (!btn) return;

    btn.textContent = showInactiveDecks ? "Hide Inactive Decks" : "Show Inactive Decks";
    btn.setAttribute("aria-pressed", String(showInactiveDecks));
  }

  function wireDecksSorting(onChange) {
    const setDeckSort = (column) => {
      if (decksSortState.column === column) decksSortState.ascending = !decksSortState.ascending;
      else {
        decksSortState.column = column;
        decksSortState.ascending = column === "name";
      }
      onChange();
    };

    makeSortable(document.getElementById("sort-deck-name"), () => setDeckSort("name"));
    makeSortable(document.getElementById("sort-wins"), () => setDeckSort("wins"));
    makeSortable(document.getElementById("sort-matches"), () => setDeckSort("matches"));
    makeSortable(document.getElementById("sort-winrate"), () => setDeckSort("winrate"));
  }

  function wireInactiveToggle(onChange) {
    const btn = document.getElementById("toggle-inactive-decks");
    if (!btn) return;

    btn.addEventListener("click", () => {
      showInactiveDecks = !showInactiveDecks;
      onChange();
    });

    updateToggleButton();
  }

  function wireSearchControls(onChange) {
    const playerSearch = document.getElementById("player-search");
    const deckSearch = document.getElementById("deck-search");

    if (playerSearch) {
      playerSearch.addEventListener("input", () => {
        playerSearchQuery = playerSearch.value;
        onChange();
      });
    }

    if (deckSearch) {
      deckSearch.addEventListener("input", () => {
        deckSearchQuery = deckSearch.value;
        onChange();
      });
    }
  }

  // -----------------------------
  // Boot
  // -----------------------------
  commanderScryfall.loadCacheFromStorage();

  Promise.all([
    fetchJSON("data/players-2025.json"),
    fetchJSON("data/decks-2025.json"),
    fetchJSON("data/deck-definitions.json"),
    fetchJSON("data/matches-2026.json"),
    fetchJSON("data/combinations.json"),
  ])
    .then(([p25, d25, defs, m26, combos]) => {
      players2025 = p25;
      decks2025 = d25;
      deckDefinitions = defs;
      matches2026 = m26;
      combinationsData = combos;

      // Build 2026 extras
      playerDeckStats2026 = buildPlayerDeckStats2026(matches2026);
      playersIn2026 = Array.from(playerDeckStats2026.keys()).sort();

      // Setup player dropdown
      populatePlayerDeckSelect();
      wirePlayerDeckSelect();

      const rerender = () => renderForSelectedTab();

      wireTabs();
      wireSinglesSorting(rerender);
      wireDecksSorting(rerender);
      wireInactiveToggle(rerender);
      wireSearchControls(rerender);

      selectTab("overall");
    })
    .catch((err) => {
      showFatalError("One or more JSON files failed to load.", err.message || err);
      console.error(err);
    });
});
