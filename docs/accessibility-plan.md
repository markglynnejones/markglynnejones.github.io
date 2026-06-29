# Accessibility Plan

This audit is based on the current static dashboard structure in `index.html`, `scripts.js`, `scripts/render/*`, and the app CSS. It is a planning document only; no app code changes are included here.

## Goals

- Keep the dashboard usable with keyboard, screen reader, touch, and zoomed/mobile browsing.
- Preserve the static GitHub Pages architecture and plain JavaScript module pattern.
- Prefer small semantic fixes before larger visual redesigns.

## Priority Fixes

### 1. Landmarks and Page Structure

Current state:

- The page has `header`, `nav`, `main`, and `footer`, which is a good baseline.
- The tab navigation is also the main year/view navigation, but it is labeled only as "Year tabs".
- There is no skip link to jump past the header and tabs.

Recommended fixes:

- Add a visible-on-focus skip link before the header that targets `main`.
- Give the main landmark an accessible label such as `aria-label="Commander stats dashboard"` if the page grows more complex.
- Keep `nav` for the year/view controls, but make the label more specific: "Dashboard view" or "Stats year".
- Avoid adding extra landmark roles where native elements already provide them.

### 2. Headings

Current state:

- The static sections use a sensible `h1` then repeated `h2` pattern.
- Generated session details and latest-session content use `h3`, which fits inside their sections.
- Summary cards use styled `div` labels and values, not headings. That is acceptable if they remain short metric cards.

Recommended fixes:

- Add `aria-labelledby` to sections that do not currently have it, using stable `h2` ids.
- Keep generated card labels as text unless a card becomes independently navigable.
- If sections can be hidden for a selected tab, hide the whole section semantically with `hidden` rather than only `style.display` from JavaScript.

### 3. Tab and View Navigation

Current state:

- Year tabs use `role="tablist"`, `role="tab"`, `aria-selected`, roving `tabindex`, and Arrow Left/Right keyboard support.
- All year tabs point at `aria-controls="panel-*"` ids, but the page has one shared panel with `id="tab-panel"`. `panel-2025` and `panel-2026` do not exist.
- Selecting a tab rerenders the whole page, but focus stays on the tab, which is usually acceptable.
- Session tabs also use `role="tablist"` and roving `tabindex`, but they only respond to Arrow Left/Right. Space/Enter activation is not explicitly handled, although native button click behavior usually covers keyboard activation.

Recommended fixes:

- Either use one tabpanel and set every year tab's `aria-controls="tab-panel"`, or create real per-year panels. The current broken `aria-controls` references should be fixed first.
- Consider whether year navigation is really a tab interface. If all content rerenders inside one page, tabs are reasonable; otherwise plain buttons with `aria-pressed` or links may be simpler.
- Add Home/End key support for both year tabs and session tabs.
- For session tabs, verify Enter and Space activate consistently after rerender. Add explicit handlers if needed.
- After changing year tabs, update an offscreen or visible status element with the active view, for example "Showing Overall stats".

### 4. Tables and Sorting

Current state:

- Most table headers have `scope="col"` in the static HTML, but some generated or static tables lack explicit scope on all headers.
- Sortable table headers are implemented as `th role="button" tabindex="0"`.
- `aria-sort` is updated on sortable columns, which is helpful.
- Sort arrows use visible glyphs such as up/down/both arrows. These may be announced as extra characters by assistive tech.

Recommended fixes:

- Ensure every table header has `scope="col"`.
- Prefer real `<button type="button">` elements inside sortable `th` cells instead of making the `th` itself a button. Keep `aria-sort` on the `th`.
- Hide decorative sort glyphs from screen readers with `aria-hidden="true"` and expose the sort state through `aria-sort` plus button labels such as "Sort by wins".
- Add table captions or accessible table names. Captions can be visually hidden if the section heading already provides the visual label.
- For row labels such as player name, deck name, or opponent, consider `scope="row"` on the first cell when rows are generated.
- Avoid `innerHTML` for table cell content where player, deck, or commander names may come from data. This is primarily a security and robustness issue, but malformed markup can also harm accessibility.

### 5. Forms and Controls

Current state:

- Search inputs and player selects have visible labels.
- The inactive-decks toggle uses `aria-pressed`, which is appropriate.
- The "Show more matches" button has `aria-controls="recent-matches-table"`.
- Dynamic notes next to selects are plain text spans and are not programmatically associated with the controls.

Recommended fixes:

- Associate contextual notes with selects using `aria-describedby`, for example `player-deck-select` describing `player-deck-note`.
- Add `autocomplete="off"` where browser search history would be noisy, if desired.
- Make button labels describe current action clearly. The inactive deck button already does this; keep `aria-pressed` synchronized with visible state.
- If search filters rerender tables on each keystroke, add a polite result-count announcement such as "6 players shown".

