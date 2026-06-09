"use strict";

(function initCommanderSingles(global) {
  function updateSinglesSortArrows(config) {
    const { singlesSortState, setAriaSort, sortIcons } = config;
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

  function getSinglesSortedPlayers(config) {
    const { players, singlesSortState, winRate } = config;
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

  function renderSinglesTable(config) {
    const {
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
    } = config;
    const body = document.getElementById("wins-table-body");
    if (!body) return;

    body.innerHTML = "";

    const query = normaliseText(playerSearchQuery);
    const filtered = query
      ? players.filter((player) => normaliseText(player.name).includes(query))
      : players;
    const sorted = getSinglesSortedPlayers({
      players: filtered,
      singlesSortState,
      winRate,
    });

    for (const player of sorted) {
      const tr = document.createElement("tr");
      if (playerAnchorId) tr.id = playerAnchorId(player.name);
      appendTextCell(tr, player.name);
      appendTextCell(tr, player.wins ?? 0);
      appendTextCell(tr, player.matchesPlayed ?? 0);
      appendTextCell(tr, pctText(winRate(player.wins, player.matchesPlayed)));
      body.appendChild(tr);
    }

    if (sorted.length === 0) {
      appendEmptyRow(body, 4, "No players match your search.");
    }

    updateSinglesSortArrows({
      singlesSortState,
      setAriaSort,
      sortIcons,
    });
  }

  function wireSinglesSorting(config) {
    const { makeSortable, singlesSortState, onChange } = config;

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

  const api = {
    renderSinglesTable,
    wireSinglesSorting,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderSingles = api;
})(typeof window !== "undefined" ? window : globalThis);
