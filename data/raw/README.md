# Raw Match Notes

Raw notes are the source you paste from game night before importing into `data/matches-YYYY.json`.

Use one file per session:

```bash
npm run notes:new -- 2026-05-10 magic
```

Paste games in this shape:

```text
10/05 magic

Liam - zombieland
Jo - ragost
Jake - women wielding - win
Mark - quinny

---

Liam - curie
Jo - fishes
Jake - hobbits
Mark - quinny - win
```

Rules:

- Put the date once at the top. `DD/MM` uses the year passed to the importer.
- Separate games with `---`, `—`, or `–`.
- Use `Player - deck` for each player.
- Add `- win` to exactly one player in each game.
- Deck text can be an ID, deck name, commander, or alias from `data/deck-definitions.json`.
- Player typos can be handled in `data/player-aliases.json`.

Preview the latest raw file:

```bash
npm run notes:preview-new -- --year 2026
```

Import the latest raw file:

```bash
npm run notes:import-new -- --year 2026
```

Import a specific file:

```bash
npm run import -- data/raw/2026/2026-05-10-magic.txt --year 2026 --write
```
