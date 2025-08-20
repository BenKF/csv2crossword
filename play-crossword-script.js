let cells = [],
  entries = [],
  selectedEntry = null;
let CSV_URL = localStorage.getItem("csvUrl") || "";
let CSV_TEXT = localStorage.getItem("csvText") || "";
let SWAP_CLUES = localStorage.getItem("swapClues") ?? false;
document.getElementById("csvUrl").value = CSV_URL;
document.getElementById("swapClues").checked = SWAP_CLUES;

document.getElementById("csvFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      CSV_TEXT = event.target.result;
      localStorage.setItem("csvText", CSV_TEXT);
      localStorage.removeItem("csvUrl");
      document.getElementById("csvUrl").value = "";
    };
    reader.readAsText(file);
  }
});

document.getElementById("startBtn").addEventListener("click", async () => {
  const url = document.getElementById("csvUrl").value.trim();
  if (url) {
    localStorage.setItem("csvUrl", url);
    localStorage.removeItem("csvText");
    CSV_URL = url;
    CSV_TEXT = "";
  }
  localStorage.setItem("swapClues", SWAP_CLUES);
  startGame();
});

document.getElementById("swapClues").addEventListener("change", async (e) => {
  SWAP_CLUES = e.target.checked;
});

document.getElementById("tryBtn").addEventListener("click", async () => {
  CSV_URL =
    "https://docs.google.com/spreadsheets/d/1osHofMaYvKOr1dlYyfFlXz7JadkH5WEGwnx2SrxGDVU/export?format=csv&gid=328967725";
  CSV_TEXT = "";
  SWAP_CLUES = false;

  startGame();
});

document
  .getElementById("newGame")
  .addEventListener("click", () => location.reload());
document.getElementById("toggle-csv-inputs").addEventListener("click", () => {
  document.getElementById("csv-inputs").classList.toggle("hidden");
});

async function fetchWordPairsFromUrl(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = text.trim().split("\n").slice(1);
  return rows
    .map((r) => {
      const [clue, answer] = r
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.replace(/^"(.*)"$/, "$1").trim());
      return { answer, clue };
    })
    .filter((p) => p.clue && p.answer);
}

function preparePuzzle(pairs, count = 10) {
  pairs = pairs.sort(() => Math.random() - 0.5);
  const chosen = pairs.slice(0, count);
  return chosen.map(({ clue, answer }) => {
    return SWAP_CLUES && Math.random() < 0.5
      ? { clue: answer, answer: clue.toUpperCase() }
      : { clue: clue, answer: answer.toUpperCase() };
  });
}

function renderGrid(rows, cols, entries) {
  const container = document.getElementById("crossword-container");
  container.querySelector(".loader").classList.add("hidden");
  const table = document.createElement("div");
  table.className = "table";
  cells = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cells[r][c] = cell;
      row.appendChild(cell);
    }
    table.appendChild(row);
  }

  entries.forEach((entry) => {
    const { startx, starty, position, orientation, answer } = entry;
    const dx = orientation === "across" ? 1 : 0;
    const dy = orientation === "down" ? 1 : 0;

    for (let i = 0; i < answer.length; i++) {
      const r = starty - 1 + dy * i;
      const c = startx - 1 + dx * i;
      const cell = cells[r][c];
      cell.classList.add("editable");
      const input = document.createElement("input");
      input.autocomplete = "off";
      input.maxLength = 1;
      cell.querySelector("input")?.remove();
      cell.appendChild(input);
      cell.dataset.entries =
        (cell.dataset.entries || "") + `${position}-${orientation},`;
    }

    const r0 = starty - 1,
      c0 = startx - 1;
    const div = document.createElement("div");
    div.className = "cluenum";
    div.textContent = position;
    cells[r0][c0].appendChild(div);
  });

  container.appendChild(table);
}

function renderClues(entries) {
  const container = document.getElementById("clues");
  const across = entries.filter((e) => e.orientation === "across");
  const down = entries.filter((e) => e.orientation === "down");
  container.innerHTML = `
        <h3>Across</h3><ul>${across
          .map(
            (e) => `
          <li data-pos="${e.position}" data-orient="across">
            ${e.position}. ${e.clue}
            <button class="reveal-letter" data-pos="${e.position}" data-orient="across">Reveal Letter</button>
          </li>`
          )
          .join("")}</ul>
        <h3>Down</h3><ul>${down
          .map(
            (e) => `
          <li data-pos="${e.position}" data-orient="down">
            ${e.position}. ${e.clue}
            <button class="reveal-letter" data-pos="${e.position}" data-orient="down">Reveal Letter</button>
          </li>`
          )
          .join("")}</ul>
      `;

  document.querySelectorAll(".reveal-letter").forEach((button) => {
    button.addEventListener("click", () => {
      if (confirm("Reveal the selected letter?")) {
        const focusedCell = document.querySelector(".cell.focus");
        if (!focusedCell) {
          alert("No letter is currently focused.");
          return;
        }
        const pos = button.dataset.pos;
        const orient = button.dataset.orient;
        const entry = entries.find(
          (e) => e.position == pos && e.orientation === orient
        );
        if (!entry) return;

        const entryCells = getEntryCells(entry);
        const index = entryCells.indexOf(focusedCell);
        if (index === -1) {
          alert("Focused letter is not part of this clue.");
          return;
        }
        const cell = entryCells[index];
        const input = cell.querySelector("input");
        if (!input.classList.contains("revealed")) {
          input.value = entry.answer[index];
          cell.classList.add("revealed");
          cell.classList.add("filled");
          cell.classList.remove("active");
        }
        moveNext(cell);
        checkAllEntries();
      }
    });
  });

  document.querySelectorAll("#clues li").forEach((li) => {
    li.addEventListener("click", (e) => {
      const pos = li.dataset.pos;
      const orient = li.dataset.orient;
      const entry = entries.find(
        (e) => e.position == pos && e.orientation === orient
      );
      if (entry) {
        document.querySelector(".cell.focus")?.classList?.remove("focus");
        highlightEntry(entry);
      }
    });
  });
}

