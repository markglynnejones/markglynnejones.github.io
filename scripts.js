document.addEventListener('DOMContentLoaded', function () {
    let showInactiveDecks = true;
    let currentSortCriteria = [
        { columnIndex: 6, ascending: false }, // Sort by Wins descending
        { columnIndex: 0, ascending: true }   // Then by Deck Name ascending
    ];

    // Function to sort a table by multiple columns
    function sortTableByColumns(table, sortCriteria, tableName) {
        console.log(table, tableName);
        const rows = Array.from(table.querySelectorAll('tbody > tr'));
        rows.sort((rowA, rowB) => {
            for (const { columnIndex, ascending } of sortCriteria) {
                console.log(rowA, rowB, columnIndex, ascending);
                const cellA = rowA.children[columnIndex].textContent.trim();
                const cellB = rowB.children[columnIndex].textContent.trim();

                let comparison;
                if (!isNaN(cellA) && !isNaN(cellB)) {
                    comparison = ascending
                        ? parseInt(cellA) - parseInt(cellB)
                        : parseInt(cellB) - parseInt(cellA);
                } else {
                    comparison = ascending
                        ? cellA.localeCompare(cellB)
                        : cellB.localeCompare(cellA);
                }

                if (comparison !== 0) return comparison;
            }
            return 0;
        });
        rows.forEach(row => table.querySelector('tbody').appendChild(row));
    }

    // Function to load JSON data
    function loadJSON(file, callback) {
        fetch(file)
            .then(response => response.json())
            .then(data => callback(data))
            .catch(error => console.error('Error loading JSON file:', error));
    }

    // Function to generate table content from JSON data
    function generateWinsTableContent(data, tableBodyId) {
        const tableBody = document.getElementById(tableBodyId);
        tableBody.innerHTML = ''; // Clear existing content
        data.players.forEach(player => {
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdMatchesPlayed = document.createElement('td');
            const tdWinRate = document.createElement('td');

            const winRate = player.matchesPlayed > 0 ? ((player.wins / player.matchesPlayed) * 100).toFixed(2) + '%' : '0%';

            tdName.textContent = player.name;
            tdWins.textContent = player.wins;
            tdMatchesPlayed.textContent = player.matchesPlayed;
            tdWinRate.textContent = winRate;

            tr.appendChild(tdName);
            tr.appendChild(tdWins);
            tr.appendChild(tdMatchesPlayed);
            tr.appendChild(tdWinRate);
            tableBody.appendChild(tr);
        });
    }

    // Function to generate decks table content from JSON data
    function generateDecksTableContent(decksData, combinationsData, tableBodyId) {
        const tableBody = document.getElementById(tableBodyId);
        tableBody.innerHTML = ''; // Clear existing content
        decksData.decks.forEach(deck => {
            if (!showInactiveDecks && !deck.active) return; // Skip inactive decks if toggle is off
    
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            const tdCommander = document.createElement('td');
            const tdColours = document.createElement('td');
            const tdCombinations = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdMatchesPlayed = document.createElement('td');
            const tdWinPercentage = document.createElement('td');
            const tdImage = document.createElement('td');
            const tdActive = document.createElement('td');
    
            tdName.textContent = deck.name;
            tdWins.textContent = deck.wins;
            tdMatchesPlayed.textContent = deck.matchesPlayed;
    
            // Calculate win percentage
            const winPercentage = deck.matchesPlayed > 0
                ? ((deck.wins / deck.matchesPlayed) * 100).toFixed(2) + '%'
                : '0%';
            tdWinPercentage.textContent = winPercentage;
    
            tdActive.textContent = deck.active ? 'Active' : 'Inactive';
    
            // Handle multiple commanders
            const commanders = Array.isArray(deck.commander) ? deck.commander : [deck.commander];
            tdCommander.innerHTML = commanders.map(commander => `<span>${commander}</span>`).join('<br>');
    
            // Fetch card details for all commanders
            const colorPromises = commanders.map(commander => {
                // Handle double-faced cards by using only the front face name
                const searchName = commander.split('//')[0].trim();
                return fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(searchName)}`)
                    .then(response => response.json())
                    .then(cardData => {
                        // Use card_faces[0] if present, otherwise use cardData directly
                        const face = Array.isArray(cardData.card_faces) ? cardData.card_faces[0] : cardData;
                        const colors = Array.isArray(face.colors)
                            ? face.colors.map(color => {
                                switch (color) {
                                    case 'W': return 'White';
                                    case 'U': return 'Blue';
                                    case 'B': return 'Black';
                                    case 'R': return 'Red';
                                    case 'G': return 'Green';
                                    default: return '';
                                }
                            })
                            : [];
                        const image = face.image_uris ? face.image_uris.normal : (cardData.image_uris ? cardData.image_uris.normal : null);
                        return { colors, image };
                    })
                    .catch(error => {
                        console.error(`Error fetching card details for ${commander}:`, error);
                        return { colors: [], image: null };
                    });
            });
    
            Promise.all(colorPromises).then(results => {
                // Combine colors from all commanders
                const combinedColors = [...new Set(results.flatMap(result => result.colors))];
    
                // Match colors with combinations data
                const matchedCombination = Object.keys(combinationsData.combinations).find(combination => {
                    const combinationColors = combinationsData.combinations[combination];
                    return combinationColors.length === combinedColors.length && combinationColors.every(color => combinedColors.includes(color));
                });
    
                tdColours.innerHTML = combinedColors.map(color => `<img class="mana-symbol" src="/images/${color}.svg" alt="${color}" />`).join(' ');
                tdCombinations.textContent = matchedCombination || 'Unknown';
    
                // Display images for all commanders
                tdImage.innerHTML = results
                    .map(result => result.image ? `<img src="${result.image}" alt="Commander Image" style="width: 100px;" />` : 'Image not available')
                    .join('<br>');
            });
    
            tr.appendChild(tdName);
            tr.appendChild(tdCommander);
            tr.appendChild(tdColours);
            tr.appendChild(tdCombinations);
            tr.appendChild(tdWins);
            tr.appendChild(tdMatchesPlayed);
            tr.appendChild(tdWinPercentage);
            tr.appendChild(tdImage);
            tr.appendChild(tdActive);
            tableBody.appendChild(tr);
        });
    
        // Reapply sorting after regenerating the table content
        const decksTable = document.querySelector('section:nth-of-type(3) table');
        sortTableByColumns(decksTable, currentSortCriteria, 'decks-table-bod2y');
    }

    function generateDoublesWinsTableContent(data, tableBodyId) {
        const tableBody = document.getElementById(tableBodyId);
        tableBody.innerHTML = ''; // Clear existing content
        data.teams.forEach(team => {
            const tr = document.createElement('tr');
            const tdTeam = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdMatchesPlayed = document.createElement('td');
            const tdWinRate = document.createElement('td');
    
            const winRate = team.matchesPlayed > 0
                ? ((team.wins / team.matchesPlayed) * 100).toFixed(2) + '%'
                : '0%';
    
            tdTeam.textContent = team.name;
            tdWins.textContent = team.wins;
            tdMatchesPlayed.textContent = team.matchesPlayed;
            tdWinRate.textContent = winRate;
    
            tr.appendChild(tdTeam);
            tr.appendChild(tdWins);
            tr.appendChild(tdMatchesPlayed);
            tr.appendChild(tdWinRate);
            tableBody.appendChild(tr);
        });
    }    

    // Load and generate content for Wins Table
    loadJSON('/data/players.json', data => {
        generateWinsTableContent(data, 'wins-table-body');

        // Sort the Wins Table by Total Wins (index 1) and Player Name (index 0)
        const winsTable = document.querySelector('section:nth-of-type(1) table');
        sortTableByColumns(winsTable, [
            { columnIndex: 1, ascending: false }, // Sort by Total Wins descending
            { columnIndex: 0, ascending: true }  // Then by Player Name ascending
        ], 'wins-table-body');
    });

    // Load and generate content for Decks Played Table
    loadJSON('/data/decks.json', decksData => {
        loadJSON('/data/combinations.json', combinationsData => {
            generateDecksTableContent(decksData, combinationsData, 'decks-table-body');

            // Sort the Decks Played table by Wins (index 4) and then Deck Name (index 0)
            // const decksTable = document.querySelector('section:nth-of-type(2) table');
            // sortTableByColumns(decksTable, currentSortCriteria, 'decks-table-bod1y');
        });
    });

    // Toggle inactive decks visibility
    document.getElementById('toggle-inactive-decks').addEventListener('click', () => {
        showInactiveDecks = !showInactiveDecks;
        document.getElementById('toggle-inactive-decks').textContent = showInactiveDecks ? 'Hide Inactive Decks' : 'Show Inactive Decks';
        loadJSON('/data/decks.json', decksData => {
            loadJSON('/data/combinations.json', combinationsData => {
                generateDecksTableContent(decksData, combinationsData, 'decks-table-body');
            });
        });
    });

    // Load and generate content for Doubles Wins Table
    loadJSON('/data/doubles.json', data => {
        generateDoublesWinsTableContent(data, 'doubles-wins-table-body');
    });    
});