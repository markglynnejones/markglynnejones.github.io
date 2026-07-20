"use strict";

const { expect, test } = require("@playwright/test");

async function installClipboardMock(page) {
  await page.addInitScript(() => {
    window.__copiedText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedText = text;
        },
      },
    });
  });
}

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

test("demo mode loads fictional sample data", async ({ page }) => {
  await page.goto("/?sample=1#/overview");

  await expect(page.locator("#data-mode-note")).toContainText("Demo mode uses fictional sample data");
  await expect(page.locator("#last-updated-note")).toContainText("Sample data. Latest match logged:");
  await expect(page.locator("#recent-matches-body")).toContainText("Sam");

  await page.getByRole("link", { name: "Players" }).click();
  await expect(page).toHaveURL(/\?sample=1#\/players$/);
  await expect(page.locator("#wins-table-body")).toContainText("Alex");

  await page.getByRole("link", { name: "Special" }).click();
  await expect(page).toHaveURL(/\?sample=1#\/special$/);
  await expect(page.locator("#special-games-body")).toContainText("Sample chaos draft commander night");
  await expect(page.getByRole("link", { name: "Personal Data" })).toHaveAttribute("href", "./#/overview");
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

  await page.getByRole("link", { name: "Special" }).click();
  await expect(page).toHaveURL(/#\/special$/);
  await expect(page.locator("#view-special")).toBeVisible();
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

  const overallTab = page.locator("#tab-overall");
  const currentYearTab = page.locator("#tab-2026");
  await overallTab.focus();
  await expect(overallTab).toBeFocused();
  await overallTab.press("End");
  await expect(currentYearTab).toBeFocused();
  await currentYearTab.press("Home");
  await expect(overallTab).toBeFocused();

  const sessionTabs = page.locator(".session-tab");
  await expect(sessionTabs.first()).toBeVisible();
  await sessionTabs.first().focus();
  await expect(sessionTabs.first()).toBeFocused();
  await sessionTabs.first().press("End");
  await expect(sessionTabs.last()).toBeFocused();
  await sessionTabs.last().press("Home");
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

test("special view shows games outside normal Commander stats", async ({ page }) => {
  await page.goto("/#/special");

  await expect(page.locator("#view-special")).toBeVisible();
  await expect(page.locator("#special-games-note")).toContainText("2 special games recorded outside normal Commander stats.");
  await expect(page.locator("#special-games-body tr")).toHaveCount(2);
  await expect(page.locator("#special-games-body")).toContainText("Modern Horizons 3 box opening");
  await expect(page.locator("#special-games-body")).toContainText("Jake");
  await expect(page.locator("#special-games-body")).toContainText("Mark");
  await expect(page.locator("#special-games-body")).toContainText("Breya, Etherium Shaper");
  await expect(page.locator("#special-games-body")).toContainText("Ral, Monsoon Mage");
});

test("import preview parses valid raw notes without writing data", async ({ page }) => {
  await installClipboardMock(page);
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
  await expect(page.locator("#import-readiness-list")).toContainText("1 parsed match.");
  await expect(page.locator("#import-review-list")).toContainText("1 normal match looks ready to add.");
  await expect(page.getByRole("button", { name: "Copy parsed JSON" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copy deck stubs" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Copy import pack" })).toBeEnabled();

  await page.getByRole("button", { name: "Copy parsed JSON" }).click();
  await expect(page.locator("#import-preview-status")).toHaveText("Parsed JSON copied.");
  const copiedMatchesText = await page.evaluate(() => window.__copiedText);
  expect(JSON.parse(copiedMatchesText)).toMatchObject([
    {
      date: "2026-06-04",
      winner: "Jo",
      winnerId: "jo",
    },
  ]);

  await page.getByRole("button", { name: "Copy import pack" }).click();
  await expect(page.locator("#import-preview-status")).toHaveText("Import pack copied.");
  const copiedPackText = await page.evaluate(() => window.__copiedText);
  expect(JSON.parse(copiedPackText)).toMatchObject({
    schemaVersion: 1,
    year: "2026",
    matches: [
      {
        date: "2026-06-04",
        winner: "Jo",
      },
    ],
    deckStubs: [],
    duplicates: [],
    issues: [],
    specialGameReview: [],
  });
});

test("import preview warns about already logged matches", async ({ page }) => {
  await page.goto("/#/import");

  await page.locator("#import-notes").fill(`04/01 magic

Jo - fishes
Jake - baelyn - win
Mark - the vamp clamp
Liam - zombieland`);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.locator("#import-preview-status")).toHaveText("1 match parsed.");
  await expect(page.locator("#import-readiness-list")).toContainText("1 possible duplicate already logged.");
  await expect(page.locator("#import-review-list")).toContainText("0 normal matches look ready to add.");
  await expect(page.locator("#import-preview-body tr")).toHaveCount(1);
  await expect(page.locator("#import-preview-body tr").first()).toContainText("Already logged as 2026-01-04-001");
});

test("import preview reports unresolved decks", async ({ page }) => {
  await installClipboardMock(page);
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
  await expect(page.locator("#import-readiness-list")).toContainText("1 issue found.");
  await expect(page.locator("#import-review-list")).toContainText("1 unresolved deck stub can be copied into deck definitions.");
  await expect(page.getByRole("button", { name: "Copy parsed JSON" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Copy deck stubs" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copy import pack" })).toBeEnabled();

  await page.getByRole("button", { name: "Copy deck stubs" }).click();
  await expect(page.locator("#import-preview-status")).toHaveText("Deck stubs copied.");
  const copiedText = await page.evaluate(() => window.__copiedText);
  expect(JSON.parse(copiedText)).toMatchObject([
    {
      id: "mystery-frog",
      name: "Mystery Frog",
      active: true,
    },
  ]);
});

test("import preview flags possible special-game blocks in the import pack", async ({ page }) => {
  await installClipboardMock(page);
  await page.goto("/#/import");

  await page.locator("#import-notes").fill(`04/06 magic

Jon - bad misc - win
Liam - big sues

---

Special games

Alex - Borrowed Dragons - win
Casey - Graveyard Soup`);
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.locator("#import-review-list")).toContainText("1 possible special-game block should stay outside normal standings.");

  await page.getByRole("button", { name: "Copy import pack" }).click();
  const copiedPackText = await page.evaluate(() => window.__copiedText);
  expect(JSON.parse(copiedPackText)).toMatchObject({
    specialGameReview: [
      {
        block: 2,
        reason: expect.stringContaining("Possible special-game block"),
      },
    ],
  });
});

test("import preview keeps and clears local drafts", async ({ page }) => {
  await page.goto("/#/import");

  await page.locator("#import-year").fill("2027");
  await page.locator("#import-notes").fill(`05/07 magic

Jo - bad misc - win
Liam - big sues`);

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("button", { name: "Copy parsed JSON" })).toBeEnabled();
  await page.locator("#import-notes").fill("05/07 magic");
  await expect(page.locator("#import-readiness-list")).toContainText("Draft changed. Run preview again.");
  await expect(page.getByRole("button", { name: "Copy parsed JSON" })).toBeDisabled();

  await page.reload();
  await expect(page.locator("#import-year")).toHaveValue("2027");
  await expect(page.locator("#import-notes")).toHaveValue("05/07 magic");

  await page.getByRole("button", { name: "Clear draft" }).click();
  await expect(page.locator("#import-year")).toHaveValue("2026");
  await expect(page.locator("#import-notes")).toHaveValue("");
  await expect(page.locator("#import-preview-status")).toHaveText("Draft cleared.");

  await page.reload();
  await expect(page.locator("#import-year")).toHaveValue("2026");
  await expect(page.locator("#import-notes")).toHaveValue("");
});
