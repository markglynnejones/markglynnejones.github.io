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
  // Allow partners etc. with |
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------------
// Data
// ----------------------------
let players2025 = null;
let deckDefinitions = null;

// Matches are loaded per-year
let selectedYear = String(new Date().getFullYear());
let matchesByYear = new Map(); // year -> {matches: [...]}

// Deck maps
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

  // 2025 totals players
  for (const p of players2025?.players || []) set.add(p.name);

  // players from matches in this year
  for (const m of currentMatches?.matches || []) {
    for (const pl of m.players || []) set.add(pl.name);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ----------------------------
// Year handling (auto-year support)
// ----------------------------
async function loadMatchesForYear(year) {
  // Cache
  if (matchesByYear.has(year)) return matchesByYear.get(year);

  const path = `data/matches-${year}.json`;
  try {
    const data = await fetchJSON(path);
    if (!data || typeof data !== "object") throw new Error("Invalid JSON structure.");
    if (!Array.isArray(data.matches)) data.matches = [];
    matchesByYear.set(year, data);
    return data;
  } catch (e) {
    // If the file doesn't exist yet, start a fresh structure (user can download + commit it)
    const fresh = { matches: [] };
    matchesByYear.set(year, fresh);
    return fresh;
  }
}

function setYearSelectOptions(years) {
  const sel = $("match-year");
  sel.innerHTML = "";
  years
    .slice()
    .sort((a, b) => Number(a) - Number(b))
    .forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });
}

function getYearsList() {
  // We can't discover repo files at runtime, so we maintain a simple local list.
  // Default: previous, current, next (easy)
  const current = new Date().getFullYear();
  const base = new Set([String(current - 1), String(current), String(current + 1)]);

  // also include any years the user added this session
  for (const y of matchesByYear.keys()) base.add(String(y));

  return Array.from(base);
}

function updateDownloadMatchesButtonLabel() {
  $("download-matches").textContent = `Download matches-${selectedYear}.json`;
}

// ----------------------------
// Matches form + rendering
// ----------------------------
let editingIndex = null; // null = add mode; number = edit mode

function refreshWinnerOptions(podSize) {
  const winnerSelect = $("winner");
  const names = [];

  for (let i = 0; i < podSize; i++) {
    const v = $(`player-${i}`)?.value;
    if (v && v !== "__NEW__") names.push(v);
  }

  const uniq = Array.from(new Set(names));
  const current = winnerSelect.value;

  winnerSelect.innerHTML =
    `<option value="">Select winner…</option>` +
    uniq.map((n) => `<option value="${n}">${n}</option>`).join("");

  if (uniq.includes(current)) winnerSelect.value = current;
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

      const ds = $(deckId);
      ds.addEventListener("change", () => {
        // placeholder for future validations
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

  editingIndex = null;
  $("save-match").textContent = "Add Match";

  renderPlayerRows(4, currentMatches);
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

  return { match: { date, players, winner } };
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

    tr.innerHTML = `
      <td>${m.date || ""}</td>
      <td>${playersHtml}</td>
      <td><strong>${m.winner || ""}</strong></td>
      <td>
        <button type="button" data-idx="${idx}" class="edit-btn">Edit</button>
        <button type="button" data-idx="${idx}" class="remove-btn danger">Remove</button>
      </td>
    `;

    body.appendChild(tr);
  });

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(i)) return;
      if (!confirm("Remove this match?")) return;
      currentMatches.matches.splice(i, 1);
      renderMatchesTable(currentMatches);
      if (editingIndex === i) clearMatchForm(currentMatches);
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
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

  editingIndex = index;
  $("save-match").textContent = "Save Changes";

  const podSize = (m.players || []).length || 4;

  $("match-date").value = m.date || todayISO();
  $("pod-size").value = String(podSize);

  renderPlayerRows(podSize, currentMatches);

  // Fill players/decks
  (m.players || []).forEach((p, i) => {
    const ps = $(`player-${i}`);
    const ds = $(`deck-${i}`);

    if (ps) ps.value = p.name;
    if (ds) ds.value = p.deckId;
  });

  refreshWinnerOptions(podSize);
  $("winner").value = m.winner || "";

  $("form-note").textContent = `Editing match #${index + 1}`;
}

function upsertMatch(currentMatches, match) {
  if (!Array.isArray(currentMatches.matches)) currentMatches.matches = [];

  if (editingIndex === null) {
    currentMatches.matches.push(match);
  } else {
    currentMatches.matches[editingIndex] = match;
  }

  sortMatchesByDate(currentMatches);
  editingIndex = null;
  $("save-match").textContent = "Add Match";
}

