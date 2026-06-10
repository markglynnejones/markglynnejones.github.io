# UI Modernization Implementation Plan

This plan sequences UI modernization work before Phase 2 data model changes. It assumes separate detailed plans will cover navigation, colour, tests, and accessibility. The goal here is to coordinate safe delivery across parallel agents without destabilizing the current static dashboard.

## Scope

Modernize the dashboard shell, section structure, visual hierarchy, and reusable UI conventions while preserving the current data shape and static GitHub Pages deployment.

In scope:

- Reorganize dashboard sections for clearer scanning.
- Introduce reusable layout and component conventions.
- Improve empty, loading, and error states.
- Rationalize table, card, filter, and panel presentation.
- Prepare the UI to absorb Phase 2 fields such as match IDs, notes, tags, and CSV exports.

Out of scope:

- Phase 2 data model changes.
- Importer or validator schema changes.
- Account, backend, billing, or hosting work.
- Detailed navigation, colour, test, or accessibility specifications covered by separate plans.

## Sequencing Principles

- Keep the existing app behavior stable until each UI ticket has verification.
- Prefer additive component and style work before moving shared markup.
- Avoid mixing data model changes with UI modernization commits.
- Integrate shared files in controlled passes, especially `index.html`, `scripts.js`, and `styles.css`.
- Keep render-module ownership narrow so agents can work in parallel without repeatedly touching the same files.
- Ship small visual improvements that can be reviewed independently.

## Shared File Integration Model

The highest-conflict files are:

- `index.html`
- `scripts.js`
- `styles.css`

These files should be edited only during scheduled integration passes. Feature tickets should prefer changes in owned render modules and feature CSS files first, then queue any required shell wiring for the next integration pass.

Recommended controlled passes:

1. App shell pass: add stable section containers and any required stylesheet/script links.
2. Render wiring pass: connect already-built render modules to the shell.
3. Final cleanup pass: remove obsolete classes, reconcile CSS order, and verify no orphaned DOM hooks remain.

Agents should avoid opportunistic edits to shared files outside their assigned pass.

## Implementation Tickets

### Ticket 1: UI Inventory And Freeze Points

Purpose: record the current visible surfaces and decide which selectors, IDs, and render entry points must remain stable during modernization.

Ownership:

- Documentation-only or one agent reading app structure.
- No app code changes.

Dependencies:

- None.

Acceptance criteria:

- Inventory lists current dashboard sections, render modules, and major CSS files.
- Identifies shared-file hooks that should not be renamed casually.
- Notes which UI areas can be modernized independently.

Recommended commit:

- `docs: inventory current ui modernization surfaces`

### Ticket 2: Layout Skeleton

Purpose: introduce the target page structure without redesigning individual sections.

Ownership:

- One integration agent owns `index.html` for this pass.
- CSS owner may add or prepare a dedicated layout stylesheet if the colour plan allows it.

Dependencies:

- Ticket 1.
- Navigation plan should define any top-level app shell expectations before this starts.

Acceptance criteria:

- Existing dashboard content still renders in the same order or an explicitly approved order.
- Stable containers exist for core stats, player insights, deck insights, recent matches, sessions, and fun stats.
- Empty data states still appear where they previously did.
- `npm test` and `npm run check` pass.

Recommended commit:

- `ui: add modern dashboard layout skeleton`

### Ticket 3: Section Header And State Patterns

Purpose: standardize section titles, supporting metadata, empty states, and recoverable error messages across render modules.

Ownership:

- One agent owns shared UI helper functions if introduced.
- Section owners update only their assigned render modules.

Dependencies:

- Ticket 2.
- Accessibility plan should define heading-level expectations before final implementation.

Acceptance criteria:

- Sections use consistent heading hierarchy and state language.
- Empty states do not imply data loss or import failure when data is merely unavailable.
- Render modules remain usable in browser without a build step.
- Existing tests continue to pass.

Recommended commit:

- `ui: standardize dashboard section states`

### Ticket 4: Summary And Serious Stats Modernization

Purpose: make the first viewport more useful and trustworthy by improving the summary and serious stat sections.

Ownership:

- Owner files: `scripts/render/dashboard-summary.js`, `scripts/render/player-insights.js`, and related feature CSS.
- Avoid broad changes to fun stats or sessions in this ticket.

Dependencies:

- Ticket 2.
- Colour plan should provide approved token usage before visual styling is finalized.

Acceptance criteria:

- Summary cards remain accurate for Overall, 2025, and 2026 views.
- Serious stats appear before fun stats.
- Mobile layout does not require vertical text squeezing or overlapping content.
- No changes to stat calculations unless already covered by existing tests.

Recommended commit:

- `ui: modernize summary and serious stat sections`

### Ticket 5: Tables And Dense Data Surfaces

Purpose: make player, deck, singles, and recent-match tables easier to scan without changing their data contracts.

Ownership:

- Owner files: table render modules and table-specific CSS.
- Do not edit importer, validator, or canonical JSON.

Dependencies:

- Ticket 3.
- Test plan should define any smoke checks for table rendering before final merge.

Acceptance criteria:

