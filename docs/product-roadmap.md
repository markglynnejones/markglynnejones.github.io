# Commander Tracker Product Roadmap

This project is currently a strong personal tracker: match notes are easy to paste, imports are validated, and the static dashboard gives useful player, deck, session, and recent-match views. The next stage is deciding whether it remains a polished personal/group tool or becomes a product other playgroups can use.

Current baseline:

- 53 logged 2026 matches.
- 15 2026 sessions, from 2026-01-04 to 2026-05-29.
- 6 players.
- 50 decks played in 2026.
- 67 deck definitions, with 57 active decks.
- 3 deck definitions marked for review.

## Product Direction

The strongest product wedge is not "generic MTG stats". The useful thing here is turning messy Commander night notes into reliable, searchable group history with minimal admin effort.

Good positioning:

- "A private Commander league tracker for real playgroups."
- "Paste rough game-night notes, get clean stats."
- "Track decks, sessions, wins, rivalries, and long-term group history."

Current product stance:

- Build personal-first, but keep other playgroups in mind.
- Keep serious stats and fun group stats separated in the UI.
- Keep the CLI import workflow for personal use.
- Plan a browser-based import preview for accessibility, without removing the CLI path.
- Treat accounts as a future hosting option, not a near-term requirement.

Avoid starting with:

- A public deck database.
- A full tournament platform.
- A deckbuilding or card-price product.
- A social network.

Those are much larger markets with heavier competition and weaker connection to the working core of this project.

## Near-Term Product Features

These features improve the current personal tool and are useful even if it never becomes commercial.

1. Dashboard polish

- Add summary cards for total matches, sessions, unique players, unique decks, latest winner, and most-played deck.
- Add player profile sections with favorite decks, best deck, recent form, and head-to-head notes.
- Add deck profile sections with pilots, win rate, last played date, and recent results.
- Improve mobile table behavior with tighter responsive layouts.
- Add clearer empty and loading states.

2. Better insights

- Head-to-head player records.
- Deck versus deck history.
- Player versus deck history.
- Recent form, such as last 5 or last 10 matches.
- Session MVP and session spread.
- Streaks: win streaks, losing streaks, deck streaks, attendance streaks.
- Pod-size adjusted expectations, because 3-player, 4-player, and 5-player Commander games have different baseline win rates.

3. Data quality and import workflow

- Add `schemaVersion` to JSON files.
- Add match IDs so future edits do not rely on array position.
- Add optional per-match notes.
- Add optional tags such as `planechase`, `precon`, `league`, `proxy`, `archenemy`, or `two-headed`.
- Add command support to list unresolved decks before import.
- Add a guided "new deck" command that asks for name, commander, owner, aliases, and active status.
- Add export commands for CSV and JSON backups.

4. User experience for the current group

- Add a "this session" recap view.
- Add shareable anchor links for players, decks, and sessions.
- Add filters for player, deck, date range, pod size, and active decks.
- Add compact printable/shareable session summaries.
- Add an achievements/fun stats section, kept clearly separate from serious stats.

5. Fun stats

Fun stats should be opt-in or visually separated from the main dashboard. They are useful for group personality, but should not get in the way of standings and performance views.

Possible fun stats:

- Most targeted player, if targeting is ever tracked.
- Most chaotic deck, based on tags or manual notes.
- Most loyal pilot, for the player who repeats the same deck most often.
- Deck retirement notes.
- Biggest comeback session.
- "Nemesis" pairings from head-to-head history.

## Technical Foundations

These are the changes needed before the app can comfortably grow beyond one local repo.

1. Data model

Move from year-specific hand-edited files toward a stable model:

- `players`
- `decks`
- `matches`
- `sessions`
- `groups`
- `memberships`

For static hosting, this can still be JSON. For commercial use, it should become a database-backed model.

2. Stable IDs

Add stable IDs for:

- Players.
- Decks.
- Matches.
- Sessions.
- Groups.

Names can then change without breaking history.

3. Import pipeline

Keep the current text importer as a differentiator, but separate it into clearer stages:

- Parse raw notes.
- Resolve players and decks.
- Validate match shape.
- Preview proposed changes.
- Commit accepted changes.

That structure later maps cleanly to a web UI.

4. Test coverage

Broaden tests around:

- Duplicate detection.
- Ambiguous deck aliases.
- Player aliases.
- Invalid dates.
- Pod-size stats.
- Match editing.
- Export formats.

5. Hosting options

Good staged path:

- Phase 1: static GitHub Pages, current repo.
- Phase 2: static app with local browser storage for private trials.
- Phase 3: hosted app with authentication and database.
- Phase 4: paid groups, backups, imports, and integrations.

Accounts should stay out of the current implementation. If the project later becomes hosted, design accounts around private groups rather than individual public profiles.

Possible future account model:

- A user can belong to one or more groups.
- A group owns matches, sessions, decks, and player records.
- A group has admins who can import, edit, export, and invite.
- Players can exist without login accounts, so casual group members do not need to sign up.
- Public sharing is disabled by default and enabled only by group admins.

## Commercialization Options

### Option A: Free Static Template

