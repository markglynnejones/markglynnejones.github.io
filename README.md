# markglynnejones.github.io

## Import match notes

Paste rough match notes into `data/raw/YYYY-MM-DD-description.txt`, then preview:

```bash
node scripts/import-notes.js data/raw/2026-04-06-magic.txt --year 2026
```

If the preview looks right, write the JSON updates:

```bash
node scripts/import-notes.js data/raw/2026-04-06-magic.txt --year 2026 --write
```

The importer understands shorthand deck aliases from `data/deck-definitions.json`, normalises `Olly` to `Ollie`, and writes into `data/matches-YYYY.json`.
