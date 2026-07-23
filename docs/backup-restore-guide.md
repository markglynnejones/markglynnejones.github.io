# Backup And Restore Guide

This project keeps the repo history and raw notes as the primary audit trail. JSON backups are a second safety net for copying canonical data files out of the repo or recovering one damaged file.

## Create A Backup

Write all JSON exports under `data/exports/`:

```bash
npm run export -- --format json --year 2026
```

Write one combined backup bundle:

```bash
npm run export -- --format json --year 2026 --target backup --out data/exports/2026-backup.json
```

The combined backup contains:

- `matches-YYYY.json`
- `special-matches-YYYY.json`
- `deck-definitions.json`
- `player-definitions.json`
- `player-aliases.json`
- `players-2025.json`
- `decks-2025.json`
- `combinations.json`
- `doubles.json`

## Inspect A Backup

Before restoring anything, inspect the backup and the current file:

```bash
node -e "const b=require('./data/exports/2026-backup.json'); console.log(Object.keys(b.files));"
node -e "const b=require('./data/exports/2026-backup.json'); console.log(b.files['matches-2026.json'].matches.length);"
node -e "const d=require('./data/matches-2026.json'); console.log(d.matches.length);"
```

If the counts or file list look wrong, stop and find the right backup before changing repo files.

## Restore One File

Restore one file from the combined backup:

```bash
node -e "const fs=require('fs'); const b=require('./data/exports/2026-backup.json'); fs.writeFileSync('data/matches-2026.json', JSON.stringify(b.files['matches-2026.json'], null, 2) + '\n');"
```

Then run validation:

```bash
npm run check
npm test
```

Review the diff before committing:

```bash
git diff -- data/matches-2026.json
```

Only commit the restore if the diff matches the intended recovery.

## Restore From Individual JSON Exports

If you exported individual JSON files with `--target all`, restore the needed file directly:

```bash
cp data/exports/2026-matches.json data/matches-2026.json
npm run check
npm test
```

Use this only when the exported target is the canonical file shape. CSV exports are for analysis and migration checks, not restore.

## Recovery Rules

- Restore the smallest file needed.
- Never restore over raw notes in `data/raw/`; they are the audit trail.
- Always run `npm run check` after a restore.
- Run `npm test` before pushing.
- Keep the restore in its own commit with a clear message.
