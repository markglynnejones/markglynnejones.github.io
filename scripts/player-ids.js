(function initPlayerIdsModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderPlayerIds = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPlayerIdsModule() {
  const PLAYER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const METADATA_KEYS = new Set(["schemaVersion"]);

  function normalise(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function playerIdFromName(name) {
    return normalise(name).replace(/\s+/g, "-");
  }

  function validPlayerId(value) {
    return typeof value === "string" && PLAYER_ID_PATTERN.test(value);
  }

  function buildPlayerLookup(playerDefinitions, playerAliases = {}) {
    const byId = new Map();
    const byName = new Map();
    const players = Array.isArray(playerDefinitions?.players) ? playerDefinitions.players : [];

    for (const player of players) {
      if (!player?.id) continue;
      byId.set(player.id, player);
      if (player.name) byName.set(normalise(player.name), player);
      for (const alias of player.aliases || []) {
        byName.set(normalise(alias), player);
      }
    }

    for (const [alias, canonicalName] of Object.entries(playerAliases || {})) {
      if (METADATA_KEYS.has(alias)) continue;
      const player = byName.get(normalise(canonicalName));
      if (player) byName.set(normalise(alias), player);
    }

    return { byId, byName };
  }

  return {
    buildPlayerLookup,
    normalisePlayerName: normalise,
    playerIdFromName,
    validPlayerId,
  };
});
