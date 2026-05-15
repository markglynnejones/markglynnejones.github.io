# markglynnejones.github.io

## Import match notes

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

The importer understands shorthand deck aliases from `data/deck-definitions.json`, player aliases from `data/player-aliases.json`, and writes into `data/matches-YYYY.json`. If it cannot resolve a deck, it suggests the closest existing decks and prints a new-deck stub you can add to `data/deck-definitions.json`.

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

## Live site

GitHub Pages publishes this repository at:

```text
https://markglynnejones.github.io/
```

## Check and test

Run a data sanity check before pushing:

```bash
npm run check
```

Run the test suite:

```bash
npm test
```
