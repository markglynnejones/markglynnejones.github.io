"use strict";

const { expect, test } = require("@playwright/test");

test("dashboard boots with populated primary sections", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Commander Wins Tracker" })).toBeVisible();
  await expect(page.locator("#last-updated-note")).toContainText("Latest match logged:");
  await expect(page.locator("#dashboard-summary-body .summary-card")).toHaveCount(8);
  await expect(page.locator("#recent-matches-body tr")).not.toHaveCount(0);
  await expect(page.locator("#view-overview")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("app view navigation switches top-level views", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Players" }).click();
  await expect(page).toHaveURL(/#\/players$/);
  await expect(page.locator("#view-players")).toBeVisible();
  await expect(page.locator("#view-overview")).toBeHidden();

  await page.getByRole("link", { name: "Decks" }).click();
  await expect(page).toHaveURL(/#\/decks$/);
  await expect(page.locator("#view-decks")).toBeVisible();

  await page.goto("/#/sessions");
  await expect(page.locator("#view-sessions")).toBeVisible();
});

test("year tabs switch match-log-only sections clearly", async ({ page }) => {
  await page.goto("/#/sessions");

  await page.getByRole("tab", { name: "2025" }).click();
  await expect(page.getByRole("tab", { name: "2025" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#sessions-note")).toContainText("Not available for 2025");

  await page.getByRole("tab", { name: "2026" }).click();
  await expect(page.getByRole("tab", { name: "2026" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#sessions-note")).toContainText("session(s) from the 2026 match log");
});

test("keyboard navigation supports accessibility shortcuts", async ({ page }) => {
  await page.goto("/#/sessions");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to dashboard content" })).toBeFocused();

  await page.getByRole("tab", { name: "Overall" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "2026" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Overall" })).toBeFocused();

  const sessionTabs = page.locator(".session-tab");
  await sessionTabs.first().focus();
  await page.keyboard.press("End");
  await expect(sessionTabs.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(sessionTabs.first()).toBeFocused();
});

test("player search filters the standings table", async ({ page }) => {
  await page.goto("/#/players");

  await page.locator("#player-search").fill("Jo");
  await expect(page.locator("#wins-table-body")).toContainText("Jo");
  await expect(page.locator("#wins-table-body")).not.toContainText("Jake");
  await expect(page.locator("#player-search-status")).toContainText(/player[s]? shown/);

  await page.locator("#player-search").fill("No Such Player");
  await expect(page.locator("#wins-table-body")).toContainText("No players match your search.");
  await expect(page.locator("#player-search-status")).toContainText("0 players shown");
});

test("sessions can switch selected dates", async ({ page }) => {
  await page.goto("/#/sessions");

  const sessionTabs = page.locator(".session-tab");
  await expect(sessionTabs.first()).toBeVisible();
  const count = await sessionTabs.count();
  expect(count).toBeGreaterThan(1);

  const firstLabel = await sessionTabs.nth(0).locator("span").innerText();
  const secondLabel = await sessionTabs.nth(1).locator("span").innerText();

  await sessionTabs.nth(1).click();
  await expect(page.locator("#session-panel h3")).toHaveText(secondLabel);
  await expect(page.locator("#session-panel h3")).not.toHaveText(firstLabel);
});

test("import preview parses valid raw notes without writing data", async ({ page }) => {
  await page.goto("/#/import");

  await expect(page.locator("#view-import")).toBeVisible();
  await page.locator("#import-notes").fill(`04/06 magic

Jon - bad misc - win
Liam - big sues`);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.locator("#import-preview-status")).toHaveText("1 match parsed.");
  await expect(page.locator("#import-preview-errors")).toBeHidden();
  await expect(page.locator("#import-preview-body tr")).toHaveCount(1);
  await expect(page.locator("#import-preview-body tr").first()).toContainText("2026-06-04");
  await expect(page.locator("#import-preview-body tr").first()).toContainText("Jo");
  await expect(page.locator("#import-preview-body tr").first()).toContainText("Bad Misc");
  await expect(page.locator("#import-preview-body tr").first()).toContainText("Big Sue's");
});

test("import preview reports unresolved decks", async ({ page }) => {
  await page.goto("/#/import");

  await page.locator("#import-notes").fill(`04/06 magic

Jo - mystery frog - win
Liam - big sues`);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.locator("#import-preview-status")).toContainText("1 issue found.");
  await expect(page.locator("#import-preview-errors")).toBeVisible();
  await expect(page.locator("#import-preview-errors")).toContainText("Couldn't resolve deck");
  await expect(page.locator("#import-preview-errors")).toContainText("Suggested new deck stub");
  await expect(page.locator("#import-preview-body tr")).toHaveCount(0);
});
