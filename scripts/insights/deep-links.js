"use strict";

(function initCommanderDeepLinks(global) {
  const TARGET_KINDS = new Set(["player", "deck", "session"]);
  const HASH_PREFIX_BY_KIND = {
    player: "player-row",
    deck: "deck-row",
    session: "session",
  };

  function stableHashPart(value) {
    return String(value || "").trim().replace(/[^a-z0-9_-]/gi, "-");
  }

  function anchorId(kind, value) {
    if (!TARGET_KINDS.has(kind)) return "";
    return `${HASH_PREFIX_BY_KIND[kind]}-${stableHashPart(value)}`;
  }

  function playerAnchorId(playerName) {
    return anchorId("player", playerName);
  }

  function deckAnchorId(deckId) {
    return anchorId("deck", deckId);
  }

  function sessionAnchorId(sessionDate) {
    return anchorId("session", sessionDate);
  }

  function tabAnchorId(tabKey) {
    return `tab-${stableHashPart(tabKey)}`;
  }

  function cleanHash(hash) {
    const raw = String(hash || "").trim();
    return raw.startsWith("#") ? raw.slice(1) : raw;
  }

  function normaliseHashValue(value) {
    return String(value || "").trim();
  }

  function hashFromParams(params) {
    const entries = [];
    for (const key of ["tab", "player", "deck", "session"]) {
      const value = normaliseHashValue(params?.[key]);
      if (value) entries.push([key, value]);
    }

    if (!entries.length) return "";

    const search = new URLSearchParams();
    for (const [key, value] of entries) search.set(key, value);
    return `#${search.toString()}`;
  }

  function buildHashLink(config = {}) {
    const tab = normaliseHashValue(config.tab);

    if (normaliseHashValue(config.player)) {
      return hashFromParams({ tab, player: config.player });
    }

    if (normaliseHashValue(config.deck)) {
      return hashFromParams({ tab, deck: config.deck });
    }

    if (normaliseHashValue(config.session)) {
      return hashFromParams({ tab, session: config.session });
    }

    return hashFromParams({ tab });
  }

  function parseLegacyAnchorHash(fragment) {
    if (fragment.startsWith("deck-row-")) {
      return {
        tab: "",
        kind: "deck",
        value: fragment.slice("deck-row-".length),
        anchorId: fragment,
      };
    }

    if (fragment.startsWith("player-row-")) {
      return {
        tab: "",
        kind: "player",
        value: fragment.slice("player-row-".length),
        anchorId: fragment,
      };
    }

    if (fragment.startsWith("session-")) {
      return {
        tab: "",
        kind: "session",
        value: fragment.slice("session-".length),
        anchorId: fragment,
      };
    }

    if (fragment.startsWith("tab-")) {
      return {
        tab: fragment.slice("tab-".length),
        kind: "",
        value: "",
        anchorId: fragment,
      };
    }

    return null;
  }

  function parseHashLink(hash) {
    const fragment = cleanHash(hash);
    const empty = { tab: "", kind: "", value: "", anchorId: "" };
    if (!fragment) return empty;

    const legacy = parseLegacyAnchorHash(fragment);
    if (legacy) return legacy;

    const params = new URLSearchParams(fragment);
    const tab = normaliseHashValue(params.get("tab"));

    for (const kind of ["player", "deck", "session"]) {
      const value = normaliseHashValue(params.get(kind));
      if (!value) continue;

      return {
        tab,
        kind,
        value,
        anchorId: anchorId(kind, value),
      };
    }

    return {
      tab,
      kind: "",
      value: "",
      anchorId: tab ? tabAnchorId(tab) : "",
    };
  }

  const api = {
    anchorId,
    buildHashLink,
    cleanHash,
    deckAnchorId,
    parseHashLink,
    playerAnchorId,
    sessionAnchorId,
    stableHashPart,
    tabAnchorId,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.CommanderDeepLinks = api;
})(typeof window !== "undefined" ? window : globalThis);
