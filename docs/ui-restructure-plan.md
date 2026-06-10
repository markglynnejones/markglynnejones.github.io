# UI Restructure Plan

The dashboard has outgrown one continuous page. The current app renders summary cards, player tables, 2026-only player insights, recent form, fun stats, recent matches, sessions, a wins-over-time chart, and the full deck table into one `index.html` flow. This makes the page harder to scan, especially now that serious stats, session history, deck inventory, and lighter group stats are all competing for the same vertical space.

## Recommendation

Use a single `index.html` app with top-level internal views controlled by the URL hash. Do not split into multiple HTML pages yet.

This keeps the static GitHub Pages deployment simple, avoids duplicating script/style tags and data-loading logic, preserves the existing no-build architecture, and lets the current render modules be moved behind view containers incrementally. It also fits the existing hash-based deep-link work for players, decks, and sessions.

Multiple HTML pages are worth revisiting only if the app later gains substantially different page bundles, public share pages, or a build step that can centralize shared layout and assets.

## Option Comparison

### Single HTML With Internal Views

Shape:

- Keep `index.html` as the only page.
- Add a top-level view navigation above or alongside the existing year tabs.
- Wrap existing sections in view containers such as `data-view="overview"`.
- Show one view at a time with JavaScript and CSS.
- Keep one shared data load and one shared app state.

Pros:

- Lowest migration risk for the current static app.
- No repeated HTML head, scripts, styles, footer, or data boot code.
- Existing modules can keep rendering into the same element IDs.
- Existing year tabs can continue to filter data across views.
- Hash URLs work naturally on GitHub Pages.
- Browser refresh keeps the user on the same view without server routing.

Cons:

- Initial page still downloads all scripts and data.
- Render code may still update hidden sections unless rendering is view-aware.
- Requires careful hash parsing so view hashes do not break player/deck/session anchors.
- One HTML file can stay large unless section markup is kept tidy.

### Multiple HTML Pages

Shape:

- Create files such as `players.html`, `decks.html`, `sessions.html`, and `fun.html`.
- Each page loads shared CSS, stats helpers, data, and page-specific render code.
- Navigation uses normal links between static files.

Pros:

- Each page can be conceptually smaller.
- Browser history and URLs are straightforward.
- Future page-specific loading is easier if the app grows.
- Long-term fit for highly distinct views or share pages.

Cons:

- Repeats static layout and script includes without a build step.
- Shared state such as selected year, search, selected player, and deck visibility must be synchronized across pages.
- More places to update when adding scripts, cache-busting query strings, or common UI.
- Existing render modules assume many DOM targets exist on one page; each page would need guards or separate coordinators.
- GitHub Pages can serve the files, but there is no router fallback for clean client paths.

## Proposed Views

Keep the existing year tabs as a secondary filter: `Overall`, `2025`, `2026`. Add top-level views for the major user questions.

### Overview

Purpose: first stop for current standings and the latest useful context.

Sections:

- Dashboard Summary.
- Singles Wins Table, renamed to a clearer standings label if desired.
- Recent Form and Streaks.
- Recent Matches.
- Optional latest session summary above recent matches, using the existing `latest-session-summary` content.

Notes:

- This should stay serious and compact.
- On `2025`, hide or show existing empty states for 2026-only sections consistently.

### Players

Purpose: all player-focused analysis in one place.

Sections:

- Singles Wins Table.
- Player Deck Stats.
- Head-to-Head Stats.
- Wins Over Time chart.

Notes:

- Keep player search here.
- Player anchors should land on this view automatically.
- Future player profile cards belong here, not on Overview.

### Decks

Purpose: deck inventory and deck performance.

Sections:

- Decks Played table.
- Deck search.
- Hide inactive decks toggle.
- Future deck profile or deck-versus-deck sections.

Notes:

- Deck anchors should land on this view automatically.
- Session deck links should switch to this view, clear deck search, show inactive decks if needed, then scroll to the deck row.

