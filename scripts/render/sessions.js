"use strict";

(function initCommanderSessions(global) {
  function renderSessions(config) {
    const {
      selectedTab,
      matches,
      selectedSessionDate,
      setSelectedSessionDate,
      buildSessionSummaries,
      shortDisplayDate,
      deckNameFromId,
      deckAnchorId,
      sessionAnchorId,
      scrollToDeck,
    } = config;

    const container = document.getElementById("sessions-body");
    const note = document.getElementById("sessions-note");
    if (!container || !note) return;

    container.innerHTML = "";

    const tabUses2026Log = selectedTab === "2026" || selectedTab === "overall";
    if (!tabUses2026Log) {
      note.textContent = "Not available for 2025 (no match log).";
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No session log available for this tab.";
      container.appendChild(empty);
      return;
    }

    const sessions = buildSessionSummaries(matches);
    note.textContent = sessions.length ? `${sessions.length} session(s) from the 2026 match log.` : "No sessions logged yet.";

    if (!sessions.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No sessions logged yet.";
      container.appendChild(empty);
      return;
    }

    let activeDate = selectedSessionDate;
    if (!activeDate || !sessions.some((session) => session.date === activeDate)) {
      activeDate = sessions[0].date;
      setSelectedSessionDate(activeDate);
    }

    const tabs = document.createElement("div");
    tabs.className = "session-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Session dates");

    const panel = document.createElement("div");
    panel.className = "session-panel";

    for (const session of sessions) {
      const button = document.createElement("button");
      const selected = session.date === activeDate;

      button.type = "button";
      button.className = "session-tab";
      button.id = `session-tab-${session.date}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(selected));
      button.setAttribute("aria-controls", "session-panel");
      button.tabIndex = selected ? 0 : -1;

      const label = document.createElement("span");
      label.textContent = shortDisplayDate(session.date);
      const meta = document.createElement("small");
      meta.textContent = `${session.matchesPlayed} games`;
      button.appendChild(label);
      button.appendChild(meta);

      button.addEventListener("click", () => {
        setSelectedSessionDate(session.date);
        renderSessions({ ...config, selectedSessionDate: session.date });
      });

      button.addEventListener("keydown", (event) => {
        const currentIndex = sessions.findIndex((entry) => entry.date === session.date);
        if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          let next = currentIndex;
          if (event.key === "Home") next = 0;
          else if (event.key === "End") next = sessions.length - 1;
          else {
            const delta = event.key === "ArrowRight" ? 1 : -1;
            next = (currentIndex + delta + sessions.length) % sessions.length;
          }
          const nextDate = sessions[next].date;
          setSelectedSessionDate(nextDate);
          renderSessions({ ...config, selectedSessionDate: nextDate });
          document.getElementById(`session-tab-${nextDate}`)?.focus();
        }
      });

      tabs.appendChild(button);
    }

    const selectedSession = sessions.find((session) => session.date === activeDate) || sessions[0];
    panel.id = "session-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `session-tab-${selectedSession.date}`);
    panel.appendChild(
      sessionPanel({
        session: selectedSession,
        matches,
        shortDisplayDate,
        deckNameFromId,
        deckAnchorId,
        sessionAnchorId,
        scrollToDeck,
      }),
    );

    container.appendChild(tabs);
    container.appendChild(panel);
  }

  function sessionPanel(config) {
    const { session, matches, shortDisplayDate, deckNameFromId, deckAnchorId, sessionAnchorId, scrollToDeck } = config;
    const article = document.createElement("article");
    article.className = "session-card session-detail";
    if (sessionAnchorId) article.id = sessionAnchorId(session.date);

    const header = document.createElement("div");
    header.className = "session-card-header";

    const title = document.createElement("h3");
    title.textContent = shortDisplayDate(session.date);

    const meta = document.createElement("div");
    meta.className = "session-meta";
    meta.appendChild(sessionMetric("Games", session.matchesPlayed));
    meta.appendChild(sessionMetric("Players", session.players.length));
    meta.appendChild(sessionMetric("Decks", session.deckIds.length));

    header.appendChild(title);
    header.appendChild(meta);

    const winners = document.createElement("p");
    winners.className = "session-line session-winners";
    const winnersLabel = document.createElement("strong");
    winnersLabel.textContent = "Winners";
    winners.appendChild(winnersLabel);
    winners.appendChild(document.createTextNode(session.winsByPlayer.map((player) => `${player.name} ${player.wins}`).join(" · ")));

    const games = document.createElement("div");
    games.className = "session-games";

    const sessionMatches = [...(matches?.matches ?? [])].filter((match) => match.date === session.date);
    sessionMatches.forEach((match, index) => {
      games.appendChild(
        sessionGame({
          match,
          gameNumber: index + 1,
          deckNameFromId,
          deckAnchorId,
          scrollToDeck,
        }),
      );
    });

    article.appendChild(header);
    article.appendChild(winners);
    article.appendChild(games);
    return article;
  }

  function sessionGame(config) {
    const { match, gameNumber, deckNameFromId, deckAnchorId, scrollToDeck } = config;
    const game = document.createElement("div");
    game.className = "session-game";

    const header = document.createElement("div");
    header.className = "session-game-header";

    const title = document.createElement("strong");
    title.textContent = `Game ${gameNumber}`;

    const winner = document.createElement("span");
    winner.className = "session-winner-badge";
    winner.textContent = `Winner: ${match.winner || "Unknown"}`;

    header.appendChild(title);
    header.appendChild(winner);

    const players = document.createElement("div");
    players.className = "session-game-players";

    for (const player of match.players || []) {
      const item = document.createElement("span");
      const name = document.createElement("strong");
      const deck = document.createElement("a");

      name.textContent = `${player.name}: `;
      deck.href = `#${deckAnchorId(player.deckId)}`;
      deck.textContent = deckNameFromId(player.deckId);
      deck.addEventListener("click", (event) => {
        event.preventDefault();
        scrollToDeck(player.deckId);
      });

      item.appendChild(name);
      item.appendChild(deck);
      if (player.name === match.winner) item.className = "session-game-winner";
      players.appendChild(item);
    }

    game.appendChild(header);
    game.appendChild(players);
    return game;
  }

  function sessionMetric(label, value) {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    const small = document.createElement("small");

    strong.textContent = String(value);
    small.textContent = label;
    item.appendChild(strong);
    item.appendChild(small);
    return item;
  }

  const api = { renderSessions };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderSessions = api;
})(typeof window !== "undefined" ? window : globalThis);
