#!/usr/bin/env node

const assert = require("assert");

const {
  createCommanderScryfallClient,
  mapScryfallColorsToNames,
  normaliseCommanderName,
} = require("./scryfall");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      throw error;
    }
  }
}

function immediateTimeout(fn) {
  fn();
  return 1;
}

test("normaliseCommanderName uses the first card face for split cards", () => {
  assert.strictEqual(normaliseCommanderName(" Susan Foreman // The Twelfth Doctor "), "susan foreman");
});

test("mapScryfallColorsToNames maps card colours and falls back to colorless", () => {
  assert.deepStrictEqual(mapScryfallColorsToNames(["U", "R"]), ["Blue", "Red"]);
  assert.deepStrictEqual(mapScryfallColorsToNames([]), ["Colorless"]);
  assert.deepStrictEqual(mapScryfallColorsToNames(undefined), ["Colorless"]);
});

test("fetchCommander fetches and caches commander data", async () => {
  const calls = [];
  const client = createCommanderScryfallClient({
    now: () => 1234,
    storage: null,
    setTimeoutImpl: immediateTimeout,
    clearTimeoutImpl: () => {},
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        async json() {
          return {
            colors: ["B", "G"],
            image_uris: { normal: "https://example.test/card.jpg" },
          };
        },
      };
    },
  });

  assert.deepStrictEqual(await client.fetchCommander("Hearthhull, the Worldseed"), {
    colors: ["Black", "Green"],
    image: "https://example.test/card.jpg",
  });
  assert.deepStrictEqual(await client.fetchCommander("Hearthhull, the Worldseed"), {
    colors: ["Black", "Green"],
    image: "https://example.test/card.jpg",
  });
  assert.strictEqual(calls.length, 1);
  assert.match(calls[0], /fuzzy=hearthhull%2C%20the%20worldseed/);
});

test("fetchCommander reads colours and image from the first card face", async () => {
  const client = createCommanderScryfallClient({
    storage: null,
    setTimeoutImpl: immediateTimeout,
    clearTimeoutImpl: () => {},
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          card_faces: [
            {
              colors: ["W", "U"],
              image_uris: { normal: "https://example.test/front.jpg" },
            },
            {
              colors: ["B"],
              image_uris: { normal: "https://example.test/back.jpg" },
            },
          ],
        };
      },
    }),
  });

  assert.deepStrictEqual(await client.fetchCommander("Susan Foreman // The Twelfth Doctor"), {
    colors: ["White", "Blue"],
    image: "https://example.test/front.jpg",
  });
});

test("loadCacheFromStorage ignores expired cache entries", async () => {
  const storage = {
    getItem() {
      return JSON.stringify({
        fresh: { colors: ["Red"], image: "fresh.jpg", cachedAt: 1000 * 60 * 60 * 24 * 30 },
        stale: { colors: ["Blue"], image: "stale.jpg", cachedAt: 1 },
      });
    },
    setItem() {},
  };
  const client = createCommanderScryfallClient({
    now: () => 1000 * 60 * 60 * 24 * 31,
    storage,
    fetchImpl: async () => {
      throw new Error("should not fetch fresh cached commander");
    },
  });

  client.loadCacheFromStorage();

  assert.deepStrictEqual(await client.fetchCommander("Fresh"), {
    colors: ["Red"],
    image: "fresh.jpg",
  });
  assert.strictEqual(client.cache.has("stale"), false);
});

runTests();
