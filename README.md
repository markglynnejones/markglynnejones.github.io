# Commander Wins Tracker

A static GitHub Pages dashboard for tracking Magic: The Gathering Commander games. It turns rough game-night notes into validated JSON and renders player, deck, session, and recent-match stats.

Live site:

```text
https://markglynnejones.github.io/
```

## Repository structure

- `index.html` - static app shell.
- `scripts.js` - browser app coordinator and tab/render state.
- `scripts/stats.js` - shared stat calculations used by the browser and tests.
- `scripts/render/` - browser render modules for specific dashboard sections.
- `scripts/import-parser.js` - reusable raw-note parser used by the CLI importer and browser preview.
- `scripts/import-notes.js` - raw note parser and importer.
- `scripts/check-data.js` - data validation.
- `data/*.json` - canonical app data.
- `data/raw/YYYY/*.txt` - raw game-night notes.
- `styles.css` and `styles/*.css` - app styling.
- `docs/product-roadmap.md` - product and commercialization direction.
- `docs/implementation-plan.md` - practical next build plan.
- `AGENTS.md` - AI-facing project context for future coding sessions.

The structure is intentionally simple: no build step, no backend, and no framework dependency. Keep browser rendering separate from reusable stat logic so new analytics can be tested in Node.

## Product planning

The current direction is to make the static group tracker excellent before adding accounts, billing, or a backend.

Read these before larger feature work:

- `docs/product-roadmap.md`
- `docs/implementation-plan.md`
- `AGENTS.md`

## Import match notes

The browser app has an Import view at `#/import`. It lets you paste raw notes, preview parsed matches or parser errors, flag already-logged matches, copy parsed JSON, and copy suggested deck stubs using the current deck, player, and alias data.

This browser flow is preview-only. It does not write to `data/matches-YYYY.json`; use the CLI importer when you want to commit new matches.

Typical flow:

```bash
npm run notes:new -- 2026-04-13 magic
npm run notes:preview-new -- --year 2026
npm run notes:import-new -- --year 2026
npm test
npm run check
```

Paste rough match notes into `data/raw/YYYY/YYYY-MM-DD-description.txt`, then preview:

```bash
npm run import -- data/raw/2026/2026-04-06-magic.txt --year 2026
```

Example note format:

```text
06/04 magic

Jake - ring sting
Jo - bad misc - win
Liam - big sues
Ollie - toms zoo
Mark - tricky terrain

---

Jake - ketramose - win
Jo - bad misc
Liam - big sues
Ollie - ha ha sephiroth
Mark - ghalta
```

That becomes dated matches in `data/matches-2026.json`, with `win` marking the winner and deck names resolved through the aliases.

If the preview looks right, write the JSON updates:

```bash
npm run import -- data/raw/2026/2026-04-06-magic.txt --year 2026 --write
```

The importer understands shorthand deck aliases from `data/deck-definitions.json`, stable player IDs from `data/player-definitions.json`, player typo aliases from `data/player-aliases.json`, and writes into `data/matches-YYYY.json`. If it cannot resolve a deck, it suggests the closest existing decks and prints a new-deck stub you can add to `data/deck-definitions.json`.

Match files use stable `id`, `sessionId`, `playerId`, and `winnerId` fields alongside display names. If old match data needs backfilling, use:

```bash
npm run matches:migrate-ids -- --year 2026 --write
npm run players:migrate-ids -- --year 2026 --write
npm run sessions:migrate-ids -- --year 2026 --write
```

Check a deck alias before importing:

```bash
npm run decks:find -- terra
```

Create a new raw note file:

```bash
npm run notes:new -- 2026-04-13 magic
```

Run the usual pre-commit workflow for the latest raw note:

```bash
npm run notes:commit -- --year 2026
```

Review decks that have been marked for follow-up:

```bash
npm run decks:review
```

Deck definitions can include optional `owner`, `needsReview`, and `reviewNote` fields. `needsReview: true` is reported by `npm run decks:review` and as a warning in `npm run check`.

## Check and test

Run a data sanity check before pushing:

```bash
npm run check
```

Run the test suite:

```bash
npm test
```

Run the browser interaction tests:

```bash
npm run test:browser
```