- Tables remain horizontally usable on narrow screens.
- Sort, link, and anchor behavior remains unchanged where present.
- Numeric fields keep consistent alignment.
- Long player, deck, and commander names do not overlap controls or adjacent cells.

Recommended commit:

- `ui: improve dashboard table presentation`

### Ticket 6: Session And Match History Modernization

Purpose: improve session panels and recent-match presentation before match IDs, notes, and tags arrive in Phase 2.

Ownership:

- Owner files: `scripts/render/sessions.js`, `scripts/render/recent-matches.js`, `styles/sessions.css`, and `styles/matches.css`.
- Coordinate with Phase 2 owners on reserved display areas for notes and tags, but do not add the data fields yet.

Dependencies:

- Ticket 5 for shared table conventions if recent matches use them.

Acceptance criteria:

- Current session history remains complete and navigable.
- Date, winner, pod, and deck information remain visible without needing hover-only interaction.
- Layout has reserved, non-breaking space for future match metadata.
- Deep links to sessions and matches continue to work where currently supported.

Recommended commit:

- `ui: modernize sessions and match history`

### Ticket 7: Fun Stats Separation

Purpose: visually separate lighter group stats from serious performance stats while preserving the deterministic calculations.

Ownership:

- Owner files: `scripts/render/phase-one-insights.js`, `scripts/insights/fun-stats.js` only if labels need presentation metadata, and related CSS.
- Avoid changing fun-stat formulas unless a bug is found and tested separately.

Dependencies:

- Ticket 4.
- Colour plan should define whether fun stats use distinct accents or only spacing and labeling.

Acceptance criteria:

- Fun stats appear after serious stats.
- Labels stay human-readable without bleeding into core standings language.
- The section can be hidden or moved without breaking serious stat rendering.
- Existing fun-stat tests pass.

Recommended commit:

- `ui: separate fun stats presentation`

### Ticket 8: Phase 2 Readiness Hooks

Purpose: prepare UI surfaces for match IDs, notes, tags, and CSV exports without implementing the data model.

Ownership:

- One coordination agent owns the audit and minimal UI placeholders.
- Any app-shell changes happen in a controlled shared-file pass.

Dependencies:

- Tickets 4 through 7.
- Phase 2 data model plan should define expected fields before placeholders become concrete UI.

Acceptance criteria:

- Plan identifies where match notes and tags will render.
- CSV export controls have an agreed placement, but inactive controls are not shipped unless intentionally hidden or disabled.
- No validator, importer, or data file changes are included.
- UI remains correct with the current data shape.

Recommended commit:

- `ui: prepare dashboard surfaces for phase 2`

### Ticket 9: Final Integration And Regression Pass

Purpose: reconcile shared files, remove obsolete style hooks, and verify the modernization as a coherent dashboard.

Ownership:

- One integration agent owns final edits to `index.html`, `scripts.js`, and `styles.css`.
- Section owners review their areas after integration.

Dependencies:

- All preceding implementation tickets.
- Separate navigation, colour, tests, and accessibility plans should have their required checks represented.

Acceptance criteria:

- `npm test` passes.
- `npm run check` passes.
- Dashboard works for Overall, 2025, and 2026 data views.
- Mobile, tablet, and desktop layouts have no obvious overlapping text or broken controls.
- No unrelated Phase 2 data model changes are present.

Recommended commit:

- `ui: integrate modernization pass`

## Ownership Boundaries

- App shell owner: scheduled edits to `index.html`.
- App coordinator owner: scheduled edits to `scripts.js`.
- Global CSS owner: scheduled edits to `styles.css`.
- Feature CSS owners: `styles/decks.css`, `styles/matches.css`, `styles/mobile-polish.css`, and `styles/sessions.css` by ticket.
- Render owners: one owner per file in `scripts/render/`.
- Stats owners: avoid `scripts/stats.js` unless a UI ticket exposes a real calculation bug and the fix is separately tested.
- Data owners: no UI modernization ticket owns `data/*.json`.

When a ticket needs a shared-file change, record the requested hook or class in the ticket notes and leave the edit for the next controlled pass.

## Dependencies And Coordination

- Navigation plan should land before layout skeleton work that changes top-level page structure.
- Colour plan should land before final visual styling decisions.
- Test plan should define required smoke coverage before final integration.
- Accessibility plan should define heading, landmark, focus, and contrast requirements before section patterns are finalized.
- Phase 2 data model work should wait until the modernization integration pass is complete, unless a data change is explicitly required to unblock UI verification.

## Acceptance Criteria For The Modernization Stream

- Current data imports and validation are unaffected.
- Current serious stats remain available and appear before fun stats.
- Existing deep links keep working or have intentional redirects documented.
- Shared files were changed only in controlled passes.
- The app remains a static GitHub Pages site with no build step.
- `npm test` and `npm run check` pass before the stream is considered complete.

## Recommended Commit Boundaries

Use small commits aligned to reviewable UI surfaces:

- One commit for inventory or planning updates.
- One commit for each controlled shared-file pass.
- One commit per major render surface.
- One commit for final cleanup and verification.

Avoid commits that combine UI modernization with Phase 2 schema, importer, validator, or data-file changes.