// ----------------------------
// Deck management
// ----------------------------
function renderDecksTable() {
  const body = $("decks-body");
  body.innerHTML = "";

  const decks = deckDefinitions?.decks || [];
  const sorted = decks.slice().sort((a, b) => a.name.localeCompare(b.name));

  for (const d of sorted) {
    const commanders = Array.isArray(d.commander) ? d.commander : [d.commander].filter(Boolean);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${d.name}</strong><div class="small">id: <code>${d.id}</code></div></td>
      <td>${commanders.map((c) => `<div>${c}</div>`).join("")}</td>
      <td>${d.active ? "Yes" : "No"}</td>
      <td>
        <button type="button" data-id="${d.id}" class="toggle-active-btn">${d.active ? "Deactivate" : "Activate"}</button>
      </td>
    `;
    body.appendChild(tr);
  }

  document.querySelectorAll(".toggle-active-btn").forEach((btn) => {
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
}

function refreshDeckDropdownsForCurrentForm() {
  const currentMatches = matchesByYear.get(selectedYear) || { matches: [] };
  const podSize = Number($("pod-size").value) || 4;

  // Capture current selections
  const selections = [];
  for (let i = 0; i < podSize; i++) {
    selections.push({
      player: $(`player-${i}`)?.value || "",
      deck: $(`deck-${i}`)?.value || "",
    });
  }

  // Re-render rows (keeps winner options logic)
  renderPlayerRows(podSize, currentMatches);

  // Restore values
  for (let i = 0; i < podSize; i++) {
    const ps = $(`player-${i}`);
    const ds = $(`deck-${i}`);
    if (ps) ps.value = selections[i].player;
    if (ds) ds.value = selections[i].deck;
  }

  refreshWinnerOptions(podSize);
}

function addDeckFromForm() {
  const name = String($("deck-name").value || "").trim();
  const commanders = parseCommanders($("deck-commander").value);
  const active = $("deck-active").value === "true";

  if (!name) return { error: "Deck name is required." };
  if (commanders.length === 0) return { error: "Commander(s) is required." };

  const idBase = slugify(name);
  if (!idBase) return { error: "Deck name produced an invalid id." };

  const existingNames = new Set((deckDefinitions?.decks || []).map((d) => d.name.toLowerCase()));
  if (existingNames.has(name.toLowerCase())) return { error: "A deck with that name already exists." };

  const existingIds = new Set((deckDefinitions?.decks || []).map((d) => d.id));
  let id = idBase;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${idBase}-${n++}`;
  }

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

  return { deck };
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
    // Load base shared data
    [players2025, deckDefinitions] = await Promise.all([
      fetchJSON("data/players-2025.json"),
      fetchJSON("data/deck-definitions.json"),
    ]);

    if (!deckDefinitions || typeof deckDefinitions !== "object") deckDefinitions = { decks: [] };
    if (!Array.isArray(deckDefinitions.decks)) deckDefinitions.decks = [];

    rebuildDeckMaps();

    // Init year dropdown with sensible defaults
    const years = getYearsList();
    setYearSelectOptions(years);

    // Choose current year if present
    selectedYear = String(new Date().getFullYear());
    $("match-year").value = years.includes(selectedYear) ? selectedYear : years[0];

    // Load matches for selected year
    selectedYear = $("match-year").value;
    const currentMatches = await loadMatchesForYear(selectedYear);

    $("app").style.display = "";
    updateDownloadMatchesButtonLabel();

    // Render initial UI
    clearMatchForm(currentMatches);
    renderMatchesTable(currentMatches);
    renderDecksTable();

    // Wire year change
    $("match-year").addEventListener("change", async () => {
      selectedYear = $("match-year").value;
      updateDownloadMatchesButtonLabel();
      const m = await loadMatchesForYear(selectedYear);
      clearMatchForm(m);
      renderMatchesTable(m);
    });

    // Add year button
    $("add-year").addEventListener("click", async () => {
      const val = String($("custom-year").value || "").trim();
      if (!/^\d{4}$/.test(val)) {
        alert("Enter a valid 4-digit year (e.g. 2027).");
        return;
      }

      // Ensure option exists
      const yearsNow = getYearsList();
      yearsNow.push(val);
      setYearSelectOptions(Array.from(new Set(yearsNow)));

      $("match-year").value = val;
      selectedYear = val;
      updateDownloadMatchesButtonLabel();

      // Load (creates fresh structure if missing)
      const m = await loadMatchesForYear(selectedYear);
      clearMatchForm(m);
      renderMatchesTable(m);

      $("custom-year").value = "";
    });

    // Wire pod size
    $("pod-size").addEventListener("change", () => {
      const size = Number($("pod-size").value);
      const m = matchesByYear.get(selectedYear) || { matches: [] };
      renderPlayerRows(size, m);
      $("winner").value = "";
    });

    // Save match (add or edit)
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

    // Download matches for selected year
    $("download-matches").addEventListener("click", () => {
      const m = matchesByYear.get(selectedYear) || { matches: [] };
      const text = JSON.stringify(m, null, 2) + "\n";
      downloadText(`matches-${selectedYear}.json`, text);
    });

    // Add deck
    $("add-deck").addEventListener("click", () => {
      $("deck-note").textContent = "";
      $("deck-note").style.color = "inherit";

      const { error } = addDeckFromForm();
      if (error) {
        $("deck-note").textContent = error;
        $("deck-note").style.color = "#b00020";
        return;
      }

      renderDecksTable();
      refreshDeckDropdownsForCurrentForm();

      $("deck-note").textContent = "Deck added. Download deck-definitions.json and commit it.";
    });

    // Download deck definitions
    $("download-decks").addEventListener("click", () => {
      const text = JSON.stringify(deckDefinitions, null, 2) + "\n";
      downloadText("deck-definitions.json", text);
    });
  } catch (e) {
    showError(e?.message || String(e));
    console.error(e);
  }
})();
