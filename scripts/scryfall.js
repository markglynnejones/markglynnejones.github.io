(function initScryfallModule(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CommanderScryfall = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createScryfallModule() {
  const SCRYFALL_CACHE_KEY = "commanderScryfallCache_v1";
  const SCRYFALL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  function normaliseCommanderName(name) {
    return (name || "").split("//")[0].trim().toLowerCase();
  }

  function mapScryfallColorsToNames(colors) {
    const mapping = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
    const mapped = Array.isArray(colors) ? colors.map((color) => mapping[color]).filter(Boolean) : [];
    return mapped.length > 0 ? mapped : ["Colorless"];
  }

  function createCommanderScryfallClient(options = {}) {
    const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const storage = Object.prototype.hasOwnProperty.call(options, "storage")
      ? options.storage
      : (typeof localStorage !== "undefined" ? localStorage : null);
    const now = options.now || Date.now;
    const setTimeoutImpl = options.setTimeoutImpl || setTimeout;
    const clearTimeoutImpl = options.clearTimeoutImpl || clearTimeout;
    const cache = options.cache || new Map();
    const maxConcurrency = options.maxConcurrency || 6;

    let saveCacheTimer = null;
    let activeScryfall = 0;
    const scryfallQueue = [];

    function loadCacheFromStorage() {
      if (!storage) return;

      try {
        const raw = storage.getItem(SCRYFALL_CACHE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        const currentTime = now();

        for (const [key, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          if (!value.cachedAt || currentTime - value.cachedAt > SCRYFALL_CACHE_TTL_MS) continue;
          cache.set(key, value);
        }
      } catch {
        // Ignore broken cache data.
      }
    }

    function saveCacheToStorageDebounced() {
      if (!storage) return;

      try {
        if (saveCacheTimer) clearTimeoutImpl(saveCacheTimer);
        saveCacheTimer = setTimeoutImpl(() => {
          const obj = Object.fromEntries(cache.entries());
          storage.setItem(SCRYFALL_CACHE_KEY, JSON.stringify(obj));
        }, 250);
      } catch {
        // Ignore storage write failures.
      }
    }

    function drainScryfallQueue() {
      while (activeScryfall < maxConcurrency && scryfallQueue.length) {
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

    function runWithScryfallLimit(taskFn) {
      return new Promise((resolve, reject) => {
        scryfallQueue.push({ taskFn, resolve, reject });
        drainScryfallQueue();
      });
    }

    async function fetchCommander(commanderName) {
      const key = normaliseCommanderName(commanderName);
      if (!key) return { colors: [], image: null };

      if (cache.has(key)) {
        const cached = cache.get(key);
        return { colors: cached.colors || [], image: cached.image || null };
      }

      if (!fetchImpl) return { colors: [], image: null };

      return runWithScryfallLimit(async () => {
        if (cache.has(key)) {
          const cached = cache.get(key);
          return { colors: cached.colors || [], image: cached.image || null };
        }

        const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(key)}`;
        const response = await fetchImpl(url, { headers: { Accept: "application/json" } });

        if (!response.ok) {
          cache.set(key, { colors: [], image: null, cachedAt: now() });
          saveCacheToStorageDebounced();
          return { colors: [], image: null };
        }

        const cardData = await response.json();
        const face = Array.isArray(cardData.card_faces) ? cardData.card_faces[0] : cardData;

        const colors = mapScryfallColorsToNames(face?.colors);
        const image = face?.image_uris?.normal ?? cardData?.image_uris?.normal ?? null;

        cache.set(key, { colors, image, cachedAt: now() });
        saveCacheToStorageDebounced();

        return { colors, image };
      });
    }

    return {
      cache,
      fetchCommander,
      loadCacheFromStorage,
    };
  }

  return {
    createCommanderScryfallClient,
    mapScryfallColorsToNames,
    normaliseCommanderName,
  };
});
