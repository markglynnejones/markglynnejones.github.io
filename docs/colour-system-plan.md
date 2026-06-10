# Colour System Plan

This audit covers the current static dashboard styling in `styles.css` and `styles/*.css`. It proposes a restrained dashboard colour system for future implementation without changing app code in this planning pass.

## Current Visual Direction

The app currently reads as a practical grey dashboard with scattered accent colour:

- Base surfaces use light greys and white: `#f4f4f4`, `#ffffff`, `#f9f9f9`, and translucent white panels.
- Primary chrome uses near-black charcoal: `#2a2a2e`, `#262626`, `#1f1f22`, and pure black table headers.
- Session UI adds a warmer personality through cream gradients, red tab accents, gold winner badges, and green match/player links.
- The wins-over-time chart uses a broad categorical palette that is independent from the rest of the UI.
- Error handling currently uses inline `#b00020` in JavaScript, outside the CSS system.

The direction is usable and mostly restrained, but the palette is not yet systematic. The main risks are black-heavy table headers, inconsistent neutrals, Magic-adjacent red/gold/green accents that can drift into fantasy styling, and one-off chart colours that do not connect to semantic UI states.

## Recommended Direction

Use a quiet operational dashboard palette: warm neutral surfaces, charcoal text, slate navigation, muted teal for primary actions and links, amber for highlights, red only for destructive or error states, and a small categorical chart set. This keeps the app personal and MTG-aware without using parchment, mana-colour theming, dramatic gradients, or decorative fantasy cues.

The palette should avoid being one-note by separating these jobs:

- Neutrals for most structure and readable data.
- Teal for selected/interactive primary emphasis.
- Amber for winner/highlight state.
- Muted red for errors and rare warnings.
- Blue, violet, olive, rust, and gold as chart/category accents only.

## Recommended CSS Custom Properties

Add these tokens in `:root` when implementation begins:

```css
:root {
  --color-bg: #f5f4f1;
  --color-surface: #ffffff;
  --color-surface-subtle: #faf9f6;
  --color-surface-raised: #fffefd;

  --color-text: #202124;
  --color-text-muted: #5f6368;
  --color-text-inverse: #ffffff;

  --color-border: #d8d4cc;
  --color-border-subtle: #e7e3db;
  --color-shadow: rgba(32, 33, 36, 0.08);

  --color-nav: #263238;
  --color-nav-hover: #34464c;

  --color-primary: #1f6b5b;
  --color-primary-hover: #175244;
  --color-primary-subtle: #e7f1ee;

  --color-highlight: #c79a2f;
  --color-highlight-subtle: #fff3cf;

  --color-danger: #9f2f32;
  --color-danger-subtle: #fde7e8;

  --color-focus: #2f6fed;

  --chart-blue: #3f6f9f;
  --chart-teal: #2f7d70;
  --chart-olive: #6f7f3f;
  --chart-gold: #b98925;
  --chart-rust: #b65c38;
  --chart-violet: #725c9f;
  --chart-slate: #60717a;
  --chart-rose: #b85d72;
}
```

These names are intentionally semantic for UI tokens and categorical for chart tokens. Avoid naming interface tokens after Magic colours or deck colour identities; the dashboard should describe product function, not game flavour.

## Usage Rules

- Page background: use `--color-bg`.
- Header, footer, selected year tabs, and table headers: use `--color-nav`; use `--color-nav-hover` for hover states.
- Main sections and cards: use `--color-surface` or `--color-surface-raised`; use `--color-border-subtle` for normal borders and `--color-shadow` for soft elevation.
- Summary card labels and helper notes: use `--color-text-muted`; primary values use `--color-text`.
- Links and primary interactive emphasis: use `--color-primary`; hover to `--color-primary-hover`.
- Selected or active tab accents: use `--color-primary`, not red.
- Winner badges, target-row highlights, and latest-session emphasis: use `--color-highlight` on light backgrounds or `--color-highlight-subtle` as a fill.
- Errors and fatal banners: use `--color-danger`; reserve it for real errors, not decorative accents.
- Focus outlines: use `--color-focus` with at least a 3px outline and 2px offset.
- Charts: use only `--chart-*` tokens. Keep chart text and axes on `--color-text-muted` or `--color-text`, not hard-coded `#333`.
- Gradients: remove most gradients. If kept, limit them to subtle surface depth such as `--color-surface-raised` to `--color-surface`, not themed colour gradients.

## Contrast Considerations

Target WCAG AA contrast:

- Body text should maintain at least 4.5:1 contrast against its background.
- Large numeric card values should maintain at least 3:1, but should still prefer the stronger `--color-text`.
- `--color-nav` with `--color-text-inverse` has strong contrast and can replace current pure-black headers.
- `--color-primary` should be used for links on light surfaces; avoid using `--color-primary-subtle` as text.
- `--color-highlight` should not carry small white text. Use dark text on `--color-highlight-subtle`, or dark text on amber badges.
- Focus colour should remain visually distinct from selected states, so keyboard users can tell focus from active selection.
- Do not rely on colour alone for wins, winners, active states, or chart legends. Existing text labels should remain the primary source of meaning.

## Rollout Steps

1. Add the `:root` tokens to `styles.css`.
2. Replace repeated neutral literals in `styles.css` first: page background, text, borders, cards, tabs, table headers, and focus outlines.
3. Replace session-specific colours in `styles/sessions.css`: remove red tab accent, keep winner emphasis amber, and move links/game borders to primary teal.
4. Replace deck controls and target highlights in `styles/decks.css`.
5. Replace match summary surfaces in `styles/matches.css`.
6. Move inline fatal-error colours in `scripts.js` to CSS classes in a later app-code pass.
7. Update chart rendering to read from CSS variables or share a central chart palette instead of hard-coded SVG fills.
8. Run `npm test` and `npm run check`, then inspect the dashboard at desktop and mobile widths for contrast, selected tabs, table scanning, chart distinguishability, and winner badges.

Keep the rollout mechanical and incremental. The goal is a more coherent dashboard, not a redesign.
