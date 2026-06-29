# Implementation Plan

This plan turns the first product-roadmap steps into practical build work for the existing static app. It assumes the current GitHub Pages architecture stays in place for now.

## Guiding Decision

Build the strongest static group dashboard before adding a backend. The app should first answer the questions a regular playgroup asks after a few months of games:

- Who is winning overall?
- Who is improving recently?
- Which decks are performing well?
- Which matchups are interesting?
- What happened at the latest session?

Product stance:

- Build personal-first, with other playgroups in mind.
- Keep serious performance stats and fun group stats separated.
- Keep CLI import as the reliable personal workflow.
- Add browser-based import preview later, but do not remove CLI import.
- Do not build accounts yet; leave room for private group accounts if the project becomes hosted.

## Phase 1: Finished Dashboard

Goal: make the current app feel complete for personal and group use.

Serious stats should appear before fun stats. The first viewport should make the app feel useful and trustworthy; playful group stats can live in a later section or a separate tab.

Status: implemented on `product-roadmap-and-planning`.

### 1. Summary Cards

Add a compact dashboard band above the existing tables.

Cards:

- Total matches.
- Total sessions.
- Active players.
- Decks played.
- Latest session date.
- Most-played deck.
- Current top player.

Implementation:

- Add a `buildDashboardSummary` helper in `scripts/stats.js`.
- Add tests in `scripts/stats.test.js`.
- Add a render module such as `scripts/render/dashboard-summary.js`.
- Add a section near the top of `index.html`.
- Add styles in `styles.css` or `styles/sessions.css` if shared.

Acceptance criteria:

- Works on Overall, 2025, and 2026 tabs where data exists.
- Handles empty data without broken text.
- `npm test` and `npm run check` pass.

Implemented:

- Dashboard summary cards render above the core tables.
- The card layout is 4x2 on desktop, 2 columns on tablet, and 1 column on narrow mobile.

### 2. Head-To-Head Stats

Add player rivalry stats for 2026 match-log data.

Initial scope:

- For each pair of players, count shared matches.
- Count wins while both players were in the same pod.
- Show win split and leader.

Implementation:

- Add `buildHeadToHeadStats(matchFile)` in `scripts/stats.js`.
- Test 3-player, 4-player, and 5-player pods.
- Render a compact table or selectable player view in `scripts/render/player-insights.js`.

Acceptance criteria:

- No duplicated pair rows.
- Shared match count is correct.
- A winner gets credit against every other player in that pod.

Implemented:

- Player-focused head-to-head table renders for Overall and 2026.
- 2025 hides the section because there is no detailed match log.

### 3. Recent Form

Add "last N matches" stats for players and decks.

Initial scope:

- Last 5 and last 10 player form.
- Last 5 and last 10 deck form.
- Use match order by date and original array order within a date.

Implementation:

- Add `buildRecentForm(matchFile, limit)` in `scripts/stats.js`.
- Reuse existing win-rate helpers.
- Render as small columns in player/deck profile sections or a separate recent-form table.

Acceptance criteria:

- Handles players/decks with fewer than N matches.
- Does not mutate existing match data.

Implemented:

- `scripts/insights/recent-form.js` calculates last-5 form for players and decks.
- The dashboard renders leading recent player and deck form cards.

### 4. Streaks

Add lightweight streak stats.

Initial scope:

- Current player win streak.
- Best player win streak.
- Current deck win streak.
- Best deck win streak.

Implementation:

- Add `buildStreakStats(matchFile)` in `scripts/stats.js`.
- Test mixed dates and repeated sessions.
- Render only the highest-signal streaks first.

Acceptance criteria:

- Losing or not appearing breaks a win streak only when the player/deck appears in a match.
- Missing dates or invalid matches are ignored consistently with existing helpers.

Implemented:

- `scripts/insights/streaks.js` calculates current and best player/deck win streaks.
- The dashboard renders current and best streak leaders.

### 5. Deep Links

Make the dashboard easier to share.

Initial scope:

- Deck row anchors already exist; make them more visible and consistent.
- Add player anchors.
- Add session anchors.
- Preserve selected tab in the URL hash where practical.

Acceptance criteria:

- Opening a copied link scrolls to the relevant player, deck, or session.
- Links do not break normal tab navigation.

Implemented:

- `scripts/insights/deep-links.js` provides stable hash helpers.
- Deck anchors preserve the existing `deck-row-...` format.
- Player rows and session panels now receive stable IDs for hash scrolling.

### 6. Fun Stats Section

Add a clearly separated section for lighter group stats after the core dashboard is solid.

Initial scope:

