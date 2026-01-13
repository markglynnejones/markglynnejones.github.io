// ----------------------------
// Soft password gate (NOT secure)
// ----------------------------
const ADMIN_PASSWORD = "markTest"; // as requested
const AUTH_KEY = "admin_authed_v1";

function requirePassword() {
  const authed = sessionStorage.getItem(AUTH_KEY) === "true";
  if (authed) return true;

  const input = prompt("Admin password:");
  if (input === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

// ----------------------------
// Helpers
// ----------------------------
const $ = (id) => document.getElementById(id);

function showError(msg) {
  const el = $("error");
  el.style.display = "";
  el.textContent = msg;
}

async function fetchJSON(path) {
  const resolved = new URL(path, window.location.href).toString();
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status}). URL: ${resolved}`);
  return res.json();
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseCommanders(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];
  return raw.split("|").map((s) => s.trim()).filter(Boolean);
}

function normalise(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------
// Data
// ----------------------------
let players2025 = null;
let deckDefinitions = null;

let selectedYear = String(new Date().getFullYear());
let matchesByYear = new Map(); // year -> {matches: [...]}

const deckById = new Map();

function rebuildDeckMaps() {
  deckById.clear();
  for (const d of deckDefinitions?.decks || []) {
    deckById.set(d.id, d);
  }
}

function getActiveDecks() {
  return (deckDefinitions?.decks || []).filter((d) => d.active);
}

function getAllKnownPlayers(currentMatches) {
  const set = new Set();
  for (const p of players2025?.players || []) set.add(p.name);
  for (const m of currentMatches?.matches || []) {
    for (const pl of m.players || []) set.add(pl.name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ----------------------------
// Year handling
// ----------------------------
async function loadMatchesForYear(year) {
  if (matchesByYear.has(year)) return matchesByYear.get(year);

  const path = `data/matches-${year}.json`;
  try {
    const data = await fetchJSON(path);
    if (!data || typeof data !== "object") throw new Error("Invalid JSON structure.");
    if (!Array.isArray(data.matches)) data.matches = [];
    matchesByYear.set(year, data);
    return data;
  } catch {
    const fresh = { matches: [] };
    matchesByYear.set(year, fresh);
    return fresh;
  }
}

function setYearSelectOptions(years) {
  const sel = $("match-year");
  sel.innerHTML = "";
  years.slice().sort((a, b) => Number(a) - Number(b)).forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  });
}

function getYearsList() {
  const current = new Date().getFullYear();
  const base = new Set([String(current - 1), String(current), String(current + 1)]);
  for (const y of matchesByYear.keys()) base.add(String(y));
  return Array.from(base);
}

function updateDownloadMatchesButtonLabel() {
  $("download-matches").textContent = `Download matches-${selectedYear}.json`;
}

// ----------------------------
// Match form + rendering
// ----------------------------
let editingMatchIndex = null;

function refreshWinnerOptions(podSize) {
  const winnerSelect = $("winner");
  const mvpSelect = $("mvp");

  const names = [];
  for (let i = 0; i < podSize; i++) {
    const v = $(`player-${i}`)?.value;
    if (v && v !== "__NEW__") names.push(v);
  }
  const uniq = Array.from(new Set(names));

  const currentWinner = winnerSelect.value;
  const currentMvp = mvpSelect.value;

  winnerSelect.innerHTML =
    `<option value="">Select winner…</option>` +
    uniq.map((n) => `<option value="${n}">${n}</option>`).join("");

  mvpSelect.innerHTML =
    `<option value="">None</option>` +
    uniq.map((n) => `<option value="${n}">${n}</option>`).join("");

  if (uniq.includes(currentWinner)) winnerSelect.value = currentWinner;
  if (uniq.includes(currentMvp)) mvpSelect.value = currentMvp;
}

function renderPlayerRows(podSize, currentMatches) {
  const area = $("players-area");
  area.innerHTML = "";

  const players = getAllKnownPlayers(currentMatches);
  const decks = getActiveDecks();

  const row = document.createElement("div");
  row.className = "row";

  for (let i = 0; i < podSize; i++) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const playerId = `player-${i}`;
    const deckId = `deck-${i}`;

    wrap.innerHTML = `
      <label>Player ${i + 1}</label>
      <select id="${playerId}">
        <option value="">Select player…</option>
        <option value="__NEW__">+ Add new player…</option>
        ${players.map((p) => `<option value="${p}">${p}</option>`).join("")}
      </select>

      <label style="margin-top: 6px;">Deck</label>
      <select id="${deckId}">
        <option value="">Select deck…</option>
        ${decks.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}
      </select>
    `;
    row.appendChild(wrap);

    setTimeout(() => {
      const ps = $(playerId);
      ps.addEventListener("change", () => {
        if (ps.value === "__NEW__") {
          const name = prompt("New player name:");
          if (name && name.trim()) {
            const clean = name.trim();
            const opt = document.createElement("option");
            opt.value = clean;
            opt.textContent = clean;
            ps.insertBefore(opt, ps.options[2]);
            ps.value = clean;
          } else {
            ps.value = "";
          }
        }
        refreshWinnerOptions(podSize);
      });
    }, 0);
  }

  area.appendChild(row);
  refreshWinnerOptions(podSize);
}

function clearMatchForm(currentMatches) {
  $("form-note").textContent = "";
  $("form-note").style.color = "inherit";

  $("match-date").value = todayISO();
  $("pod-size").value = "4";
  $("winner").value = "";
  $("mvp").value = "";

  $("highlight").value = "";
  $("rulings").value = "";
  $("notes").value = "";

  editingMatchIndex = null;
  $("save-match").textContent = "Add Match";
  renderPlayerRows(4, currentMatches);
}

function buildNotesObject(podSize) {
  const mvp = $("mvp").value;
  const highlight = $("highlight").value.trim();
  const rulings = $("rulings").value.trim();
  const notes = $("notes").value.trim();

  const hasAny = !!(mvp || highlight || rulings || notes);
  if (!hasAny) return null;

  // Validate MVP is one of players (if set)
  if (mvp) {
    const playerNames = [];
    for (let i = 0; i < podSize; i++) {
      playerNames.push($(`player-${i}`)?.value);
    }
    if (!playerNames.includes(mvp)) return { __error: "MVP must be one of the players in the match." };
  }

  const obj = {};
  if (mvp) obj.mvp = mvp;
  if (highlight) obj.highlight = highlight;
  if (rulings) obj.rulings = rulings;
  if (notes) obj.notes = notes;
  return obj;
}

function validateAndBuildMatch() {
  const date = $("match-date").value;
  const podSize = Number($("pod-size").value);
  const winner = $("winner").value;

  if (!date) return { error: "Please choose a date." };

  const players = [];
  for (let i = 0; i < podSize; i++) {
    const name = $(`player-${i}`)?.value;
    const deckId = $(`deck-${i}`)?.value;

    if (!name || name === "__NEW__") return { error: `Player ${i + 1} is missing.` };
    if (!deckId) return { error: `Deck for Player ${i + 1} is missing.` };

    players.push({ name, deckId });
  }

  const names = players.map((p) => p.name);
  const uniq = new Set(names);
  if (uniq.size !== names.length) return { error: "Same player selected more than once." };

  if (!winner) return { error: "Please select a winner." };
  if (!uniq.has(winner)) return { error: "Winner must be one of the players in the match." };

  const notes = buildNotesObject(podSize);
  if (notes && notes.__error) return { error: notes.__error };

  const match = { date, players, winner };
  if (notes) match.notes = notes;

  return { match };
}

function sortMatchesByDate(matchesObj) {
  matchesObj.matches.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function renderMatchesTable(currentMatches) {
  const body = $("matches-body");
  body.innerHTML = "";

  const matches = currentMatches?.matches || [];
  $("matches-count").textContent = `${matches.length} match(es) in matches-${selectedYear}.json`;

  matches.forEach((m, idx) => {
    const tr = document.createElement("tr");

    const playersHtml = (m.players || [])
      .map((p) => {
        const deckName = deckById.get(p.deckId)?.name || p.deckId;
        return `<span class="pill">${p.name}</span><span class="small">(${deckName})</span>`;
      })
      .join("<br>");

    const hasNotes = !!m.notes;
    const notesLine = hasNotes
      ? `<div class="small" style="margin-top:6px;">📝 Notes: ${
          [m.notes?.mvp ? `MVP: ${m.notes.mvp}` : null, m.notes?.highlight ? `Highlight` : null, m.notes?.rulings ? `Rulings` : null, m.notes?.notes ? `Extra` : null]
            .filter(Boolean)
            .join(", ")
        }</div>`
      : "";

    tr.innerHTML = `
      <td>${m.date || ""}</td>
      <td>${playersHtml}${notesLine}</td>
      <td><strong>${m.winner || ""}</strong></td>
      <td>
        <button type="button" data-idx="${idx}" class="edit-match-btn">Edit</button>
        <button type="button" data-idx="${idx}" class="remove-match-btn danger">Remove</button>
      </td>
    `;
    body.appendChild(tr);
  });

  document.querySelectorAll(".remove-match-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(i)) return;
      if (!confirm("Remove this match?")) return;
      currentMatches.matches.splice(i, 1);
      renderMatchesTable(currentMatches);
      if (editingMatchIndex === i) clearMatchForm(currentMatches);
    });
  });

  document.querySelectorAll(".edit-match-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(i)) return;
      startEditMatch(i, currentMatches);
    });
  });
}

function startEditMatch(index, currentMatches) {
  const m = currentMatches.matches[index];
  if (!m) return;

  editingMatchIndex = index;
  $("save-match").textContent = "Save Changes";

  const podSize = (m.players || []).length || 4;

  $("match-date").value = m.date || todayISO();
  $("pod-size").value = String(podSize);

  renderPlayerRows(podSize, currentMatches);

  (m.players || []).forEach((p, i) => {
    const ps = $(`player-${i}`);
    const ds = $(`deck-${i}`);
    if (ps) ps.value = p.name;
    if (ds) ds.value = p.deckId;
  });

  refreshWinnerOptions(podSize);
  $("winner").value = m.winner || "";

  // Notes
  $("mvp").value = m.notes?.mvp || "";
  $("highlight").value = m.notes?.highlight || "";
  $("rulings").value = m.notes?.rulings || "";
  $("notes").value = m.notes?.notes || "";

  $("form-note").textContent = `Editing match #${index + 1}`;
}

