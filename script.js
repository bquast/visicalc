// SheetGrid v0.1 — Spreadsheet grid with formula bar

// --- Configurable grid size
const ROWS = 10;
const COLS = 5;
const COL_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// --- State
let sheet = [];
let selectedRow = 0;
let selectedCol = 0;
let editingCell = false;

const gridContainer = document.getElementById('grid-container');
const formulaBar = document.getElementById('formula-bar');
const statusBar = document.getElementById('cell-status');

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

// --- Formula evaluation (very basic)
function evalFormula(input) {
    try {
        if (!input.startsWith('=')) return input;

        // Handle =sum(…) and basic arithmetic
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
                        // Avoid recursion for now
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
        if (/[^-()\d/*+.]/.test(expr)) return 0; // Block anything not math
        // eslint-disable-next-line no-new-func
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
        th.textContent = COL_LABELS[c];
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

            // Display evaluated value unless selected
            if (r === selectedRow && c === selectedCol && editingCell) {
                let input = document.createElement('input');
                input.type = "text";
                input.value = cell;
                input.className = "cell-input";
                input.spellcheck = false;
                input.style.width = "99%";
                input.autofocus = true;
                td.classList.add('editing');
                td.appendChild(input);
                // focus after DOM update
                setTimeout(() => input.focus(), 0);

                input.onkeydown = (e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                        commitEdit(r, c, input.value);
                        e.preventDefault();
                        // Move selection on Tab
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
                    td.title = cell; // Tooltip with formula
                }
                td.textContent = displayValue;
                if (r === selectedRow && c === selectedCol) td.classList.add('selected');
                td.onclick = () => selectCell(r, c);
                td.ondblclick = () => beginEdit(r, c);
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    gridContainer.innerHTML = '';
    gridContainer.appendChild(table);

    // Update formula bar and status
    let current = sheet[selectedRow][selectedCol];
    formulaBar.value = (typeof current === "string") ? current : "";
    statusBar.textContent = `${COL_LABELS[selectedCol]}${selectedRow + 1}`;
}

// --- Cell selection/editing logic
function selectCell(r, c) {
    if (selectedRow === r && selectedCol === c && !editingCell) {
        beginEdit(r, c);
        return;
    }
    selectedRow = r;
    selectedCol = c;
    editingCell = false;
    renderGrid();
}

function beginEdit(r, c) {
    selectedRow = r;
    selectedCol = c;
    editingCell = true;
    renderGrid();
    // focus will happen in input via renderGrid
}

function commitEdit(r, c, value) {
    sheet[r][c] = value;
    editingCell = false;
    renderGrid();
}

// --- Formula bar logic
formulaBar.addEventListener('input', (e) => {
    // live preview as you type? for now, just change value
    sheet[selectedRow][selectedCol] = formulaBar.value;
    renderGrid();
    editingCell = false;
});
formulaBar.addEventListener('keydown', (e) => {
    if (e.key === "Enter") {
        commitEdit(selectedRow, selectedCol, formulaBar.value);
    }
});

// --- Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (editingCell) return; // Don't move selection while editing
    let handled = true;
    switch (e.key) {
        case "ArrowUp": moveSelection(-1, 0); break;
        case "ArrowDown": moveSelection(1, 0); break;
        case "ArrowLeft": moveSelection(0, -1); break;
        case "ArrowRight": moveSelection(0, 1); break;
        case "Enter": beginEdit(selectedRow, selectedCol); break;
        default: handled = false;
    }
    if (handled) e.preventDefault();
});

function moveSelection(dr, dc) {
    let r = Math.min(Math.max(0, selectedRow + dr), ROWS - 1);
    let c = Math.min(Math.max(0, selectedCol + dc), COLS - 1);
    selectCell(r, c);
}

// --- Init
initSheet();
renderGrid();