# Test Coverage Plan

## Current Coverage

The current test suite is intentionally lightweight and runs with plain Node scripts from `package.json`.

- `npm test` runs importer, stats, insights, data validation, Scryfall helper, deck lookup, and smoke checks.
- `npm run check` validates canonical JSON data through `scripts/check-data.js`.
- `scripts/smoke.test.js` checks that `index.html` references existing local assets, browser scripts load in the expected order, required render target IDs exist, sessions use the compact panel markup, and render/helper modules expose the globals expected by `scripts.js`.
- Unit coverage is strongest around data transformation: raw note parsing, duplicate import behavior, stable stat calculations, insight builders, date handling, validation errors, and module exports.

This is a good foundation for the current no-build static app. It catches data shape regressions and most pure calculation regressions without requiring a browser.

## Coverage Gaps

The richer UI now has behavior that can regress while all current tests still pass.

- Full page boot is not tested in a browser, including `DOMContentLoaded`, JSON fetches, global module wiring, and first render.
- Year tab behavior is only structurally checked. There is no test for click or keyboard tab selection, `aria-selected`, `tabindex`, `aria-labelledby`, or 2025-only empty states.
- Table interactions are not covered end to end: player search, deck search, singles sorting, deck sorting, sort arrows, and `aria-sort`.
- The inactive deck toggle is not covered in a browser, including `aria-pressed`, label changes, and hidden inactive rows.
- Recent match expansion is not covered: initial limit, button text, hidden state, and progressive expansion.
- Session tabs are not covered in a browser: default selected session, click selection, arrow-key navigation, `role=tablist`, selected tab focus, and panel content updates.
- Deep links and in-page navigation are not covered: deck anchors, session anchors, hash parsing, search reset during deck scrolling, and inactive deck visibility during deck scroll.
- Data-loading failure UI is not covered. A missing or invalid JSON response could fail silently from a user's perspective.
- Responsive behavior is not covered. The current smoke checks cannot catch mobile overflow, broken sticky/table layouts, hidden controls, or content overlap.
- Async commander enrichment is only indirectly covered through helper tests. Browser tests should ensure deck rows remain usable while Scryfall/color/image cells are pending or unavailable.

## Recommended Browser Coverage

Add Playwright as the browser test layer after the current Node suite remains green. Keep the first version small and focused on user-visible regressions, not implementation details.

Use a local static server against the repo root, then test the real `index.html` with real local `data/*.json` files. Stub only external Scryfall image/card requests if they become flaky or slow; do not stub the app's own JSON data in the main smoke path.

High-value Playwright tests:

- **Boot smoke:** page loads without console errors, header shows the latest logged match, dashboard summary renders cards, and the core sections contain non-empty data.
- **Year tabs:** selecting Overall, 2025, and 2026 updates selected tab ARIA state and switches sections that depend on the 2026 match log. The 2025 tab should show "Not available for 2025" for match-log-only areas.
- **Singles table:** search for a known player filters rows, an unmatched search shows the empty state, and clicking a sortable header changes row order plus `aria-sort`.
- **Decks table:** search by deck or commander filters rows, inactive toggle changes `aria-pressed` and row visibility, and sorting by name/wins/matches/win rate changes row order predictably.
- **Recent matches:** initial render shows the first limit, the show-more button increases the visible count, and the button hides when no further expansion is available.
- **Sessions:** first session is selected by default, clicking another session changes the panel, arrow keys move focus/selection, and the panel lists games, winners, players, and deck links.
- **Deep links:** loading with a known deck hash or clicking a deck link from a session lands on a matching deck row and keeps the row present even if inactive decks were previously hidden.
- **Failure state:** forcing one local JSON fetch to return 404 shows the fatal data-loading banner with useful text.
- **Responsive smoke:** at one mobile viewport and one desktop viewport, key controls are visible, main tables/sections do not cause obvious horizontal page overflow, and no critical section is empty after load.

## What Not To Test In Playwright

Do not duplicate pure logic already covered by Node tests.

- Do not re-test every stat formula, importer branch, alias resolution path, or data validator rule in the browser.
- Do not assert exact full-table contents for every section; prefer a few stable rows and counts that prove the feature works.
- Do not snapshot the whole page. The UI is still evolving and full snapshots will create noisy churn.
- Do not depend on live Scryfall availability, remote image loading, or exact card art URLs.
- Do not test CSS pixel perfection. Use browser tests for layout breakage signals, accessibility state, visibility, and interaction outcomes.
- Do not cover every deck, player, or historical match combination. Use representative fixtures from current canonical data.

## Safe Rollout Sequence

1. Keep `npm test` and `npm run check` as required pre-finish gates.
2. Add Playwright in a separate change from major UI restructuring so failures are easy to attribute.
3. Start with one browser smoke file covering page boot, no console errors, selected tab state, and non-empty primary sections.
4. Add interaction tests for tabs, searches, sorting, inactive deck toggle, recent match expansion, and sessions.
5. Add a small responsive smoke after the interaction tests are stable.
6. Add failure-state coverage for missing JSON after the happy-path browser tests are reliable.
7. Wire Playwright into a separate script such as `npm run test:browser` first.
8. Once stable locally and in CI, include it in a broader gate such as `npm run test:all` or add it to `npm test` if runtime remains acceptable.

## Acceptance Criteria Before UI Restructure

Before restructuring the UI, the repo should have a baseline browser safety net.

- `npm test` passes.
- `npm run check` passes.
- `npm run test:browser` exists and passes locally.
- Browser smoke proves `index.html` boots from a local static server using real local data.
- Browser tests cover at least: year tabs, singles search/sort, deck search/toggle/sort, recent match expansion, and session tab selection.
- Browser tests include at least one desktop viewport and one mobile viewport.
- Browser tests fail on uncaught page errors or failed local JSON loads.
- The plan for any expected DOM ID/class changes is documented before the restructure begins.

## Acceptance Criteria After UI Restructure

After restructuring the UI, the tests should prove that user workflows survived rather than that old markup survived.

- `npm test`, `npm run check`, and `npm run test:browser` pass.
- The page still boots from GitHub Pages-style static files with no build step.
- Existing user workflows still work: switch years, search players, sort tables, inspect decks, include inactive decks, expand recent matches, browse sessions, and follow deck/session deep links.
- Match-log-only areas still degrade clearly on 2025 views.
- Required accessibility state remains correct for tabs, sortable headers, toggle buttons, and session panels.
- Mobile and desktop smoke checks show the primary controls and data sections are visible and usable.
- Browser tests are updated to prefer roles, labels, and stable user-facing selectors over brittle layout-specific selectors.

## Ongoing Maintenance

Keep Node tests as the owner of calculations, imports, and data validation. Keep Playwright tests as the owner of browser integration, interaction, accessibility state, and responsive smoke coverage. When a UI bug reaches users or reviewers, add the smallest browser regression test that would have caught it.
