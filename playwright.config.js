"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  webServer: {
    command: "python3 -m http.server 8788",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
  use: {
    baseURL: "http://127.0.0.1:8788",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