### 6. Focus and Keyboard Behavior

Current state:

- Focus outlines exist for tabs, sortable headers, buttons, selects, and table search inputs.
- Session links move focus to deck rows after a hash-style jump.
- Target rows receive `tabIndex = -1`, focus, and a visual outline.
- Some focus styling uses a semi-transparent dark outline, which may be weak on darker selected controls.

Recommended fixes:

- Use a high-contrast focus style that works on white, black, selected tabs, and colored highlights. A two-layer outline or solid color token is safer than semi-transparent black alone.
- Add focus styles for all links, including session deck links.
- When content is hidden because a tab changes, make sure focus is not left inside a hidden section.
- Respect `prefers-reduced-motion` for `scrollIntoView({ behavior: "smooth" })`; use instant scrolling for reduced-motion users.
- Keep target-row focus temporary but intentional. Do not add permanent positive `tabindex` values.

### 7. Contrast and Visual States

Current state:

- Black table headers with white text are strong.
- Muted notes use opacity, and several small labels use low-opacity text.
- Session tabs use beige gradients, red inset accents, and selected dark states.
- Links in session cards use green text and underline styling.

Recommended fixes:

- Replace opacity-based muted text with explicit colors that pass WCAG AA contrast on their backgrounds.
- Check small text in `.summary-card-label`, `.summary-card-detail`, `.latest-session-stats span`, `.session-tab small`, and `.session-meta small`.
- Verify selected and unselected tab contrast, including focus outlines.
- Do not rely on color alone for winner states. Existing text labels like "Winner:" help; keep them.
- Ensure mana symbols have useful `alt` text or become decorative depending on whether the adjacent text already conveys color identity.

### 8. Dynamic Content

Current state:

- The latest-session summary uses `aria-live="polite"`.
- Most dynamic notes and tables rerender silently.
- Fatal data-loading errors are prepended visually but are not marked as alerts.
- Commander image and color cells initially show ellipses and then update asynchronously.

Recommended fixes:

- Add `role="alert"` or `aria-live="assertive"` to fatal data-loading errors.
- Add `aria-live="polite"` to section notes that change after filtering, tab changes, or async loading.
- For async commander cells, prefer text like "Loading" over ellipses, and update it to "Unavailable" or the loaded result.
- If image loading produces many asynchronous table changes, avoid excessive announcements from every image cell. Announce only table-level status if needed.
- Ensure generated SVG charts include a text alternative that summarizes the data, not only `role="img"` and a generic label. A hidden summary or adjacent table is best.

### 9. Mobile and Horizontal Tables

Current state:

- On mobile, each `main section` gets `overflow-x: auto`, and tables get `min-width: 620px`.
- This makes wide tables scrollable, but the scroll container is the whole section, not a dedicated table wrapper.
- Users may not know that a table scrolls horizontally.

Recommended fixes:

- Wrap each wide table in a dedicated `.table-scroll` container with `overflow-x: auto`, `tabindex="0"`, and an accessible label such as `aria-label="Decks table, horizontally scrollable"`.
- Keep section content such as headings, notes, and buttons outside the horizontal scroll container.
- Add a small visible hint on narrow screens, for example "Scroll table sideways", and associate it with the scroll region. Hide the hint on wider screens.
- Consider sticky first columns for very wide tables only if implemented without trapping focus or obscuring content.
- Test at 320px, 375px, 768px, and 200% browser zoom.

## Testing Recommendations

- Add Playwright smoke checks for keyboard navigation:
  - Tab reaches skip link, year tabs, search fields, selects, sortable columns or sort buttons, show-more button, and session links in a logical order.
  - Arrow Left/Right and Home/End work for year tabs and session tabs.
  - Enter/Space activate sortable controls and tabs.
  - Focus remains visible on selected tabs, links, and target rows.
- Add automated accessibility checks with `@axe-core/playwright` against:
  - Initial dashboard load.
  - Each year tab.
  - A filtered player table.
  - A filtered deck table with no results.
  - Mobile viewport with horizontal tables.
- Include manual checks:
  - Screen reader pass with VoiceOver on macOS/Safari or Chrome.
  - Keyboard-only pass with no mouse.
  - Browser zoom at 200%.
  - Reduced-motion setting enabled.
  - Color contrast check for muted labels, tabs, selected states, and focus rings.

## Suggested Implementation Order

1. Fix broken tab `aria-controls`, add skip link, and add stable section labels.
2. Replace sortable `th role="button"` patterns with buttons inside headers.
3. Add table captions/names, row header scopes, and mobile table scroll wrappers.
4. Improve focus styles, reduced-motion behavior, and link focus visibility.
5. Add live-region handling for major updates and fatal errors.
6. Add Playwright plus axe coverage for the dashboard views.
