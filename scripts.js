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
            tdName.textContent = player.name;
            tdWins.textContent = player.wins;
            tr.appendChild(tdName);
            tr.appendChild(tdWins);
            tableBody.appendChild(tr);
        });
    }

    // Load and generate content for Wins Table
    loadJSON('players.json', data => {
        generateWinsTableContent(data, 'wins-table-body');

        // Sort the Wins Table by Total Wins (index 1) and Player Name (index 0)
        const winsTable = document.querySelector('section:nth-of-type(1) table');
        sortTableByColumns(winsTable, [
            { columnIndex: 1, ascending: false }, // Sort by Total Wins descending
            { columnIndex: 0, ascending: true }  // Then by Player Name ascending
        ]);
    });

    // Sort the Decks Played table by Wins (index 4) and then Deck Name (index 0)
    const decksTable = document.querySelector('section:nth-of-type(2) table');
    sortTableByColumns(decksTable, [
        { columnIndex: 4, ascending: false }, // Sort by Wins descending
        { columnIndex: 0, ascending: true }  // Then by Deck Name ascending
    ]);
});