function upsertMatch(currentMatches, match) {
  if (!Array.isArray(currentMatches.matches)) currentMatches.matches = [];

  if (editingMatchIndex === null) {
    currentMatches.matches.push(match);
  } else {
    currentMatches.matches[editingMatchIndex] = match;
  }

  sortMatchesByDate(currentMatches);
  editingMatchIndex = null;
  $("save-match").textContent = "Add Match";
}

// ----------------------------
// Deck management (edit + add + delete-guard)
// ----------------------------
let editingDeckId = null;

function renderDecksTable() {
  const body = $("decks-body");
  body.innerHTML = "";

  const decks = deckDefinitions?.decks || [];
  const sorted = decks.slice().sort((a, b) => a.name.localeCompare(b.name));

  for (const d of sorted) {
    const commanders = Array.isArray(d.commander) ? d.commander : [d.commander].filter(Boolean);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${d.name}</strong>
        <div class="small">id: <code>${d.id}</code></div>
      </td>
      <td>${commanders.map((c) => `<div>${c}</div>`).join("")}</td>
      <td>${d.active ? "Yes" : "No"}</td>
      <td>
        <button type="button" data-id="${d.id}" class="deck-edit-btn">Edit</button>
        <button type="button" data-id="${d.id}" class="deck-toggle-btn">${d.active ? "Deactivate" : "Activate"}</button>
        <button type="button" data-id="${d.id}" class="deck-delete-btn danger">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  }

  document.querySelectorAll(".deck-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const deck = deckDefinitions.decks.find((x) => x.id === id);
      if (!deck) return;
      deck.active = !deck.active;
      rebuildDeckMaps();
      renderDecksTable();
      refreshDeckDropdownsForCurrentForm();
    });
  });

  document.querySelectorAll(".deck-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      startEditDeck(id);
    });
  });

  document.querySelectorAll(".deck-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await deleteDeckGuarded(id);
    });
  });
}

