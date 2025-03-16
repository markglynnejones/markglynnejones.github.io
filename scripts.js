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

    // Sort the Wins Table by Total Wins (index 1) and Player Name (index 0)
    const winsTable = document.querySelector('section:nth-of-type(1) table');
    sortTableByColumns(winsTable, [
        { columnIndex: 1, ascending: false }, // Sort by Total Wins descending
        { columnIndex: 0, ascending: true }  // Then by Player Name ascending
    ]);

    // Sort the Decks Played table by Wins (index 4) and then Deck Name (index 0)
    const decksTable = document.querySelector('section:nth-of-type(2) table');
    sortTableByColumns(decksTable, [
        { columnIndex: 4, ascending: false }, // Sort by Wins descending
        { columnIndex: 0, ascending: true }  // Then by Deck Name ascending
    ]);
});