### Sessions

Purpose: game-night history.

Sections:

- Sessions.
- Recent Matches, if it remains useful as a session-history companion.
- Future compact printable/shareable session recap.

Notes:

- Session anchors should land on this view automatically.
- Keep the existing session date tabs inside this view.

### Fun

Purpose: separated lighter group stats.

Sections:

- Fun Stats.
- Future achievements, nemesis labels, loyalty stats, and other group personality stats.

Notes:

- This view preserves the product guardrail that fun stats are useful but should not crowd serious standings.

## URL And Hash Behavior

Use hash URLs instead of new HTML files.

Recommended canonical hashes:

- `#/overview`
- `#/players`
- `#/decks`
- `#/sessions`
- `#/fun`

Recommended deep-link hashes:

- `#/players/player-row-{slug}`
- `#/decks/deck-row-{slug}`
- `#/sessions/session-{yyyy-mm-dd}`

Behavior:

- Empty hash defaults to `#/overview`.
- Unknown view defaults to `#/overview` without throwing.
- Existing legacy anchors such as `#deck-row-...`, `#player-row-...`, and `#session-...` should continue to work by inferring the target view and then scrolling.
- Top-level view changes should update history with `window.location.hash`.
- Year tab selection can stay in memory at first. If it needs to be shareable later, extend hashes to include query-like state, for example `#/players?year=2026`.
- View navigation should use buttons or links with `aria-current="page"` rather than `role="tab"` unless the content is implemented as a true tab interface. The existing year selector can keep its current tab semantics.

## Migration Steps

1. Add the planning-friendly view structure in `index.html`: a top-level view nav and wrappers around existing sections.
2. Assign stable section IDs to currently anonymous sections before moving them into wrappers.
3. Add minimal view state to `scripts.js`, separate from `selectedTab`.
4. Parse `window.location.hash` into `{ view, anchorId }`.
5. Render or reveal only the active view, then scroll to any anchor.
6. Preserve legacy hash links by mapping known anchor prefixes to views.
7. Update `scrollToDeck` so it switches to the Decks view before scrolling.
8. Decide whether hidden views still render. Initial migration can render all views and hide inactive containers; a later pass can skip expensive hidden rendering if needed.
9. Add focused tests for hash parsing if deep-link helpers remain in `scripts/insights/deep-links.js`.
10. Run `npm test` and `npm run check`, then manually verify direct links for Overview, Players, Decks, Sessions, Fun, one player, one deck, and one session.

## Risks

- Hash collisions: existing anchor-only links can conflict with new view hashes unless parsing is backward compatible.
- Hidden DOM state: controls in inactive views may retain stale values if render behavior is partly skipped.
- Accessibility regression: nested year tabs plus top-level navigation need clear labels and focus behavior.
- Duplicate content: placing Recent Matches in both Overview and Sessions would require either shared markup or a deliberate single home.
- 2025 behavior: several detailed sections are 2026-only; hiding whole views on 2025 would be confusing, so keep clear empty states.
- Mobile navigation: adding another nav row could crowd small screens unless top-level views are compact and wrap cleanly.
- Rendering cost: the full deck table with images may still be expensive if it renders while hidden.

## Acceptance Criteria

- The first screen shows top-level view navigation and defaults to Overview.
- Overview, Players, Decks, Sessions, and Fun can be opened directly by hash URL.
- Existing year tabs still work in every view where year filtering applies.
- Serious stats remain separated from Fun.
- Player, deck, and session deep links open the correct view and scroll/focus the target.
- Legacy links using current anchor hashes continue to work.
- Deck links from session details switch to the Decks view and reveal inactive decks when necessary.
- Hidden views do not create visible layout gaps or duplicate headings.
- The page remains fully static and deployable on GitHub Pages with no build step.
- `npm test` and `npm run check` pass after implementation.