function startEditDeck(id) {
  const deck = deckDefinitions.decks.find((d) => d.id === id);
  if (!deck) return;

  editingDeckId = id;
  $("save-deck").textContent = "Save Deck";
  $("cancel-deck-edit").style.display = "";

  $("deck-note").textContent = `Editing deck id: ${id}`;
  $("deck-note").style.color = "inherit";

  $("deck-name").value = deck.name || "";

  const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander].filter(Boolean);
  $("deck-commander").value = commanders.join(" | ");

  $("deck-active").value = deck.active ? "true" : "false";
}

function cancelDeckEdit() {
  editingDeckId = null;
  $("save-deck").textContent = "Add Deck";
  $("cancel-deck-edit").style.display = "none";
  $("deck-note").textContent = "";
  $("deck-note").style.color = "inherit";
  $("deck-name").value = "";
  $("deck-commander").value = "";
  $("deck-active").value = "true";
}

function addOrSaveDeckFromForm() {
  const name = String($("deck-name").value || "").trim();
  const commanders = parseCommanders($("deck-commander").value);
  const active = $("deck-active").value === "true";

  if (!name) return { error: "Deck name is required." };
  if (commanders.length === 0) return { error: "Commander(s) is required." };

  if (editingDeckId) {
    // Edit existing, keep id stable
    const deck = deckDefinitions.decks.find((d) => d.id === editingDeckId);
    if (!deck) return { error: "Deck to edit not found." };

    // prevent duplicate name clashes (case-insensitive), excluding self
    const lower = name.toLowerCase();
    const clash = deckDefinitions.decks.some((d) => d.id !== editingDeckId && String(d.name).toLowerCase() === lower);
    if (clash) return { error: "Another deck already has that name." };

    deck.name = name;
    deck.commander = commanders.length === 1 ? commanders[0] : commanders;
    deck.active = active;

    rebuildDeckMaps();
    cancelDeckEdit();
    return { updated: true };
  }

  // Add new deck
  const idBase = slugify(name);
  if (!idBase) return { error: "Deck name produced an invalid id." };

  const existingNames = new Set((deckDefinitions?.decks || []).map((d) => String(d.name).toLowerCase()));
  if (existingNames.has(name.toLowerCase())) return { error: "A deck with that name already exists." };

  const existingIds = new Set((deckDefinitions?.decks || []).map((d) => d.id));
  let id = idBase;
  let n = 2;
  while (existingIds.has(id)) id = `${idBase}-${n++}`;

  const deck = {
    id,
    name,
    commander: commanders.length === 1 ? commanders[0] : commanders,
    active,
  };

  deckDefinitions.decks.push(deck);
  rebuildDeckMaps();

  $("deck-name").value = "";
  $("deck-commander").value = "";
  $("deck-active").value = "true";

  return { added: true };
}

