# AI Project Context

This file gives AI coding assistants enough context to continue work on the Commander Wins Tracker without rediscovering the project from scratch.

## Project Summary

Commander Wins Tracker is a static GitHub Pages app for tracking Magic: The Gathering Commander games. The current differentiator is the raw-note import workflow: rough game-night notes are parsed into clean JSON, validated, and rendered as player, deck, session, and match-history stats.

Current product direction:

- Keep the personal/group tracker useful first.
- Build personal-first, with other playgroups in mind.
- Keep serious stats and fun group stats separated in the UI.
- Do not start with accounts, billing, or a backend.
- Treat accounts as a future private-group hosting option, not current scope.
- Keep CLI import as the trusted personal workflow.
- Plan browser import preview later, without removing CLI import.
- Improve the static dashboard, then stabilize the data model, then validate demand with other playgroups.
- See `docs/product-roadmap.md` and `docs/implementation-plan.md` before starting larger product work.

## Repository Shape

- `index.html`: static app shell.
- `scripts.js`: browser app coordinator and shared page state.
- `scripts/stats.js`: core stat calculations, usable in browser and Node tests.
- `scripts/render/`: browser render modules for dashboard sections.
- `scripts/import-notes.js`: CLI parser/importer for raw match notes.
- `scripts/check-data.js`: JSON/data validation.
- `data/*.json`: canonical app data.
- `data/raw/YYYY/*.txt`: source notes copied from game nights.
- `styles.css` and `styles/*.css`: app styling.
- `docs/`: product and implementation planning.

## Development Workflow

Use these commands before finishing meaningful changes:

```bash
npm test
npm run check
```

Common data workflow:

```bash
npm run notes:new -- 2026-06-01 magic
npm run notes:preview-new -- --year 2026
npm run notes:import-new -- --year 2026
npm test
npm run check
```

## Implementation Priorities

Phase 1 from `docs/implementation-plan.md` is implemented on `product-roadmap-and-planning`.

The next implementation phase should focus on Phase 2:

1. Stable match IDs.
2. Optional match notes and tags.
3. CSV exports.
4. Importer and validator updates for any new data shape.

Keep these changes compatible with the current static GitHub Pages deployment.

## Engineering Notes

- Prefer plain JavaScript and the existing module pattern.
- Keep stat logic in `scripts/stats.js` when it needs tests or reuse.
- Keep DOM rendering in `scripts/render/` modules.
- Do not introduce a build step unless there is a strong reason.
- Do not restructure data files casually; changes to data shape need importer, validator, render, and test updates.
- Preserve raw notes as the source-of-truth audit trail for imported sessions.
- Use stable, testable helper functions for new stats.

## Product Guardrails

- The useful wedge is "paste rough Commander night notes, get clean private group stats."
- Avoid drifting into deckbuilding, card prices, public social features, or tournament management before the group tracker is clearly strong.
- If commercialization work begins, privacy, exports, editing, backups, Scryfall attribution, and unofficial MTG disclaimers become required.