Offer this as an open-source template other groups can fork.

Pros:

- Lowest operational cost.
- Easiest to ship.
- Builds credibility.
- Good feedback loop.

Cons:

- Not meaningfully monetized.
- Requires users to be comfortable with GitHub or local files.

Best use:

- Validate whether other groups care.
- Build a small audience.

### Option B: Paid Setup Service

Offer "I will set up your Commander league tracker" as a service.

Pros:

- Fastest path to revenue.
- No complex SaaS needed.
- Good way to learn what groups actually need.

Cons:

- Manual work does not scale well.
- Support expectations can grow quickly.

Possible pricing:

- One-off setup: GBP 25-75 per group.
- Data cleanup/import: GBP 10-30 depending on volume.
- Custom dashboard tweaks: hourly or fixed-price.

### Option C: Hosted Group SaaS

A web app where each playgroup has an account, private group, decks, players, imports, and dashboards.

Pros:

- Most scalable.
- Strongest long-term commercial shape.
- Easier for non-technical users.

Cons:

- Requires auth, billing, database, backups, privacy controls, support, and uptime.
- Harder to justify until demand is proven.

Possible pricing:

- Free: one group, limited history or limited players.
- GBP 3-5/month per group for core tracking.
- GBP 8-12/month per group for advanced analytics, exports, and multiple leagues.

### Option D: League/Event Tooling

Expand into league seasons, points, prizes, standings, and event nights.

Pros:

- More obvious willingness to pay.
- Useful for local game stores and organized groups.

Cons:

- More rules complexity.
- Less aligned with the current casual note-import flow.

This should come after the group tracker is strong.

## Commercial Readiness Gaps

Before charging strangers, the project needs:

- Privacy model: groups should be private by default.
- Data ownership: export and delete data.
- Backups and recovery.
- Editing tools for mistakes after import.
- Clear onboarding for non-technical users.
- Card data attribution and compliance for Scryfall usage.
- Disclaimers that it is unofficial and not affiliated with Wizards of the Coast.
- Authentication and authorization if hosted.
- Basic analytics on usage and import failure points.

## Recommended Roadmap

### Milestone 1: Make The Current Dashboard Feel Finished

Goal: best possible personal/group static tracker.

- Add dashboard summary cards.
- Add player profile details.
- Add deck profile details.
- Add head-to-head stats.
- Add recent form and streaks.
- Improve mobile layout.
- Add shareable anchors.

Success criteria:

- The dashboard answers "who is doing well?", "which decks are scary?", and "what happened recently?" without manual interpretation.

### Milestone 2: Make Data Safer To Grow

Goal: reduce future migration pain.

- Add stable match IDs.
- Add stable player IDs.
- Add stable session IDs.
- Add optional notes and tags.
- Add schema versioning.
- Add export command.

Success criteria:

- Existing history can be edited, exported, and migrated without relying on display names or array order.

### Milestone 3: Build The Import UX

Goal: preserve the strongest differentiator while making it usable by someone else.

- Add a browser-based raw-note paste screen.
- Show parsed matches before saving.
- Highlight unresolved players/decks.
- Let users add aliases during import.
- Keep the CLI importer as the reliable backend/reference implementation.
- Keep browser import preview-only or local-storage-only until a backend exists.

Success criteria:

- A non-technical playgroup admin can paste notes and update stats without editing JSON.

### Milestone 4: Validate Demand

Goal: prove whether commercialization is worth the overhead.

- Package the app as a public demo with sample data.
- Create a short setup guide.
- Offer setup to 3-5 other playgroups.
- Track what they ask for, where imports fail, and whether they would pay.

Success criteria:

- At least 3 outside groups use it for multiple sessions.
- At least 1 group is willing to pay for setup or hosting.

### Milestone 5: Decide SaaS Or Service

Goal: choose based on evidence.

Choose setup-service path if:

- Users want custom dashboards.
- Groups are okay with occasional manual help.
- Demand is low but willingness to pay is real.

Choose SaaS path if:

- Multiple groups want the same workflow.
- Import friction is repeatable and solvable.
- Users need self-serve access.
- Users want private hosted history.

## Suggested Next Build Tickets

Completed foundation:

1. Dashboard summary cards.
2. Head-to-head player stats.
3. Recent form and streak calculations.
4. Stable match, player, and session IDs.
5. Optional match tags and notes.
6. CSV export.
7. Player, deck, and session deep links.
8. Public sample-data mode.
9. Browser raw-note import preview.
10. Setup guide for other playgroups.
11. Browser import review pack with duplicate and special-game guidance.
12. JSON backup/export alongside CSV exports.

Suggested next build tickets:

1. Add a corrections workflow for editing old matches safely.
2. Trial the setup guide with one outside playgroup.
3. Add restore guidance for JSON backups.
4. Explore browser-only local edits if the repo-local correction workflow is too technical.

## Recommended First Move

Do not start with billing, accounts, or a backend.

The best next move is to make importing and correcting data easier without weakening the static, private-first model. That gives useful personal value immediately and creates evidence for whether a paid product is worth building.

For the practical build breakdown, see `docs/implementation-plan.md`.
