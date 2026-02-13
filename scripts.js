document.addEventListener("DOMContentLoaded", () => {
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

  function normaliseCommanderName(name) {
    return (name || "").split("//")[0].trim().toLowerCase();
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

  function winRate(wins, matches) {
    if (!matches || matches <= 0) return 0;
    return wins / matches;
  }

  function pctText(rate) {
    return `${(rate * 100).toFixed(2)}%`;
  }

  function safeISODate(dateStr) {
    // supports "YYYY-MM-DD" (what we store) only
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function monthKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  // -----------------------------
  // Scryfall caching + throttling
  // -----------------------------
  const SCRYFALL_CACHE_KEY = "commanderScryfallCache_v1";
  const SCRYFALL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  const commanderCache = new Map();

  function loadCommanderCacheFromStorage() {
    try {
      const raw = localStorage.getItem(SCRYFALL_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const now = Date.now();

      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object") continue;
        if (!value.cachedAt || now - value.cachedAt > SCRYFALL_CACHE_TTL_MS) continue;
        commanderCache.set(key, value);
      }
    } catch {
      // ignore
    }
  }

  let saveCacheTimer = null;
  function saveCommanderCacheToStorageDebounced() {
    try {
      if (saveCacheTimer) clearTimeout(saveCacheTimer);
      saveCacheTimer = setTimeout(() => {
        const obj = Object.fromEntries(commanderCache.entries());
        localStorage.setItem(SCRYFALL_CACHE_KEY, JSON.stringify(obj));
      }, 250);
    } catch {
      // ignore
    }
  }

  const MAX_SCRYFALL_CONCURRENCY = 6;
  let activeScryfall = 0;
  const scryfallQueue = [];

  function runWithScryfallLimit(taskFn) {
    return new Promise((resolve, reject) => {
      scryfallQueue.push({ taskFn, resolve, reject });
      drainScryfallQueue();
    });
  }

  function drainScryfallQueue() {
    while (activeScryfall < MAX_SCRYFALL_CONCURRENCY && scryfallQueue.length) {
      const job = scryfallQueue.shift();
      activeScryfall++;

      Promise.resolve()
        .then(job.taskFn)
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          activeScryfall--;
          drainScryfallQueue();
        });
    }
  }
  function mapScryfallColorsToNames(colors) {
    const mapping = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
    const mapped = Array.isArray(colors) ? colors.map((c) => mapping[c]).filter(Boolean) : [];
    return mapped.length > 0 ? mapped : ["Colorless"];
  }

  async function fetchCommanderFromScryfall(commanderName) {
    const key = normaliseCommanderName(commanderName);
    if (!key) return { colors: [], image: null };

    if (commanderCache.has(key)) {
      const cached = commanderCache.get(key);
      return { colors: cached.colors || [], image: cached.image || null };
    }

    return runWithScryfallLimit(async () => {
      if (commanderCache.has(key)) {
        const cached = commanderCache.get(key);
        return { colors: cached.colors || [], image: cached.image || null };
      }

      const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(key)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (!res.ok) {
        commanderCache.set(key, { colors: [], image: null, cachedAt: Date.now() });
        saveCommanderCacheToStorageDebounced();
        return { colors: [], image: null };
      }

      const cardData = await res.json();
      const face = Array.isArray(cardData.card_faces) ? cardData.card_faces[0] : cardData;

      const colors = mapScryfallColorsToNames(face?.colors);
      const image = face?.image_uris?.normal ?? cardData?.image_uris?.normal ?? null;

      commanderCache.set(key, { colors, image, cachedAt: Date.now() });
      saveCommanderCacheToStorageDebounced();

      return { colors, image };
    });
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

  // -----------------------------
  // Aggregation: 2026 from match logs
  // -----------------------------
  function buildStatsFromMatches(matchFile) {
    const matches = matchFile?.matches ?? [];

    const playerStats = new Map();
    const deckStats = new Map();

    for (const match of matches) {
      const players = Array.isArray(match.players) ? match.players : [];
      const winner = match.winner;

      for (const p of players) {
        const playerName = p?.name;
        const deckId = p?.deckId;

        if (playerName) {
          if (!playerStats.has(playerName)) {
            playerStats.set(playerName, { name: playerName, wins: 0, matchesPlayed: 0 });
          }
          const ps = playerStats.get(playerName);
          ps.matchesPlayed += 1;
          if (winner && winner === playerName) ps.wins += 1;
        }

        if (deckId) {
          if (!deckStats.has(deckId)) {
            deckStats.set(deckId, { deckId, wins: 0, matchesPlayed: 0 });
          }
          const ds = deckStats.get(deckId);
          ds.matchesPlayed += 1;
          if (winner && winner === playerName) ds.wins += 1;
        }
      }
    }

    return {
      players: Array.from(playerStats.values()),
      decksById: Array.from(deckStats.values()),
    };
  }

  function decks2026RowsFromStats(decksById) {
    const defs = Array.isArray(deckDefinitions?.decks) ? deckDefinitions.decks : [];
    const defById = new Map(defs.map((d) => [d.id, d]));

    return decksById.map((d) => {
      const def = defById.get(d.deckId);

      const name = def?.name ?? d.deckId;
      const commandersRaw = def?.commander ?? [];
      const commanders = Array.isArray(commandersRaw) ? commandersRaw : [commandersRaw];
      const active = def?.active ?? true;

      return {
        name,
        commanders,
        active,
        wins: d.wins,
        matchesPlayed: d.matchesPlayed,
      };
    });
  }

  // Build per-player per-deck stats from 2026 match logs
  function buildPlayerDeckStats2026(matchFile) {
    const matches = matchFile?.matches ?? [];
    const stats = new Map(); // player -> Map(deckId -> {wins,matches})

    for (const match of matches) {
      const players = Array.isArray(match.players) ? match.players : [];
      const winner = match.winner;

      for (const p of players) {
        const playerName = p?.name;
        const deckId = p?.deckId;
        if (!playerName || !deckId) continue;

        if (!stats.has(playerName)) stats.set(playerName, new Map());
        const byDeck = stats.get(playerName);

        if (!byDeck.has(deckId)) byDeck.set(deckId, { wins: 0, matchesPlayed: 0 });
        const entry = byDeck.get(deckId);

        entry.matchesPlayed += 1;
        if (winner && winner === playerName) entry.wins += 1;
      }
    }

    return stats;
  }

  // Monthly wins per player from 2026 match logs
  function buildMonthlyWins2026(matchFile) {
    const matches = matchFile?.matches ?? [];
    const byMonth = new Map(); // "YYYY-MM" -> Map(player -> wins)

    for (const match of matches) {
      const d = safeISODate(match.date);
      if (!d) continue;

      const mk = monthKey(d);
      if (!byMonth.has(mk)) byMonth.set(mk, new Map());
      const winsMap = byMonth.get(mk);

      const winner = match.winner;
      if (!winner) continue;

      winsMap.set(winner, (winsMap.get(winner) ?? 0) + 1);
    }

    // Sort months ascending
    const months = Array.from(byMonth.keys()).sort();
    return { months, byMonth };
  }

  // -----------------------------
  // Merge: Overall = 2025 totals + 2026 computed
  // -----------------------------
  function mergePlayersOverall(players25, players26) {
    const map = new Map();

    for (const p of players25) {
      map.set(p.name, {
        name: p.name,
        wins: p.wins ?? 0,
        matchesPlayed: p.matchesPlayed ?? 0,
      });
    }

    for (const p of players26) {
      if (!map.has(p.name)) map.set(p.name, { name: p.name, wins: 0, matchesPlayed: 0 });
      const entry = map.get(p.name);
      entry.wins += p.wins ?? 0;
      entry.matchesPlayed += p.matchesPlayed ?? 0;
    }

    return Array.from(map.values());
  }

  function mergeDecksOverall(decks25raw, decks26) {
    const map = new Map();

    for (const d of decks25raw) {
      map.set(d.name, {
        name: d.name,
        commanders: Array.isArray(d.commander) ? d.commander : [d.commander],
        active: !!d.active,
        wins: d.wins ?? 0,
        matchesPlayed: d.matchesPlayed ?? 0,
      });
    }

    for (const d of decks26) {
      if (!map.has(d.name)) {
        map.set(d.name, {
          name: d.name,
          commanders: d.commanders,
          active: !!d.active,
          wins: 0,
          matchesPlayed: 0,
        });
      }

      const entry = map.get(d.name);
      entry.wins += d.wins ?? 0;
      entry.matchesPlayed += d.matchesPlayed ?? 0;
      entry.active = entry.active || !!d.active;

      if ((!entry.commanders || entry.commanders.length === 0) && d.commanders?.length) {
        entry.commanders = d.commanders;
      }
    }

    return Array.from(map.values());
  }

  // -----------------------------
  // Rendering: Singles
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

    const sorted = getSinglesSortedPlayers(players);

    for (const p of sorted) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const tdWins = document.createElement("td");
      const tdMatches = document.createElement("td");
      const tdWinRate = document.createElement("td");

      tdName.textContent = p.name;
      tdWins.textContent = String(p.wins ?? 0);
      tdMatches.textContent = String(p.matchesPlayed ?? 0);
      tdWinRate.textContent = pctText(winRate(p.wins, p.matchesPlayed));

      tr.appendChild(tdName);
      tr.appendChild(tdWins);
      tr.appendChild(tdMatches);
      tr.appendChild(tdWinRate);

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

  // -----------------------------
  // Rendering: Decks
  // -----------------------------
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

    const results = await Promise.all(commanders.map(fetchCommanderFromScryfall));

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

  // -----------------------------
  // Tabs
  // -----------------------------
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
    const decks26 = decks2026RowsFromStats(stats26.decksById);

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
  // Singles & Decks rendering (same as before)
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

    const sorted = getSinglesSortedPlayers(players);

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

    const results = await Promise.all(commanders.map(fetchCommanderFromScryfall));
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

  // -----------------------------
  // Boot
  // -----------------------------
  loadCommanderCacheFromStorage();

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

      selectTab("overall");
    })
    .catch((err) => {
      showFatalError("One or more JSON files failed to load.", err.message || err);
      console.error(err);
    });
});