async function deleteDeckGuarded(deckId) {
  const deck = deckDefinitions.decks.find((d) => d.id === deckId);
  if (!deck) return;

  // Try to load matches for the known years list so we can guard properly
  const years = Array.from(new Set(getYearsList()));
  await Promise.all(years.map((y) => loadMatchesForYear(String(y))));

  const usedIn = [];
  for (const [year, data] of matchesByYear.entries()) {
    for (const m of data.matches || []) {
      for (const p of m.players || []) {
        if (p.deckId === deckId) {
          usedIn.push(year);
          break;
        }
      }
      if (usedIn.includes(year)) break;
    }
  }

  if (usedIn.length) {
    alert(`Can't delete "${deck.name}" because it is used in matches: ${usedIn.join(", ")}.\n\nDeactivate it instead.`);
    return;
  }

  const ok = confirm(`Delete deck "${deck.name}" (id: ${deckId})?\n\nThis cannot be undone.`);
  if (!ok) return;

  deckDefinitions.decks = deckDefinitions.decks.filter((d) => d.id !== deckId);
  rebuildDeckMaps();
  renderDecksTable();
  refreshDeckDropdownsForCurrentForm();

  if (editingDeckId === deckId) cancelDeckEdit();
}

function refreshDeckDropdownsForCurrentForm() {
  const currentMatches = matchesByYear.get(selectedYear) || { matches: [] };
  const podSize = Number($("pod-size").value) || 4;

  const selections = [];
  for (let i = 0; i < podSize; i++) {
    selections.push({
      player: $(`player-${i}`)?.value || "",
      deck: $(`deck-${i}`)?.value || "",
    });
  }

  renderPlayerRows(podSize, currentMatches);

  for (let i = 0; i < podSize; i++) {
    const ps = $(`player-${i}`);
    const ds = $(`deck-${i}`);
    if (ps) ps.value = selections[i].player;
    if (ds) ds.value = selections[i].deck;
  }

  refreshWinnerOptions(podSize);
}

// ----------------------------
// Bulk import
// ----------------------------
let bulkPreviewState = null; // { valid: Match[], invalid: {reason, block}[] }

