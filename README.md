# markglynnejones.github.io

## Import match notes

Paste rough match notes into `data/raw/YYYY-MM-DD-description.txt`, then preview:

```bash
npm run import -- data/raw/2026-04-06-magic.txt --year 2026
```

If the preview looks right, write the JSON updates:

```bash
npm run import -- data/raw/2026-04-06-magic.txt --year 2026 --write
```

The importer understands shorthand deck aliases from `data/deck-definitions.json`, normalises `Olly` to `Ollie`, and writes into `data/matches-YYYY.json`. If it cannot resolve a deck, it suggests the closest existing decks and prints a new-deck stub you can add to `data/deck-definitions.json`.

## Check data

Run a data sanity check before pushing:

```bash
npm run check
```
