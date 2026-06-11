document.addEventListener("DOMContentLoaded", () => {
  const {
    buildDashboardSummary,
    buildHeadToHeadStats,
    buildMonthlyWins2026,
    buildLatestSessionSummary,
    buildPlayerDeckStats2026,
    buildSessionSummaries,
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
  const commanderSessions = window.CommanderSessions;
  const commanderDecks = window.CommanderDecks;
  const commanderDashboardSummary = window.CommanderDashboardSummary;
  const commanderDeepLinks = window.CommanderDeepLinks;
  const commanderFunStats = window.CommanderFunStats;
  const commanderPhaseOneInsights = window.CommanderPhaseOneInsights;
  const commanderRecentForm = window.CommanderRecentForm;
  const commanderRecentMatches = window.CommanderRecentMatches;
  const commanderSingles = window.CommanderSingles;
  const commanderPlayerInsights = window.CommanderPlayerInsights;
  const commanderStreaks = window.CommanderStreaks;

  // -----------------------------
  // Config
  // -----------------------------
  const YEARS = ["2025", "2026"];
  const TAB_KEYS = ["overall", ...YEARS];
  const VIEW_KEYS = ["overview", "players", "decks", "sessions", "fun"];
  const VIEW_BY_HASH_KIND = {
    deck: "decks",
    player: "players",
    session: "sessions",
  };
  const RECENT_MATCH_LIMITS = [5, 10, 20];

  // -----------------------------
  // State
  // -----------------------------
  let selectedView = "overview";
  let selectedTab = "overall";
  let showInactiveDecks = false;
  let playerSearchQuery = "";
  let deckSearchQuery = "";
  let recentMatchesLimit = RECENT_MATCH_LIMITS[0];
  let selectedSessionDate = "";

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
  let headToHeadStats2026 = null; // list of pair records from 2026 matches
  let recentForm2026 = null; // last 5 player/deck form from 2026 matches
  let winStreaks2026 = null; // current/best player/deck win streaks from 2026 matches
  let funStats2026 = null; // separated fun stats from 2026 matches
  let playersIn2026 = []; // list of players (sorted)
  let selectedPlayerForDeckStats = ""; // chosen in dropdown
  let selectedPlayerForHeadToHead = ""; // chosen in dropdown

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
    banner.className = "fatal-error-banner";
    banner.innerHTML = `
      <div>❌ Data loading error</div>
      <div style="margin-top: 6px;">${message}</div>
      <pre>${String(error)}</pre>
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

  function appendTextCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = String(text);
    row.appendChild(cell);
    return cell;
  }

  function appendEmptyRow(body, colspan, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colspan;
    cell.textContent = message;
    row.appendChild(cell);
    body.appendChild(row);
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
    if (!commanderRecentMatches?.renderRecentMatches) return;
    commanderRecentMatches.renderRecentMatches({
      selectedTab,
      matches: matches2026,
      recentMatchesLimit,
      nextRecentMatchLimit,
      safeISODate,
      shortDisplayDate,
      deckNameFromId,
    });
  }

  function renderSessions() {
    if (!commanderSessions?.renderSessions) return;
    commanderSessions.renderSessions({
      selectedTab,
      matches: matches2026,
      selectedSessionDate,
      setSelectedSessionDate(nextDate) {
        selectedSessionDate = nextDate;
      },
      buildSessionSummaries,
      shortDisplayDate,
      deckNameFromId,
      deckAnchorId,
      sessionAnchorId,
      scrollToDeck,
    });
  }

  function renderLatestSessionSummary() {
    if (!commanderRecentMatches?.renderLatestSessionSummary) return;
    commanderRecentMatches.renderLatestSessionSummary({
      selectedTab,
      matches: matches2026,
      buildLatestSessionSummary,
      shortDisplayDate,
    });
  }

  function renderDashboardSummary(players, decks) {
    if (!commanderDashboardSummary?.renderDashboardSummary) return;
    commanderDashboardSummary.renderDashboardSummary({
      selectedTab,
      summary: buildDashboardSummary({
        players,
        decks,
        matchFile: selectedTab === "2025" ? null : matches2026,
      }),
      shortDisplayDate,
      pctText,
    });
  }

  function nextRecentMatchLimit() {
    return RECENT_MATCH_LIMITS.find((limit) => limit > recentMatchesLimit) || recentMatchesLimit;
  }

  function deckNameFromId(deckId) {
    const defs = deckDefinitions?.decks ?? [];
    const def = defs.find((d) => d.id === deckId);
    return def?.name ?? deckId;
  }

  function deckAnchorId(deckId) {
    if (commanderDeepLinks?.deckAnchorId) return commanderDeepLinks.deckAnchorId(deckId);
    return `deck-row-${String(deckId || "").replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  function playerAnchorId(playerName) {
    if (commanderDeepLinks?.playerAnchorId) return commanderDeepLinks.playerAnchorId(playerName);
    return `player-row-${String(playerName || "").replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  function sessionAnchorId(sessionDate) {
    if (commanderDeepLinks?.sessionAnchorId) return commanderDeepLinks.sessionAnchorId(sessionDate);
    return `session-${String(sessionDate || "").replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  function parseAppRoute(hash) {
    const fragment = String(hash || "").replace(/^#/, "");

    if (!fragment) return { view: "overview", anchorId: "" };

    if (fragment.startsWith("/")) {
      const [viewPart, anchorId] = fragment.slice(1).split("/");
      const view = VIEW_KEYS.includes(viewPart) ? viewPart : "overview";
      return { view, anchorId: anchorId || "" };
    }

    const parsed = commanderDeepLinks?.parseHashLink?.(hash);
    if (parsed?.kind && VIEW_BY_HASH_KIND[parsed.kind]) {
      return {
        view: VIEW_BY_HASH_KIND[parsed.kind],
        anchorId: parsed.anchorId || "",
      };
    }

    return { view: VIEW_KEYS.includes(fragment) ? fragment : "overview", anchorId: "" };
  }

  function appHash(view, anchorId = "") {
    const safeView = VIEW_KEYS.includes(view) ? view : "overview";
    return anchorId ? `#/${safeView}/${anchorId}` : `#/${safeView}`;
  }

  function applySelectedView() {
    for (const view of VIEW_KEYS) {
      const selected = view === selectedView;
      const container = document.getElementById(`view-${view}`);
      const link = document.querySelector(`[data-view-link="${view}"]`);

      if (container) container.hidden = !selected;
      if (link) {
        if (selected) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }
  }

  function selectView(view, options = {}) {
    selectedView = VIEW_KEYS.includes(view) ? view : "overview";
    applySelectedView();

    if (options.updateHash) {
      const nextHash = appHash(selectedView);
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    }
  }

  function scrollToHashTarget() {
    const { anchorId: targetId } = parseAppRoute(window.location.hash);
    if (!targetId) return;

    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function scrollToDeck(deckId) {
    const targetId = deckAnchorId(deckId);
    const deckSearch = document.getElementById("deck-search");

    deckSearchQuery = "";
    if (deckSearch) deckSearch.value = "";
    showInactiveDecks = true;
    selectedView = "decks";
    renderForSelectedTab();

    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      window.location.hash = appHash("decks", targetId);
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function renderPlayerDeckStats() {
    if (!commanderPlayerInsights?.renderPlayerDeckStats) return;
    commanderPlayerInsights.renderPlayerDeckStats({
      selectedTab,
      playerDeckStats2026,
      playersIn2026,
      selectedPlayer: selectedPlayerForDeckStats,
      setSelectedPlayer(nextPlayer) {
        selectedPlayerForDeckStats = nextPlayer;
      },
      deckNameFromId,
      winRate,
      pctText,
      appendTextCell,
      appendEmptyRow,
    });
  }

  function renderHeadToHeadStats() {
    if (!commanderPlayerInsights?.renderHeadToHeadStats) return;
    commanderPlayerInsights.renderHeadToHeadStats({
      selectedTab,
      headToHeadStats2026,
      playersIn2026,
      selectedPlayer: selectedPlayerForHeadToHead,
      setSelectedPlayer(nextPlayer) {
        selectedPlayerForHeadToHead = nextPlayer;
      },
      winRate,
      pctText,
      appendTextCell,
      appendEmptyRow,
    });
  }

  function renderRecentFormAndStreaks() {
    if (!commanderPhaseOneInsights?.renderRecentFormAndStreaks) return;
    commanderPhaseOneInsights.renderRecentFormAndStreaks({
      selectedTab,
      recentForm: recentForm2026,
      winStreaks: winStreaks2026,
      deckNameFromId,
      pctText,
    });
  }

  function renderFunStats() {
    if (!commanderPhaseOneInsights?.renderFunStats) return;
    commanderPhaseOneInsights.renderFunStats({
      selectedTab,
      funStats: funStats2026,
      deckNameFromId,
      pctText,
    });
  }

  function renderWinsOverTimeChart() {
    if (!commanderPlayerInsights?.renderWinsOverTimeChart) return;
    commanderPlayerInsights.renderWinsOverTimeChart({
      selectedTab,
      matches: matches2026,
      buildMonthlyWins2026,
    });
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
      owner: d.owner ?? "",
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
          decks26.push({ deckId: def.id, name: def.name, commanders, owner: def.owner ?? "", active: !!def.active, wins: 0, matchesPlayed: 0 });
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
    renderDashboardSummary(players, decks);
    renderLatestSessionSummary();
    renderRecentMatches();
    renderSessions();
    renderSinglesTable(players);
    renderDecksTable(decks);

    // Only show player deck stats + charts on Overall/2026
    const showExtras = selectedTab === "overall" || selectedTab === "2026";
    commanderPlayerInsights?.setPlayerDeckSectionsVisible?.(showExtras);

    if (showExtras) {
      renderPlayerDeckStats();
      renderHeadToHeadStats();
      renderRecentFormAndStreaks();
      renderFunStats();
      renderWinsOverTimeChart();
    }

    applySelectedView();
    scrollToHashTarget();
  }

  // -----------------------------
  // Wire up existing sorting etc.
  // -----------------------------
  function wireAppViews() {
    const links = Array.from(document.querySelectorAll("[data-view-link]"));

    for (const link of links) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        selectView(link.dataset.viewLink, { updateHash: true });
      });
    }

    window.addEventListener("hashchange", () => {
      const route = parseAppRoute(window.location.hash);
      selectedView = route.view;
      applySelectedView();
      scrollToHashTarget();
    });
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

  function renderSinglesTable(players) {
    if (!commanderSingles?.renderSinglesTable) return;
    commanderSingles.renderSinglesTable({
      players,
      playerSearchQuery,
      normaliseText,
      playerAnchorId,
      appendTextCell,
      appendEmptyRow,
      pctText,
      winRate,
      singlesSortState,
      setAriaSort,
      sortIcons,
    });
  }

  function wireSinglesSorting(onChange) {
    if (!commanderSingles?.wireSinglesSorting) return;
    commanderSingles.wireSinglesSorting({
      makeSortable,
      singlesSortState,
      onChange,
    });
  }

  function renderDecksTable(deckRows) {
    if (!commanderDecks?.renderDecksTable) return;
    commanderDecks.renderDecksTable({
      deckRows,
      showInactiveDecks,
      deckSearchQuery,
      normaliseText,
      deckAnchorId,
      pctText,
      winRate,
      appendEmptyRow,
      matchCombination,
      fetchCommander: commanderScryfall.fetchCommander,
      decksSortState,
      setAriaSort,
      sortIcons,
    });
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

    commanderDecks?.updateToggleButton?.(showInactiveDecks);
  }

  function wireRecentMatchesControls(onChange) {
    const btn = document.getElementById("show-more-recent-matches");
    if (!btn) return;

    btn.addEventListener("click", () => {
      recentMatchesLimit = nextRecentMatchLimit();
      onChange();
    });
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
      headToHeadStats2026 = buildHeadToHeadStats(matches2026);
      recentForm2026 = commanderRecentForm?.buildRecentForm?.(matches2026, { limit: 5 });
      winStreaks2026 = commanderStreaks?.buildWinStreaks?.(matches2026);
      funStats2026 = commanderFunStats?.buildFunStats?.(matches2026);
      playersIn2026 = Array.from(playerDeckStats2026.keys()).sort();

      // Setup player dropdown
      commanderPlayerInsights?.populatePlayerDeckSelect?.({ playersIn2026 });
      commanderPlayerInsights?.populateHeadToHeadSelect?.({ playersIn2026 });
      commanderPlayerInsights?.wirePlayerDeckSelect?.({
        onChange(nextPlayer) {
          selectedPlayerForDeckStats = nextPlayer;
          renderPlayerDeckStats();
        },
      });
      commanderPlayerInsights?.wireHeadToHeadSelect?.({
        onChange(nextPlayer) {
          selectedPlayerForHeadToHead = nextPlayer;
          renderHeadToHeadStats();
        },
      });

      const rerender = () => renderForSelectedTab();

      const initialRoute = parseAppRoute(window.location.hash);
      selectedView = initialRoute.view;

      wireAppViews();
      wireTabs();
      wireSinglesSorting(rerender);
      wireDecksSorting(rerender);
      wireInactiveToggle(rerender);
      wireRecentMatchesControls(rerender);
      wireSearchControls(rerender);

      selectTab("overall");
    })
    .catch((err) => {
      showFatalError("One or more JSON files failed to load.", err.message || err);
      console.error(err);
    });
});
