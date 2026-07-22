/* =========================================================
   Classic Minesweeper clone
   ========================================================= */
(function () {
  const LEVELS = {
    beginner:     { rows: 9,  cols: 9,  mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert:       { rows: 16, cols: 30, mines: 99 },
  };

  const gridEl = document.getElementById('ms-grid');
  const mineCountEl = document.getElementById('ms-mine-count');
  const timerEl = document.getElementById('ms-timer');
  const smileyEl = document.getElementById('ms-smiley');
  const statusEl = document.getElementById('ms-status');
  const diffButtons = document.querySelectorAll('.ms-difficulty [data-level]');

  let level = LEVELS.beginner;
  let levelName = 'beginner';
  let cells = [];       // flat array of cell state objects
  let rows, cols, mineTotal;
  let flagCount = 0;
  let revealedCount = 0;
  let firstClickDone = false;
  let gameOver = false;
  let timerInterval = null;
  let seconds = 0;

  const FACES = { normal: '\u{1F642}', nervous: '\u{1F62E}', win: '\u{1F60E}', lose: '\u{1F635}' };

  function idx(r, c) { return r * cols + c; }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(idx(nr, nc));
      }
    }
    return out;
  }

  function setLevel(name) {
    levelName = name;
    level = LEVELS[name];
    diffButtons.forEach(b => b.classList.toggle('active', b.dataset.level === name));
    buildBoard();
  }

  function buildBoard() {
    rows = level.rows;
    cols = level.cols;
    mineTotal = level.mines;
    flagCount = 0;
    revealedCount = 0;
    firstClickDone = false;
    gameOver = false;
    seconds = 0;
    stopTimer();
    updateTimerDisplay();
    updateMineCounter();
    setFace('normal');

    cells = new Array(rows * cols).fill(null).map(() => ({
      mine: false, revealed: false, flagged: false, questioned: false, adjacent: 0,
    }));

    gridEl.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const btn = document.createElement('button');
        btn.className = 'ms-cell';
        btn.dataset.idx = idx(r, c);
        btn.dataset.r = r;
        btn.dataset.c = c;
        btn.setAttribute('aria-label', 'hidden cell');
        frag.appendChild(btn);
      }
    }
    gridEl.appendChild(frag);
    statusEl.textContent = 'Left-click to reveal · Right-click to flag';
  }

  function placeMines(excludeIdx) {
    const excluded = new Set([excludeIdx, ...neighbors(Math.floor(excludeIdx / cols), excludeIdx % cols)]);
    let placed = 0;
    while (placed < mineTotal) {
      const r = Math.floor(Math.random() * rows * cols);
      if (excluded.has(r) || cells[r].mine) continue;
      cells[r].mine = true;
      placed++;
    }
    // compute adjacency counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(r, c);
        if (cells[i].mine) continue;
        let count = 0;
        neighbors(r, c).forEach(n => { if (cells[n].mine) count++; });
        cells[i].adjacent = count;
      }
    }
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      seconds = Math.min(999, seconds + 1);
      updateTimerDisplay();
    }, 1000);
  }
  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  function updateTimerDisplay() {
    timerEl.textContent = String(seconds).padStart(3, '0');
  }
  function updateMineCounter() {
    const remaining = mineTotal - flagCount;
    const sign = remaining < 0 ? '-' : '';
    const padded = String(Math.abs(remaining)).padStart(remaining < 0 ? 2 : 3, '0');
    mineCountEl.textContent = sign + padded;
  }
  function setFace(state) { smileyEl.textContent = FACES[state]; }

  function cellEl(i) { return gridEl.children[i]; }

  function renderCell(i) {
    const cell = cells[i];
    const el = cellEl(i);
    if (!el) return;
    el.classList.toggle('revealed', cell.revealed);
    el.classList.toggle('flagged', cell.flagged);
    el.removeAttribute('data-n');
    el.textContent = '';

    if (cell.revealed) {
      if (cell.mine) {
        el.textContent = '\u{1F4A3}';
      } else if (cell.adjacent > 0) {
        el.textContent = String(cell.adjacent);
        el.dataset.n = cell.adjacent;
      }
    } else if (cell.flagged) {
      el.textContent = '\u{1F6A9}';
    } else if (cell.questioned) {
      el.textContent = '?';
    }
  }

  function revealCell(i) {
    const cell = cells[i];
    if (cell.revealed || cell.flagged || gameOver) return;

    if (!firstClickDone) {
      placeMines(i);
      firstClickDone = true;
      startTimer();
    }

    if (cell.mine) {
      loseGame(i);
      return;
    }

    // flood fill from this cell
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop();
      const c = cells[cur];
      if (c.revealed || c.flagged) continue;
      c.revealed = true;
      revealedCount++;
      renderCell(cur);
      if (c.adjacent === 0) {
        const r = Math.floor(cur / cols), col = cur % cols;
        neighbors(r, col).forEach(n => { if (!cells[n].revealed && !cells[n].mine) stack.push(n); });
      }
    }

    checkWin();
  }

  function chordReveal(i) {
    const cell = cells[i];
    if (!cell.revealed || cell.adjacent === 0 || gameOver) return;
    const r = Math.floor(i / cols), c = i % cols;
    const ns = neighbors(r, c);
    const flagged = ns.filter(n => cells[n].flagged).length;
    if (flagged !== cell.adjacent) return;
    ns.forEach(n => { if (!cells[n].flagged) revealCell(n); });
  }

  function toggleFlag(i) {
    const cell = cells[i];
    if (cell.revealed || gameOver) return;
    if (!cell.flagged && !cell.questioned) {
      cell.flagged = true;
      flagCount++;
    } else if (cell.flagged) {
      cell.flagged = false;
      cell.questioned = true;
      flagCount--;
    } else {
      cell.questioned = false;
    }
    updateMineCounter();
    renderCell(i);
  }

  function loseGame(hitIdx) {
    gameOver = true;
    stopTimer();
    setFace('lose');
    cells.forEach((cell, i) => {
      if (cell.mine) { cell.revealed = true; renderCell(i); }
      if (i === hitIdx) cellEl(i).classList.add('mine-hit');
    });
    statusEl.textContent = 'Boom! Click the face to try again.';
  }

  function checkWin() {
    if (revealedCount === rows * cols - mineTotal) {
      gameOver = true;
      stopTimer();
      setFace('win');
      cells.forEach((cell, i) => {
        if (cell.mine && !cell.flagged) { cell.flagged = true; renderCell(i); }
      });
      flagCount = mineTotal;
      updateMineCounter();
      statusEl.textContent = 'You win! \u{1F389}';
    }
  }

  gridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.ms-cell');
    if (!btn) return;
    const i = Number(btn.dataset.idx);
    const cell = cells[i];
    if (cell.revealed) chordReveal(i);
    else revealCell(i);
  });

  gridEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const btn = e.target.closest('.ms-cell');
    if (!btn) return;
    toggleFlag(Number(btn.dataset.idx));
  });

  gridEl.addEventListener('mousedown', (e) => {
    if (gameOver) return;
    if (e.button === 0) setFace('nervous');
  });
  window.addEventListener('mouseup', () => {
    if (!gameOver) setFace('normal');
  });

  smileyEl.addEventListener('click', () => buildBoard());

  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => setLevel(btn.dataset.level));
  });

  setLevel('beginner');

  // expose for reset when window (re)opened
  window.__resetMinesweeper = buildBoard;
})();
