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

function slug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ----------------------------
// Data
// ----------------------------
let deckDefinitions = null;
let matches2026 = null;
let players2025 = null;

const deckById = new Map();

function buildDeckMaps() {
  deckById.clear();
  for (const d of deckDefinitions?.decks || []) {
    deckById.set(d.id, d);
  }
}

function getAllKnownPlayers() {
  const set = new Set();

  // from 2025 totals
  for (const p of players2025?.players || []) set.add(p.name);

  // from existing 2026 matches
  for (const m of matches2026?.matches || []) {
    for (const pl of m.players || []) set.add(pl.name);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ----------------------------
// Form rendering
// ----------------------------
function renderPlayerRows(podSize) {
  const area = $("players-area");
  area.innerHTML = "";

  const players = getAllKnownPlayers();
  const decks = (deckDefinitions?.decks || []).filter((d) => d.active);

  const row = document.createElement("div");
  row.className = "row";

  const winnerSelect = $("winner");
  winnerSelect.innerHTML = `<option value="">Select winner…</option>`;

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

    // Player change: allow adding new
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
            ps.insertBefore(opt, ps.options[2]); // after __NEW__
            ps.value = clean;
            refreshWinnerOptions(podSize);
          } else {
            ps.value = "";
          }
        } else {
          refreshWinnerOptions(podSize);
        }
      });
    }, 0);
  }

  area.appendChild(row);

  // initial populate (in case defaults later)
  refreshWinnerOptions(podSize);
}

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

function clearForm() {
  $("form-note").textContent = "";

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  $("match-date").value = `${yyyy}-${mm}-${dd}`;

  $("pod-size").value = "4";
  renderPlayerRows(4);
  $("winner").value = "";
}

// ----------------------------
// Validation + add match
// ----------------------------
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

function addMatchToList(match) {
  if (!matches2026.matches) matches2026.matches = [];
  matches2026.matches.push(match);

  // Sort by date (ascending)
  matches2026.matches.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

// ----------------------------
// Render matches table
// ----------------------------
function renderMatchesTable() {
  const body = $("matches-body");
  body.innerHTML = "";

  const matches = matches2026?.matches || [];
  $("matches-count").textContent = `${matches.length} match(es) in matches-2026.json`;

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
      <td><button type="button" data-idx="${idx}" class="remove-btn danger">Remove</button></td>
    `;

    body.appendChild(tr);
  });

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(i)) return;
      if (!confirm("Remove this match?")) return;
      matches2026.matches.splice(i, 1);
      renderMatchesTable();
    });
  });
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
    [players2025, deckDefinitions, matches2026] = await Promise.all([
      fetchJSON("data/players-2025.json"),
      fetchJSON("data/deck-definitions.json"),
      fetchJSON("data/matches-2026.json"),
    ]);

    buildDeckMaps();

    if (!matches2026 || typeof matches2026 !== "object") matches2026 = { matches: [] };
    if (!Array.isArray(matches2026.matches)) matches2026.matches = [];

    $("app").style.display = "";

    $("pod-size").addEventListener("change", () => {
      const size = Number($("pod-size").value);
      renderPlayerRows(size);
      $("winner").value = "";
    });

    $("add-match").addEventListener("click", () => {
      const { error, match } = validateAndBuildMatch();
      if (error) {
        $("form-note").textContent = error;
        $("form-note").style.color = "#b00020";
        return;
      }

      addMatchToList(match);
      renderMatchesTable();

      $("form-note").textContent = "Match added. Don’t forget to download + commit.";
      $("form-note").style.color = "inherit";
    });

    $("clear-form").addEventListener("click", clearForm);

    $("download-json").addEventListener("click", () => {
      const text = JSON.stringify(matches2026, null, 2) + "\n";
      downloadText("matches-2026.json", text);
    });

    clearForm();
    renderMatchesTable();
  } catch (e) {
    showError(e?.message || String(e));
    console.error(e);
  }
})();