function getEntryCells(entry) {
  const dx = entry.orientation === "across" ? 1 : 0;
  const dy = entry.orientation === "down" ? 1 : 0;
  return Array.from({ length: entry.answer.length }, (_, i) => {
    const r = entry.starty - 1 + dy * i;
    const c = entry.startx - 1 + dx * i;
    return cells[r][c];
  });
}

function highlightEntry(entry) {
  document
    .querySelectorAll(".cell")
    .forEach((cell) => cell.classList.remove("highlight", "active"));
  document
    .querySelectorAll("#clues li")
    .forEach((li) => li.classList.remove("highlight"));
  getEntryCells(entry).forEach((cell) => cell.classList.add("highlight"));
  const li = document.querySelector(
    `#clues li[data-pos='${entry.position}'][data-orient='${entry.orientation}']`
  );
  if (li) li.classList.add("highlight");
}

function enableInputHandlers() {
  cells.flat().forEach((cell) => {
    if (!cell.classList.contains("editable")) return;

    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      const options = (cell.dataset.entries || "")
        .split(",")
        .filter(Boolean)
        .map((id) => {
          const [pos, orient] = id.split("-");
          return entries.find(
            (e) => e.position == pos && e.orientation === orient
          );
        });
      if (selectedEntry && options.includes(selectedEntry)) {
        const alt = options.find((e) => e !== selectedEntry);
        selectedEntry = alt || selectedEntry;
      } else {
        selectedEntry =
          options.find((e) => e.orientation === "across") || options[0];
      }
      if (cell.classList.contains("filled")) {
        document.querySelector(".cell.focus")?.classList?.remove("focus");
      }
      highlightEntry(selectedEntry);
    });

    const input = cell.querySelector("input");
    input.addEventListener("input", (e) => {
      input.value = e.data.toUpperCase();
      moveNext(cell);
      checkAllEntries();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        input.placeholder = "";
        movePrev(cell);
        e.preventDefault();
      }
    });

    input.addEventListener("focus", (e) => {
      document
        .querySelectorAll(".cell")
        .forEach((c) => c.classList.remove("focus"));
      cell.classList.add("focus");
      input.placeholder = input.value;
      input.value = "";
    });

    input.addEventListener("blur", (e) => {
      if (input.value === "") {
        input.value = input.placeholder;
        input.placeholder = "";
      }
    });
  });
}

function moveNext(currentTd) {
  if (!selectedEntry) return;
  currentTd.querySelector("input").blur();
  const cellsInEntry = getEntryCells(selectedEntry);
  const index = cellsInEntry.indexOf(currentTd);
  for (let i = index + 1; i < cellsInEntry.length; i++) {
    if (!cellsInEntry[i].classList.contains("filled")) {
      cellsInEntry[i].querySelector("input").focus();
      return;
    }
  }
}

function movePrev(currentTd) {
  if (!selectedEntry) return;
  const cellsInEntry = getEntryCells(selectedEntry);
  const index = cellsInEntry.indexOf(currentTd);
  for (let i = index - 1; i >= 0; i--) {
    if (!cellsInEntry[i].classList.contains("filled")) {
      cellsInEntry[i].querySelector("input").focus();
      return;
    }
  }
}

function checkAllEntries() {
  let allDone = true;
  entries.forEach((entry) => {
    const word = getEntryCells(entry)
      .map((cell) => {
        const val =
          cell.querySelector("input").value ||
          cell.querySelector("input").placeholder;
        return val ? val.toUpperCase() : " ";
      })
      .join("");

    if (word === entry.answer) {
      getEntryCells(entry).forEach((cell) => {
        cell.classList.add("filled");
        cell.classList.remove("active");
        cell.querySelector("input").blur();
      });
      const li = document.querySelector(
        `li[data-pos="${entry.position}"][data-orient="${entry.orientation}"]`
      );
      if (li) li.classList.add("strike");
    } else {
      allDone = false;
    }
  });

  if (allDone) {
    setTimeout(() => {
      alert("You win!");
      document.getElementById("newGame").classList.remove("hidden");
    }, 100);
  }
}

async function startGame() {
  document.getElementById("csv-inputs").classList.add("hidden");
  var container = document.getElementById("crossword-container");
  container.classList.remove("hidden");
  container.querySelector(".loader").classList.remove("hidden");
  container.querySelector(".table")?.remove();
  let wordPairs = [];
  if (CSV_TEXT) wordPairs = parseCSV(CSV_TEXT);
  else if (CSV_URL) wordPairs = await fetchWordPairsFromUrl(CSV_URL);
  else {
    alert("Please provide a CSV file or URL.");
    window.location.reload();
    return;
  }

  document.getElementById("loaded-message").classList.remove("hidden");

  const puzzleData = preparePuzzle(wordPairs, 10);
  const layout = generateLayout(puzzleData);
  entries = layout.result.filter((e) => e.orientation !== "none");

  renderGrid(layout.rows, layout.cols, entries);
  renderClues(entries);
  enableInputHandlers();
}

if (CSV_URL || CSV_TEXT) startGame();
