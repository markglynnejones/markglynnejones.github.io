document.addEventListener('DOMContentLoaded', function () {
    // Function to sort a table by multiple columns
    function sortTableByColumns(table, sortCriteria) {
        const rows = Array.from(table.querySelectorAll('tbody > tr'));
        rows.sort((rowA, rowB) => {
            for (const { columnIndex, ascending } of sortCriteria) {
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
        decksData.decks.forEach(deck => {
            const tr = document.createElement('tr');
            const tdName = document.createElement('td');
            const tdCommander = document.createElement('td');
            const tdColours = document.createElement('td');
            const tdWins = document.createElement('td');
            const tdImage = document.createElement('td');
            const tdCombinations = document.createElement('td');
            tdName.textContent = deck.name;
            tdWins.textContent = deck.wins;

            // Fetch card details from Scryfall API and create a link and image
            fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(deck.commander)}`)
                .then(response => response.json())
                .then(cardData => {
                    tdCommander.innerHTML = `<a href="${cardData.scryfall_uri}" target="_blank">${deck.commander}</a>`;
                    tdImage.innerHTML = `<img src="${cardData.image_uris.normal}" alt="${deck.commander}" style="width: 100px;" />`;

                    // Fetch colors from Scryfall API
                    const colors = cardData.colors.map(color => {
                        switch (color) {
                            case 'W': return 'White';
                            case 'U': return 'Blue';
                            case 'B': return 'Black';
                            case 'R': return 'Red';
                            case 'G': return 'Green';
                            default: return '';
                        }
                    });

                    // Match colors with combinations data
                    const matchedCombination = Object.keys(combinationsData.combinations).find(combination => {
                        const combinationColors = combinationsData.combinations[combination];
                        return combinationColors.length === colors.length && combinationColors.every(color => colors.includes(color));
                    });

                    tdColours.innerHTML = colors.map(color => `<img class="mana-symbol" src="/images/${color}.svg" alt="${color}" />`).join(' ');
                    tdCombinations.textContent = matchedCombination || 'Unknown';
                })
                .catch(error => {
                    console.error('Error fetching card details:', error);
                    tdCommander.textContent = deck.commander; // Fallback to plain text if API call fails
                    tdImage.textContent = 'Image not available'; // Fallback text if API call fails
                });

            tr.appendChild(tdName);
            tr.appendChild(tdCommander);
            tr.appendChild(tdColours);
            tr.appendChild(tdCombinations);
            tr.appendChild(tdWins);
            tr.appendChild(tdImage);
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
        ]);
    });

    // Load and generate content for Decks Played Table
    loadJSON('/data/decks.json', decksData => {
        loadJSON('/data/combinations.json', combinationsData => {
            generateDecksTableContent(decksData, combinationsData, 'decks-table-body');

            // Sort the Decks Played table by Wins (index 4) and then Deck Name (index 0)
            const decksTable = document.querySelector('section:nth-of-type(2) table');
            sortTableByColumns(decksTable, [
                { columnIndex: 4, ascending: false }, // Sort by Wins descending
                { columnIndex: 0, ascending: true }  // Then by Deck Name ascending
            ]);
        });
    });
});