function parseDateFromLine(line) {
  // supports dd-mm-yy, dd/mm/yy, dd-mm-yyyy, etc.
  const m = line.match(/(\d{2})[-/](\d{2})[-/](\d{2,4})/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yy = Number(m[3]);
  if (yy < 100) yy = 2000 + yy;
  if (yy < 1900 || yy > 2100) return null;

  const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

function resolveDeckIdFromToken(token) {
  const t = normalise(token);
  if (!t) return { deckId: null, reason: "Empty deck token." };

  const decks = deckDefinitions?.decks || [];

  // 1) Match by deck name
  const byName = decks.filter((d) => normalise(d.name) === t);
  if (byName.length === 1) return { deckId: byName[0].id };
  if (byName.length > 1) return { deckId: null, reason: `Ambiguous deck name "${token}".` };

  // 2) Loose name contains
  const byNameContains = decks.filter((d) => normalise(d.name).includes(t));
  if (byNameContains.length === 1) return { deckId: byNameContains[0].id };
  if (byNameContains.length > 1) return { deckId: null, reason: `Ambiguous deck name contains "${token}".` };

  // 3) Match by commander exact/contains (any commander in array)
  const byCommander = decks.filter((d) => {
    const cmds = Array.isArray(d.commander) ? d.commander : [d.commander];
    return cmds.some((c) => normalise(c) === t);
  });
  if (byCommander.length === 1) return { deckId: byCommander[0].id };
  if (byCommander.length > 1) return { deckId: null, reason: `Ambiguous commander "${token}".` };

  const byCommanderContains = decks.filter((d) => {
    const cmds = Array.isArray(d.commander) ? d.commander : [d.commander];
    return cmds.some((c) => normalise(c).includes(t));
  });
  if (byCommanderContains.length === 1) return { deckId: byCommanderContains[0].id };
  if (byCommanderContains.length > 1) return { deckId: null, reason: `Ambiguous commander contains "${token}".` };

  return { deckId: null, reason: `Couldn't resolve deck from "${token}".` };
}

function splitIntoMatchBlocks(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // allow blocks separated by --- or — or —
  const blocks = [];
  let current = [];

  const isSeparator = (l) => /^(-{3,}|—{1,}|–{1,})$/.test(l);

  for (const line of lines) {
    if (isSeparator(line)) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function parseBlockToMatch(block, fallbackDateIso) {
  // If a block contains a date line, use it; otherwise fallback
  let dateIso = null;
  for (const line of block) {
    const d = parseDateFromLine(line);
    if (d) {
      dateIso = d;
      break;
    }
  }
  dateIso = dateIso || fallbackDateIso;
  if (!dateIso) return { error: "No date found. Put a date like 04-01-26 at the top." };

  // Player lines are expected as: Name - token - win?
  const playerLines = block.filter((l) => !parseDateFromLine(l)); // ignore date line(s)

  const players = [];
  let winner = null;

  for (const line of playerLines) {
    // tolerate "Jo - hakbal" and "Jake - baylen - win"
    const parts = line.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      return { error: `Can't parse line: "${line}" (expected: Name - Deck/Commander [- win])` };
    }

    const name = parts[0];
    const token = parts[1];

    const hasWin = parts.some((p) => normalise(p) === "win");
    if (hasWin) {
      if (winner && winner !== name) return { error: `Multiple winners marked (already had "${winner}", saw "${name}").` };
      winner = name;
    }

    const resolved = resolveDeckIdFromToken(token);
    if (!resolved.deckId) return { error: resolved.reason + ` Line: "${line}"` };

    players.push({ name, deckId: resolved.deckId });
  }

  if (players.length < 2) return { error: "Need at least 2 players in a match block." };

  // no duplicates
  const names = players.map((p) => p.name);
  const uniq = new Set(names);
  if (uniq.size !== names.length) return { error: "Duplicate player name inside a match block." };

  if (!winner) return { error: "No winner marked. Add '- win' to the winner line." };

  // Winner must be in players
  if (!uniq.has(winner)) return { error: "Winner must be one of the players in the block." };

  return { match: { date: dateIso, players, winner } };
}

async function previewBulkImport() {
  $("bulk-note").textContent = "";
  $("bulk-note").style.color = "inherit";
  $("bulk-import").disabled = true;

  const raw = $("bulk-text").value;
  if (!raw.trim()) {
    $("bulk-note").textContent = "Paste some logs first.";
    return;
  }

  const blocks = splitIntoMatchBlocks(raw);

  // Determine global fallback date from first date anywhere
  let fallbackDate = null;
  for (const b of blocks) {
    for (const l of b) {
      const d = parseDateFromLine(l);
      if (d) {
        fallbackDate = d;
        break;
      }
    }
    if (fallbackDate) break;
  }

  const valid = [];
  const invalid = [];

  for (const block of blocks) {
    const parsed = parseBlockToMatch(block, fallbackDate);
    if (parsed.match) {
      valid.push(parsed.match);
    } else {
      invalid.push({ reason: parsed.error || "Unknown error.", block });
    }
  }

  bulkPreviewState = { valid, invalid };

  // Render preview
  const area = $("bulk-preview-area");
  area.style.display = "";
  area.innerHTML = "";

  const summary = document.createElement("div");
  summary.className = "small";
  summary.innerHTML = `<strong>${valid.length}</strong> valid match(es), <strong>${invalid.length}</strong> invalid block(s).`;
  area.appendChild(summary);

  if (invalid.length) {
    const inv = document.createElement("div");
    inv.style.marginTop = "10px";
    inv.innerHTML = `<strong>Invalid blocks:</strong>`;
    const ul = document.createElement("ul");
    ul.className = "small";
    invalid.forEach((x) => {
      const li = document.createElement("li");
      li.textContent = `${x.reason} | Block: ${x.block.join(" / ")}`;
      ul.appendChild(li);
    });
    inv.appendChild(ul);
    area.appendChild(inv);
  }

  if (valid.length) {
    const tbl = document.createElement("table");
    tbl.className = "table";
    tbl.style.marginTop = "10px";
    tbl.innerHTML = `
      <thead>
        <tr>
          <th style="width:140px;">Date</th>
          <th>Players</th>
          <th style="width:160px;">Winner</th>
          <th style="width:90px;">Year</th>
        </tr>
      </thead>
      <tbody>
        ${valid
          .map((m) => {
            const year = String(m.date).slice(0, 4);
            const playersHtml = m.players
              .map((p) => {
                const deckName = deckById.get(p.deckId)?.name || p.deckId;
                return `${p.name} (${deckName})`;
              })
              .join("<br>");
            return `
              <tr>
                <td>${m.date}</td>
                <td>${playersHtml}</td>
                <td><strong>${m.winner}</strong></td>
                <td>${year}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    `;
    area.appendChild(tbl);
  }

  $("bulk-import").disabled = valid.length === 0;

  if (valid.length) {
    $("bulk-note").textContent = "Preview looks good. Click Import Valid Matches.";
  }
}

async function importBulkMatches() {
  if (!bulkPreviewState || !bulkPreviewState.valid?.length) return;

  const matches = bulkPreviewState.valid;

  // Ensure years exist & load them
  const years = Array.from(new Set(matches.map((m) => String(m.date).slice(0, 4))));
  await Promise.all(years.map((y) => loadMatchesForYear(y)));

  for (const match of matches) {
    const y = String(match.date).slice(0, 4);
    const data = matchesByYear.get(y);
    if (!Array.isArray(data.matches)) data.matches = [];

    // Avoid exact duplicates (same date + same player names + same winner)
    const signature = (m) =>
      `${m.date}|${(m.players || []).map((p) => p.name).sort().join(",")}|${m.winner}`;

    const sig = signature(match);
    const exists = data.matches.some((m) => signature(m) === sig);

    if (!exists) data.matches.push(match);
  }

  // Sort each year's matches
  for (const y of years) {
    const data = matchesByYear.get(y);
    sortMatchesByDate(data);
  }

  // Refresh current view
  const currentMatches = matchesByYear.get(selectedYear) || { matches: [] };
  renderMatchesTable(currentMatches);
  refreshDeckDropdownsForCurrentForm();

  $("bulk-note").textContent = `Imported ${matches.length} match(es). Download the relevant matches-YYYY.json file(s) and commit.`;
  $("bulk-note").style.color = "inherit";

  // disable until next preview
  $("bulk-import").disabled = true;
}

// ----------------------------
// Boot
// ----------------------------
(async function boot() {
  if (!requirePassword()) {
    document.body.innerHTML =
      "<p style='text-align:center;margin-top:40px;font-weight:800;'>Access denied.</p>";
    return;
  }

  try {
    [players2025, deckDefinitions] = await Promise.all([
      fetchJSON("data/players-2025.json"),
      fetchJSON("data/deck-definitions.json"),
    ]);

    if (!deckDefinitions || typeof deckDefinitions !== "object") deckDefinitions = { decks: [] };
    if (!Array.isArray(deckDefinitions.decks)) deckDefinitions.decks = [];

    rebuildDeckMaps();

    // years
    const years = getYearsList();
    setYearSelectOptions(years);

    selectedYear = String(new Date().getFullYear());
    $("match-year").value = years.includes(selectedYear) ? selectedYear : years[0];
    selectedYear = $("match-year").value;

    const currentMatches = await loadMatchesForYear(selectedYear);

    $("app").style.display = "";
    updateDownloadMatchesButtonLabel();

    // initial render
    clearMatchForm(currentMatches);
    renderMatchesTable(currentMatches);
    renderDecksTable();

    // wire year change
    $("match-year").addEventListener("change", async () => {
      selectedYear = $("match-year").value;
      updateDownloadMatchesButtonLabel();
      const m = await loadMatchesForYear(selectedYear);
      clearMatchForm(m);
      renderMatchesTable(m);
    });

    // add year
    $("add-year").addEventListener("click", async () => {
      const val = String($("custom-year").value || "").trim();
      if (!/^\d{4}$/.test(val)) {
        alert("Enter a valid 4-digit year (e.g. 2027).");
        return;
      }

      const yearsNow = getYearsList();
      yearsNow.push(val);
      setYearSelectOptions(Array.from(new Set(yearsNow)));

      $("match-year").value = val;
      selectedYear = val;
      updateDownloadMatchesButtonLabel();

      const m = await loadMatchesForYear(selectedYear);
      clearMatchForm(m);
      renderMatchesTable(m);

      $("custom-year").value = "";
    });

    // pod size
    $("pod-size").addEventListener("change", () => {
      const size = Number($("pod-size").value);
      const m = matchesByYear.get(selectedYear) || { matches: [] };
      renderPlayerRows(size, m);
      $("winner").value = "";
      $("mvp").value = "";
    });

    // save match
    $("save-match").addEventListener("click", () => {
      const { error, match } = validateAndBuildMatch();
      if (error) {
        $("form-note").textContent = error;
        $("form-note").style.color = "#b00020";
        return;
      }

      const m = matchesByYear.get(selectedYear) || { matches: [] };
      upsertMatch(m, match);
      renderMatchesTable(m);

      $("form-note").textContent = "Saved. Download + commit when ready.";
      $("form-note").style.color = "inherit";

      clearMatchForm(m);
    });

    $("clear-form").addEventListener("click", () => {
      const m = matchesByYear.get(selectedYear) || { matches: [] };
      clearMatchForm(m);
    });

    // download matches for selected year
    $("download-matches").addEventListener("click", () => {
      const m = matchesByYear.get(selectedYear) || { matches: [] };
      const text = JSON.stringify(m, null, 2) + "\n";
      downloadText(`matches-${selectedYear}.json`, text);
    });

    // deck save/add
    $("save-deck").addEventListener("click", () => {
      $("deck-note").textContent = "";
      $("deck-note").style.color = "inherit";

      const { error, added, updated } = addOrSaveDeckFromForm();
      if (error) {
        $("deck-note").textContent = error;
        $("deck-note").style.color = "#b00020";
        return;
      }

      renderDecksTable();
      refreshDeckDropdownsForCurrentForm();

      if (added) $("deck-note").textContent = "Deck added. Download deck-definitions.json and commit it.";
      if (updated) $("deck-note").textContent = "Deck updated. Download deck-definitions.json and commit it.";
    });

    $("cancel-deck-edit").addEventListener("click", cancelDeckEdit);

    // download decks
    $("download-decks").addEventListener("click", () => {
      const text = JSON.stringify(deckDefinitions, null, 2) + "\n";
      downloadText("deck-definitions.json", text);
    });

    // bulk
    $("bulk-preview").addEventListener("click", previewBulkImport);
    $("bulk-import").addEventListener("click", importBulkMatches);

  } catch (e) {
    showError(e?.message || String(e));
    console.error(e);
  }
})();
