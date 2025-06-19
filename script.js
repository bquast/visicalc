const ROWS = 20;
const COLS = 10;
const COL_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// --- State
let sheet = [];
let selectedRow = 0;
let selectedCol = 0;
let editingCell = false;

const gridContainer = document.getElementById('grid-container');
const formulaBar = document.getElementById('formula-bar');
const statusBar = document.getElementById('cell-status');

// --- Menu bar open/close
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        document.querySelectorAll('.menu').forEach(m => m.classList.remove('open'));
        this.parentNode.classList.add('open');
        e.stopPropagation();
    });
});
document.body.addEventListener('click', () => {
    document.querySelectorAll('.menu').forEach(m => m.classList.remove('open'));
});

// --- Initialize blank sheet
function initSheet() {
    sheet = [];
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) {
            row.push("");
        }
        sheet.push(row);
    }
}

// --- Formula evaluation (basic)
function evalFormula(input) {
    try {
        if (!input.startsWith('=')) return input;
        let formula = input.slice(1).trim();

        // =sum(a,b,c)
        if (/^sum\s*\(/i.test(formula)) {
            let args = formula.match(/^sum\s*\((.*)\)$/i);
            if (!args) return "#ERR";
            let values = args[1].split(',').map(x => safeEval(x.trim()));
            return values.reduce((a, b) => a + b, 0);
        } else {
            // Replace cell refs (A1, B2, etc.)
            formula = formula.replace(/\b([A-Z]+)(\d+)\b/g, (match, col, row) => {
                let c = col.charCodeAt(0) - 65;
                let r = parseInt(row) - 1;
                if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
                    let v = sheet[r][c];
                    if (typeof v === "string" && v.trim().startsWith("=")) {
                        return safeEval(v.slice(1));
                    } else {
                        return Number(v) || 0;
                    }
                }
                return 0;
            });
            return safeEval(formula);
        }
    } catch (e) {
        return "#ERR";
    }
}

// Only safe math
function safeEval(expr) {
    try {
        if (/[^-()\d/*+.]/.test(expr)) return 0;
        return Function('"use strict";return (' + expr + ')')();
    } catch {
        return 0;
    }
}

// --- Render grid
function renderGrid() {
    let table = document.createElement('table');
    table.className = 'grid-table';

    // Header row
    let thead = document.createElement('thead');
    let headerRow = document.createElement('tr');
    let corner = document.createElement('th');
    corner.textContent = '';
    headerRow.appendChild(corner);

    for (let c = 0; c < COLS; c++) {
        let th = document.createElement('th');
        th.textContent = COL_LABELS[c] || String.fromCharCode(65 + c);
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    let tbody = document.createElement('tbody');
    for (let r = 0; r < ROWS; r++) {
        let tr = document.createElement('tr');
        let th = document.createElement('th');
        th.textContent = (r + 1);
        tr.appendChild(th);
        for (let c = 0; c < COLS; c++) {
            let td = document.createElement('td');
            let cell = sheet[r][c];

            // If currently editing this cell: input
            if (r === selectedRow && c === selectedCol && editingCell) {
                let input = document.createElement('input');
                input.type = "text";
                input.value = cell;
                input.className = "cell-input";
                input.spellcheck = false;
                input.autofocus = true;
                td.classList.add('editing');
                td.appendChild(input);

                // Focus after render
                setTimeout(() => input.focus(), 0);

                input.onkeydown = (e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                        commitEdit(r, c, input.value);
                        e.preventDefault();
                        if (e.key === "Tab") {
                            moveSelection(0, 1);
                        }
                    }
                    if (e.key === "Escape") {
                        editingCell = false;
                        renderGrid();
                    }
                };
                input.onblur = () => {
                    if (editingCell) {
                        commitEdit(r, c, input.value);
                    }
                };
            } else {
                // Display value or formula result
                let displayValue = cell;
                if (typeof cell === "string" && cell.trim().startsWith("=")) {
                    let result = evalFormula(cell);
                    displayValue = result;
                    td.title = cell;
                }
                td.textContent = displayValue;
                if (r === selectedRow && c === selectedCol) td.classList.add('selected');
                td.onclick = () => {
                    selectedRow = r;
                    selectedCol = c;
                    editingCell = true; // immediate edit mode!
                    renderGrid();
                };
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    gridContainer.innerHTML = '';
    gridContainer.appendChild(table);

    // Sync formula bar and status
    let current = sheet[selectedRow][selectedCol];
    formulaBar.value = (typeof current === "string") ? current : "";
    statusBar.textContent = `${COL_LABELS[selectedCol]}${selectedRow + 1}`;
}

// --- Editing logic
function commitEdit(r, c, value) {
    sheet[r][c] = value;
    editingCell = false;
    renderGrid();
}

// --- Formula bar sync: edits update cell, and update grid
formulaBar.addEventListener('input', () => {
    sheet[selectedRow][selectedCol] = formulaBar.value;
    editingCell = false;
    renderGrid();
});
formulaBar.addEventListener('keydown', (e) => {
    if (e.key === "Enter") {
        commitEdit(selectedRow, selectedCol, formulaBar.value);
    }
});

// --- Keyboard navigation (when not editing a cell)
document.addEventListener('keydown', (e) => {
    if (editingCell) return;
    let handled = true;
    switch (e.key) {
        case "ArrowUp": moveSelection(-1, 0); break;
        case "ArrowDown": moveSelection(1, 0); break;
        case "ArrowLeft": moveSelection(0, -1); break;
        case "ArrowRight": moveSelection(0, 1); break;
        case "Enter": editingCell = true; renderGrid(); break;
        default: handled = false;
    }
    if (handled) e.preventDefault();
});

function moveSelection(dr, dc) {
    let r = Math.min(Math.max(0, selectedRow + dr), ROWS - 1);
    let c = Math.min(Math.max(0, selectedCol + dc), COLS - 1);
    selectedRow = r;
    selectedCol = c;
    editingCell = false;
    renderGrid();
}

// --- Init
initSheet();
renderGrid();