- Most loyal pilot: player/deck pair with the most matches.
- Nemesis pairing: head-to-head pair with enough shared matches and a clear leader.
- Deck comeback: deck with weak overall record but strong recent form.
- Most rotated player: player with the highest number of unique decks.

Implementation:

- Reuse serious stat helpers where possible.
- Keep fun-stat labels human-readable and avoid letting joke labels leak into core tables.
- Render in a separate section beneath serious stats.

Acceptance criteria:

- The section can be hidden or moved without affecting serious stats.
- Each stat has a deterministic calculation and test coverage.

Implemented:

- `scripts/insights/fun-stats.js` calculates neutral fun-stat data.
- Fun stats render in a separate section below serious insight sections.

### 7. Mobile Polish

Initial scope:

- Improve readable spacing on narrow screens.
- Keep tables usable with horizontal scrolling.
- Make controls easier to tap.
- Reflow session panels cleanly.

Implemented:

- `styles/mobile-polish.css` is linked after the existing stylesheets.

## Phase 2: Safer Data Model

Goal: reduce migration pain before the app grows.

Before starting Phase 2, complete the UI modernization preparation captured in:

- `docs/ui-restructure-plan.md`
- `docs/colour-system-plan.md`
- `docs/test-coverage-plan.md`
- `docs/accessibility-plan.md`
- `docs/ui-modernization-implementation-plan.md`

Recommended pre-Phase-2 order:

1. Add browser-level Playwright smoke coverage. Implemented.
2. Add hash-driven top-level views while keeping one `index.html`. Implemented.
3. Introduce the colour token system. Implemented.
4. Apply accessibility fixes for navigation, headings, tables, focus, and mobile table scroll. Implemented.
5. Then start data model changes such as match IDs, notes, tags, and exports.

### 1. Match IDs

Add stable IDs to matches.

Suggested format:

```text
2026-05-29-001
```

Implementation:

- Update importer to generate IDs for new matches.
- Update validator to accept and require IDs for new schema data.
- Add a migration script for existing 2026 matches.
- Keep display behavior unchanged.

Implemented:

- `scripts/match-ids.js` centralizes match ID formatting and generation.
- `scripts/migrate-match-ids.js` migrates existing match files.
- `data/matches-2026.json` has stable IDs for all current matches.
- The importer assigns IDs to newly added matches.
- The validator now requires unique IDs that match each match date.

### 2. Optional Notes And Tags

Add optional fields:

- `notes`: string.
- `tags`: array of strings.

Example tags:

- `planechase`
- `precon`
- `league`
- `proxy`
- `archenemy`

Keep these optional until the import flow needs them.

Implemented:

- The match formatter preserves optional `notes` and `tags` when present.
- The validator accepts optional non-empty `notes`.
- The validator accepts optional normalized lowercase slug `tags`.
- The validator rejects empty notes, non-array tags, malformed tags, and duplicate tags.

### 3. Export

Add a simple export command:

```bash
npm run export -- --format csv --year 2026
```

Initial export targets:

- Matches CSV.
- Player stats CSV.
- Deck stats CSV.

Implemented:

- `npm run export -- --format csv --year 2026` writes all CSV exports under `data/exports/`.
- `--target matches`, `--target players`, and `--target decks` export individual CSVs to stdout.
- `--out path` writes a single target to a specific file.
- Match exports include stable IDs, notes, and tags.

## Phase 3: Import UX Prototype

Goal: validate whether non-technical users can use the workflow.

Initial approach:

- Keep the CLI importer as the source of truth.
- Extract parser/resolver helpers so a browser preview can reuse them later.
- Build a local static paste-and-preview screen only after the parser is split cleanly.
- Do not remove or weaken the CLI workflow; it remains the fastest personal-use path.

Important constraint:

- A static GitHub Pages app cannot safely write back to repo JSON by itself. The first browser import UX should be preview-only or local-storage-only unless a backend is added.

## Future Account Option

Do not implement accounts in the current static phase. If demand from other playgroups appears, the likely account model is group-first:

- Groups own matches, sessions, decks, and stats.
- Users can administer one or more groups.
- Players do not need login accounts unless they want to manage their own profile later.
- Imports, edits, exports, and invites are admin actions.
- Groups are private by default.

## Open Product Questions

These should be answered before Phase 3 or any commercial work:

- If other groups use it, are you imagining a setup service first or a self-serve hosted product?

Answered:

- Build personal/private first, but keep other playgroups in mind.
- Include both serious and fun stats, separated in the UI.
- Plan browser-based import preview, while keeping CLI import for personal use.

## Next Recommended Ticket

Build dashboard summary cards first. It is visible, low risk, and creates the top-level product feel needed before deeper analytics.
