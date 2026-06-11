"use strict";

(function initCommanderDecks(global) {
  function updateDecksSortArrows(config) {
    const { decksSortState, setAriaSort, sortIcons } = config;
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

  function getSortedDeckRows(config) {
    const { deckRows, decksSortState, winRate } = config;
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

  async function fillDeckCommanderInfo(config) {
    const {
      commanders,
      tdColours,
      tdCombinations,
      tdImage,
      fetchCommander,
      matchCombination,
    } = config;

    tdColours.textContent = "Loading";
    tdCombinations.textContent = "Loading";
    tdImage.textContent = "Loading";

    const results = await Promise.all(commanders.map(fetchCommander));
    const combinedColors = [...new Set(results.flatMap((result) => result.colors))].filter(Boolean);
    const comboName = matchCombination(combinedColors);

    tdColours.textContent = "";
    for (const color of combinedColors) {
      const img = document.createElement("img");
      img.className = "mana-symbol";
      img.src = `images/${color}.svg`;
      img.alt = `${color} mana`;
      tdColours.appendChild(img);
      tdColours.appendChild(document.createTextNode(" "));
    }

    tdCombinations.textContent = comboName;

    tdImage.textContent = "";
    results.forEach((result, index) => {
      const name = commanders[index];
      if (!result.image) {
        const unavailable = document.createElement("span");
        unavailable.textContent = "Image not available";
        tdImage.appendChild(unavailable);
      } else {
        const img = document.createElement("img");
        img.className = "commander-image";
        img.src = result.image;
        img.alt = `${name} card art`;
        img.loading = "lazy";
        tdImage.appendChild(img);
      }

      if (index < results.length - 1) tdImage.appendChild(document.createElement("br"));
    });
  }

  function renderDecksTable(config) {
    const {
      deckRows,
      showInactiveDecks,
      deckSearchQuery,
      normaliseText,
      deckAnchorId,
      pctText,
      winRate,
      appendRowHeaderCell,
      appendEmptyRow,
      matchCombination,
      fetchCommander,
      decksSortState,
      setAriaSort,
      sortIcons,
    } = config;
    const body = document.getElementById("decks-table-body");
    const status = document.getElementById("deck-search-status");
    if (!body) return;

    body.innerHTML = "";

    let rows = deckRows;
    if (!showInactiveDecks) rows = rows.filter((row) => row.active);

    const query = normaliseText(deckSearchQuery);
    if (query) {
      rows = rows.filter((row) => {
        const commanders = (row.commanders || []).join(" ");
        return normaliseText(`${row.name} ${row.owner || ""} ${commanders}`).includes(query);
      });
    }

    const sorted = getSortedDeckRows({
      deckRows: rows,
      decksSortState,
      winRate,
    });

    if (status) {
      status.textContent = `${sorted.length} deck${sorted.length === 1 ? "" : "s"} shown.`;
    }

    for (const row of sorted) {
      const tr = document.createElement("tr");
      if (row.deckId) tr.id = deckAnchorId(row.deckId);

      const tdName = document.createElement("th");
      const tdCommander = document.createElement("td");
      const tdOwner = document.createElement("td");
      const tdColours = document.createElement("td");
      const tdCombinations = document.createElement("td");
      const tdWins = document.createElement("td");
      const tdMatches = document.createElement("td");
      const tdWinPct = document.createElement("td");
      const tdImage = document.createElement("td");
      const tdActive = document.createElement("td");

      tdName.scope = "row";
      tdName.textContent = row.name;
      row.commanders.forEach((commander, index) => {
        const span = document.createElement("span");
        span.textContent = commander;
        tdCommander.appendChild(span);
        if (index < row.commanders.length - 1) tdCommander.appendChild(document.createElement("br"));
      });
      tdOwner.textContent = row.owner || "";
      tdWins.textContent = String(row.wins ?? 0);
      tdMatches.textContent = String(row.matchesPlayed ?? 0);
      tdWinPct.textContent = pctText(winRate(row.wins, row.matchesPlayed));
      tdActive.textContent = row.active ? "Yes" : "No";

      tr.appendChild(tdName);
      tr.appendChild(tdCommander);
      tr.appendChild(tdOwner);
      tr.appendChild(tdColours);
      tr.appendChild(tdCombinations);
      tr.appendChild(tdWins);
      tr.appendChild(tdMatches);
      tr.appendChild(tdWinPct);
      tr.appendChild(tdImage);
      tr.appendChild(tdActive);

      body.appendChild(tr);

      fillDeckCommanderInfo({
        commanders: row.commanders,
        tdColours,
        tdCombinations,
        tdImage,
        fetchCommander,
        matchCombination,
      }).catch(() => {
        tdColours.textContent = "Unknown";
        tdCombinations.textContent = "Unknown";
        tdImage.textContent = "Unavailable";
      });
    }

    if (sorted.length === 0) {
      appendEmptyRow(body, 10, "No decks match your search.");
    }

    updateDecksSortArrows({
      decksSortState,
      setAriaSort,
      sortIcons,
    });
    updateToggleButton(showInactiveDecks);
  }

  function updateToggleButton(showInactiveDecks) {
    const btn = document.getElementById("toggle-inactive-decks");
    if (!btn) return;

    btn.textContent = showInactiveDecks ? "Hide Inactive Decks" : "Show Inactive Decks";
    btn.setAttribute("aria-pressed", String(showInactiveDecks));
  }

  const api = {
    renderDecksTable,
    updateToggleButton,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderDecks = api;
})(typeof window !== "undefined" ? window : globalThis);
