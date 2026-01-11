document.addEventListener('DOMContentLoaded', () => {
    /**
     * Goals:
     *  1) Avoid hammering Scryfall: cache + concurrency limiting + reuse loaded JSON.
     *  2) Improve accessibility: keyboard sortable headers + aria-sort.
     */

    // -----------------------------
    // State
    // -----------------------------
    let showInactiveDecks = false;

    const sortIcons = { up: '↑', down: '↓', both: '↕' };

    const singlesSortState = {
        column: 'wins',     // 'player' | 'wins' | 'matches' | 'winrate'
        ascending: false
    };

    const decksSortState = {
        column: 'winrate',  // 'name' | 'wins' | 'matches' | 'winrate'
        ascending: false
    };

    // Data caches (avoid re-fetching JSON on every sort/toggle)
    let playersDataCache = null;
    let decksDataCache = null;
    let combinationsDataCache = null;

    // -----------------------------
    // Utilities
    // -----------------------------
    function fetchJSON(path) {
        return fetch(path).then(res => {
            if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
            return res.json();
        });
    }

    function normaliseCommanderName(name) {
        // Handle split cards / DFCs: use front face for Scryfall fuzzy search
        return (name || '').split('//')[0].trim().toLowerCase();
    }

    function toNumber(text) {
        if (text == null) return null;
        const cleaned = String(text).replace('%', '').trim();
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
    }

    function setText(el, text) {
        el.textContent = text;
    }

    // -----------------------------
    // Accessible sort headers
    // -----------------------------
    function makeSortable(th, onActivate) {
        if (!th) return;

        th.classList.add('sortable');
        th.setAttribute('role', 'button');
        th.setAttribute('tabindex', '0');

        th.addEventListener('click', onActivate);
        th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
            }
        });
    }

    function setAriaSort(th, direction /* 'ascending'|'descending'|'none' */) {
        if (!th) return;
        th.setAttribute('aria-sort', direction);
    }

    // -----------------------------
    // Scryfall caching + throttling
    // -----------------------------
    const SCRYFALL_CACHE_KEY = 'commanderScryfallCache_v1';
    const SCRYFALL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

    /** @type {Map<string, {colors: string[], image: string|null, cachedAt: number}>} */
    const commanderCache = new Map();

    function loadCommanderCacheFromStorage() {
        try {
            const raw = localStorage.getItem(SCRYFALL_CACHE_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            const now = Date.now();

            Object.entries(parsed).forEach(([key, value]) => {
                if (!value || typeof value !== 'object') return;
                if (!value.cachedAt || (now - value.cachedAt) > SCRYFALL_CACHE_TTL_MS) return;
                commanderCache.set(key, value);
            });
        } catch {
            // Ignore localStorage issues (private mode, etc.)
        }
    }

    let saveCacheTimer = null;
    function saveCommanderCacheToStorageDebounced() {
        try {
            if (saveCacheTimer) clearTimeout(saveCacheTimer);
            saveCacheTimer = setTimeout(() => {
                const obj = Object.fromEntries(commanderCache.entries());
                localStorage.setItem(SCRYFALL_CACHE_KEY, JSON.stringify(obj));
            }, 250);
        } catch {
            // Ignore
        }
    }

    // Very small concurrency limiter to avoid spiking Scryfall
    const MAX_SCRYFALL_CONCURRENCY = 6;
    let activeScryfall = 0;
    const scryfallQueue = [];

    function runWithScryfallLimit(taskFn) {
        return new Promise((resolve, reject) => {
            scryfallQueue.push({ taskFn, resolve, reject });
            drainScryfallQueue();
        });
    }

    function drainScryfallQueue() {
        while (activeScryfall < MAX_SCRYFALL_CONCURRENCY && scryfallQueue.length) {
            const job = scryfallQueue.shift();
            activeScryfall++;

            Promise.resolve()
                .then(job.taskFn)
                .then(job.resolve)
                .catch(job.reject)
                .finally(() => {
                    activeScryfall--;
                    drainScryfallQueue();
                });
        }
    }

    function mapScryfallColorsToNames(colors) {
        // Scryfall returns W/U/B/R/G
        const mapping = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
        return Array.isArray(colors) ? colors.map(c => mapping[c]).filter(Boolean) : [];
    }

    async function fetchCommanderFromScryfall(commanderName) {
        const key = normaliseCommanderName(commanderName);
        if (!key) return { colors: [], image: null };

        if (commanderCache.has(key)) {
            const cached = commanderCache.get(key);
            return { colors: cached.colors || [], image: cached.image || null };
        }

        return runWithScryfallLimit(async () => {
            // Check again after waiting in queue (another request may have cached it)
            if (commanderCache.has(key)) {
                const cached = commanderCache.get(key);
                return { colors: cached.colors || [], image: cached.image || null };
            }

            const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(key)}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

            if (!res.ok) {
                // Cache failures briefly to avoid repeated hammering on typos
                commanderCache.set(key, { colors: [], image: null, cachedAt: Date.now() });
                saveCommanderCacheToStorageDebounced();
                return { colors: [], image: null };
            }

            const cardData = await res.json();
            const face = Array.isArray(cardData.card_faces) ? cardData.card_faces[0] : cardData;

            const colors = mapScryfallColorsToNames(face?.colors);
            const image = face?.image_uris?.normal ?? cardData?.image_uris?.normal ?? null;

            commanderCache.set(key, { colors, image, cachedAt: Date.now() });
            saveCommanderCacheToStorageDebounced();

            return { colors, image };
        });
    }

    // -----------------------------
    // Rendering: Singles
    // -----------------------------
    function updateSinglesSortArrows() {
        const mapping = {
            player: { thId: 'sort-player', arrowId: 'arrow-player' },
            wins: { thId: 'sort-wins-singles', arrowId: 'arrow-wins-singles' },
            matches: { thId: 'sort-matches-singles', arrowId: 'arrow-matches-singles' },
            winrate: { thId: 'sort-winrate-singles', arrowId: 'arrow-winrate-singles' }
        };

        Object.values(mapping).forEach(({ thId, arrowId }) => {
            const th = document.getElementById(thId);
            const arrow = document.getElementById(arrowId);
            if (arrow) arrow.textContent = sortIcons.both;
            setAriaSort(th, 'none');
        });

        const current = mapping[singlesSortState.column];
        if (!current) return;

        const arrow = document.getElementById(current.arrowId);
        const th = document.getElementById(current.thId);

        if (arrow) arrow.textContent = singlesSortState.ascending ? sortIcons.up : sortIcons.down;
        setAriaSort(th, singlesSortState.ascending ? 'ascending' : 'descending');
    }

    function getSinglesSortedPlayers() {
        const players = Array.isArray(playersDataCache?.players) ? [...playersDataCache.players] : [];

        players.sort((a, b) => {
            const winRateA = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
            const winRateB = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;

            let cmp = 0;
            switch (singlesSortState.column) {
                case 'player':
                    cmp = String(a.name).localeCompare(String(b.name));
                    break;
                case 'wins':
                    cmp = (a.wins ?? 0) - (b.wins ?? 0);
                    break;
                case 'matches':
                    cmp = (a.matchesPlayed ?? 0) - (b.matchesPlayed ?? 0);
                    break;
                case 'winrate':
                    cmp = winRateA - winRateB;
                    break;
                default:
                    cmp = 0;
            }

            if (!singlesSortState.ascending) cmp *= -1;
            return cmp;
        });

        return players;
    }

    function renderSinglesTable() {
        const body = document.getElementById('wins-table-body');
        if (!body) return;

        body.innerHTML = '';

        const players = getSinglesSortedPlayers();
        players.forEach(player => {
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdMatches = document.createElement('td');
            const tdWinRate = document.createElement('td');

            const winRate = player.matchesPlayed > 0
                ? ((player.wins / player.matchesPlayed) * 100).toFixed(2) + '%'
                : '0.00%';

            tdName.textContent = player.name;
            tdWins.textContent = player.wins;
            tdMatches.textContent = player.matchesPlayed;
            tdWinRate.textContent = winRate;

            tr.appendChild(tdName);
            tr.appendChild(tdWins);
            tr.appendChild(tdMatches);
            tr.appendChild(tdWinRate);

            body.appendChild(tr);
        });

        updateSinglesSortArrows();
    }

    function wireSinglesSorting() {
        makeSortable(document.getElementById('sort-player'), () => {
            if (singlesSortState.column === 'player') {
                singlesSortState.ascending = !singlesSortState.ascending;
            } else {
                singlesSortState.column = 'player';
                singlesSortState.ascending = true;
            }
            renderSinglesTable();
        });

        makeSortable(document.getElementById('sort-wins-singles'), () => {
            if (singlesSortState.column === 'wins') singlesSortState.ascending = !singlesSortState.ascending;
            else { singlesSortState.column = 'wins'; singlesSortState.ascending = false; }
            renderSinglesTable();
        });

        makeSortable(document.getElementById('sort-matches-singles'), () => {
            if (singlesSortState.column === 'matches') singlesSortState.ascending = !singlesSortState.ascending;
            else { singlesSortState.column = 'matches'; singlesSortState.ascending = false; }
            renderSinglesTable();
        });

        makeSortable(document.getElementById('sort-winrate-singles'), () => {
            if (singlesSortState.column === 'winrate') singlesSortState.ascending = !singlesSortState.ascending;
            else { singlesSortState.column = 'winrate'; singlesSortState.ascending = false; }
            renderSinglesTable();
        });
    }

    // -----------------------------
    // Rendering: Decks
    // -----------------------------
    function updateDecksSortArrows() {
        const columns = ['name', 'wins', 'matches', 'winrate'];
        const idMap = {
            name: 'sort-deck-name',
            wins: 'sort-wins',
            matches: 'sort-matches',
            winrate: 'sort-winrate'
        };

        columns.forEach(col => {
            const th = document.getElementById(idMap[col]);
            const arrow = document.getElementById(`arrow-${idMap[col]}`);
            if (arrow) arrow.textContent = sortIcons.both;
            setAriaSort(th, 'none');
        });

        const thId = idMap[decksSortState.column];
        const arrow = document.getElementById(`arrow-${thId}`);
        const th = document.getElementById(thId);

        if (arrow) arrow.textContent = decksSortState.ascending ? sortIcons.up : sortIcons.down;
        setAriaSort(th, decksSortState.ascending ? 'ascending' : 'descending');
    }

    function getSortedDecks() {
        const decks = Array.isArray(decksDataCache?.decks) ? [...decksDataCache.decks] : [];

        const filtered = showInactiveDecks ? decks : decks.filter(d => d.active);

        filtered.sort((a, b) => {
            const winRateA = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
            const winRateB = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;

            let cmp = 0;
            switch (decksSortState.column) {
                case 'name':
                    cmp = String(a.name).localeCompare(String(b.name));
                    break;
                case 'wins':
                    cmp = (a.wins ?? 0) - (b.wins ?? 0);
                    break;
                case 'matches':
                    cmp = (a.matchesPlayed ?? 0) - (b.matchesPlayed ?? 0);
                    break;
                case 'winrate':
                    cmp = winRateA - winRateB;
                    break;
                default:
                    cmp = 0;
            }

            if (!decksSortState.ascending) cmp *= -1;
            return cmp;
        });

        return filtered;
    }

    function matchCombination(combinedColors) {
        const combos = combinationsDataCache?.combinations || {};
        const normalized = [...new Set(combinedColors)].sort();

        const matchedKey = Object.keys(combos).find(key => {
            const comboColors = (combos[key] || []).slice().sort();
            if (comboColors.length !== normalized.length) return false;
            return comboColors.every(c => normalized.includes(c));
        });

        return matchedKey || 'Unknown';
    }

    async function fillDeckCommanderInfo({ commanders, tdColours, tdCombinations, tdImage }) {
        // Basic loading states
        tdColours.textContent = '…';
        tdCombinations.textContent = '…';
        tdImage.textContent = '…';

        const results = await Promise.all(commanders.map(fetchCommanderFromScryfall));

        const combinedColors = [...new Set(results.flatMap(r => r.colors))].filter(Boolean);
        const comboName = matchCombination(combinedColors);

        tdColours.innerHTML = combinedColors
            .map(color => `<img class="mana-symbol" src="images/${color}.svg" alt="${color} mana" />`)
            .join(' ');

        tdCombinations.textContent = comboName;

        tdImage.innerHTML = results
            .map((r, i) => {
                const name = commanders[i];
                if (!r.image) return `<span>Image not available</span>`;
                return `<img class="commander-image" src="${r.image}" alt="${name} card art" loading="lazy" />`;
            })
            .join('<br>');
    }

    function renderDecksTable() {
        const body = document.getElementById('decks-table-body');
        if (!body) return;

        body.innerHTML = '';

        const decks = getSortedDecks();

        decks.forEach(deck => {
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            const tdCommander = document.createElement('td');
            const tdColours = document.createElement('td');
            const tdCombinations = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdMatches = document.createElement('td');
            const tdWinPct = document.createElement('td');
            const tdImage = document.createElement('td');
            const tdActive = document.createElement('td');

            tdName.textContent = deck.name;

            const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander];
            tdCommander.innerHTML = commanders.map(c => `<span>${c}</span>`).join('<br>');

            tdWins.textContent = deck.wins;
            tdMatches.textContent = deck.matchesPlayed;

            const winPct = deck.matchesPlayed > 0 ? ((deck.wins / deck.matchesPlayed) * 100).toFixed(2) + '%' : '0.00%';
            tdWinPct.textContent = winPct;

            tdActive.textContent = deck.active ? 'Yes' : 'No';

            tr.appendChild(tdName);
            tr.appendChild(tdCommander);
            tr.appendChild(tdColours);
            tr.appendChild(tdCombinations);
            tr.appendChild(tdWins);
            tr.appendChild(tdMatches);
            tr.appendChild(tdWinPct);
            tr.appendChild(tdImage);
            tr.appendChild(tdActive);

            body.appendChild(tr);

            // Fill commander info asynchronously (cached + limited concurrency)
            fillDeckCommanderInfo({ commanders, tdColours, tdCombinations, tdImage })
                .catch(() => {
                    tdColours.textContent = 'Unknown';
                    tdCombinations.textContent = 'Unknown';
                    tdImage.textContent = 'Unavailable';
                });
        });

        updateDecksSortArrows();
        updateToggleButton();
    }

    function updateToggleButton() {
        const btn = document.getElementById('toggle-inactive-decks');
        if (!btn) return;

        // showInactiveDecks = true => currently showing inactive
        btn.textContent = showInactiveDecks ? 'Hide Inactive Decks' : 'Show Inactive Decks';
        btn.setAttribute('aria-pressed', String(showInactiveDecks));
    }

    function wireDecksSorting() {
        const setDeckSort = (column) => {
            if (decksSortState.column === column) {
                decksSortState.ascending = !decksSortState.ascending;
            } else {
                decksSortState.column = column;
                // Defaults: wins/winrate descending, name ascending
                decksSortState.ascending = (column === 'name');
            }
            renderDecksTable();
        };

        makeSortable(document.getElementById('sort-deck-name'), () => setDeckSort('name'));
        makeSortable(document.getElementById('sort-wins'), () => setDeckSort('wins'));
        makeSortable(document.getElementById('sort-matches'), () => setDeckSort('matches'));
        makeSortable(document.getElementById('sort-winrate'), () => setDeckSort('winrate'));
    }

    function wireInactiveToggle() {
        const btn = document.getElementById('toggle-inactive-decks');
        if (!btn) return;

        btn.addEventListener('click', () => {
            showInactiveDecks = !showInactiveDecks;
            renderDecksTable();
        });

        updateToggleButton();
    }

    // -----------------------------
    // Boot
    // -----------------------------
    loadCommanderCacheFromStorage();

    Promise.all([
        fetchJSON('data/players.json'),
        fetchJSON('data/decks.json'),
        fetchJSON('data/combinations.json')
    ])
        .then(([playersData, decksData, combinationsData]) => {
            playersDataCache = playersData;
            decksDataCache = decksData;
            combinationsDataCache = combinationsData;

            wireSinglesSorting();
            wireDecksSorting();
            wireInactiveToggle();

            renderSinglesTable();
            renderDecksTable();
        })
        .catch(err => {
            console.error(err);
        });
});
