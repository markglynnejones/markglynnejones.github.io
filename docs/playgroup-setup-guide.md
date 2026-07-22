# Playgroup Setup Guide

This project is still personal-first, but another playgroup can trial the tracker by replacing the JSON data and keeping the same static app.

## 1. Start With Players

Edit `data/player-definitions.json`.

Each player needs:

- `id`: stable lowercase slug.
- `name`: display name.
- `active`: whether they currently appear in filters and setup flows.

Use `data/player-aliases.json` for common note typos or nicknames. The left side is the rough-note spelling; the right side is the canonical player name.

## 2. Add Decks And Aliases

Edit `data/deck-definitions.json`.

Each deck needs:

- `id`: stable lowercase slug.
- `name`: display name.
- `commander`: string or array of partner/background commanders.
- `active`: whether it is still in use.
- `owner`: optional but useful for future review.
- `aliases`: optional rough-note names for the importer.

Keep one-off event decks out of this file unless they should affect normal deck stats.

## 3. Import Game Nights

Put raw notes in `data/raw/YYYY/YYYY-MM-DD-description.txt`.

Preview first:

```bash
npm run import -- data/raw/2026/2026-04-06-magic.txt --year 2026
```

Write once the preview looks right:

```bash
npm run import -- data/raw/2026/2026-04-06-magic.txt --year 2026 --write
```

Then run:

```bash
npm test
npm run check
```

## 4. Record Special Games Separately

Use `data/special-matches-YYYY.json` for one-off formats that should not change normal Commander standings, such as chaos drafts, box-opening deck nights, or temporary event decks.

These games render in the Special view at `#/special`.

## 5. Export And Back Up

CSV exports are available with:

```bash
npm run export -- --format csv --year 2026
```

JSON backups are available with:

```bash
npm run export -- --format json --year 2026
npm run export -- --format json --year 2026 --target backup --out data/exports/2026-backup.json
```

Keep the repo history and raw notes as the audit trail. Before any hosted or commercial version, add a restore workflow to pair with these backups.

## 6. Try The Public Demo

Open:

```text
?sample=1#/overview
```

The demo uses fictional data from `data/sample/` and is safe to show without exposing the private playgroup log.
