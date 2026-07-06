(() => {
  'use strict';

  const E = window.TangoEngine;
  const S = window.TangoSolver;
  const { N, SUN, MOON } = E;

  const boardEl = document.getElementById('board');
  const msg = document.getElementById('msg');
  const timerEl = document.getElementById('timer');
  const newBtn = document.getElementById('new');
  const hintBtn = document.getElementById('hint');
  const resetBtn = document.getElementById('reset');
  const checkBtn = document.getElementById('check');

  let puzzle = null;
  let state = [];
  let solved = false;
  let startedAt = null;
  let solvedAt = null;
  let tick = null;
  let lastHint = null;

  function token(value) {
    if (value == null) return '';
    return `<span class="token ${value === SUN ? 'sun' : 'moon'}"></span>`;
  }

  function show(text, cls = '') {
    msg.textContent = text;
    msg.className = cls;
  }

  function elapsed() {
    if (!startedAt) return 0;
    return (solvedAt || Date.now()) - startedAt;
  }

  function format(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function paintTimer() {
    timerEl.textContent = format(elapsed());
  }

  function startTimer() {
    if (tick) clearInterval(tick);
    tick = setInterval(paintTimer, 250);
    paintTimer();
  }

  function stopTimer() {
    if (tick) clearInterval(tick);
    tick = null;
    paintTimer();
  }

  function save() {
    try {
      localStorage.setItem('tangoSaveV3', JSON.stringify({ puzzle, state, solved, startedAt, solvedAt }));
    } catch (_) {}
  }

  function render() {
    boardEl.innerHTML = '';

    for (let row = 0; row < N; row++) {
      const tr = document.createElement('tr');

      for (let col = 0; col < N; col++) {
        const cell = E.cellIndex(row, col);
        const td = document.createElement('td');
        td.dataset.i = String(cell);

        if (puzzle.givens[cell] != null) td.classList.add('locked');
        if (solved) td.classList.add('finished');
        if (lastHint && lastHint.cell === cell) td.classList.add('hintCell');
        if (lastHint && lastHint.support && lastHint.support.includes(cell)) td.classList.add('supportCell');

        td.innerHTML = token(state[cell]);
        td.addEventListener('click', () => tap(cell));

        for (const sign of puzzle.signs) {
          if (sign.r === row && sign.c === col) {
            const sp = document.createElement('span');
            sp.className = 'sg ' + (sign.d === 'h' ? 'r' : 'b');
            sp.textContent = sign.same ? '=' : '×';
            td.appendChild(sp);
          }
        }

        tr.appendChild(td);
      }

      boardEl.appendChild(tr);
    }

    save();
  }

  function clearMarks() {
    boardEl.querySelectorAll('.wrong,.hintCell,.supportCell').forEach(el => {
      el.classList.remove('wrong', 'hintCell', 'supportCell');
    });
  }

  function markCells(cells, cls) {
    for (const cell of cells || []) {
      const el = boardEl.querySelector(`[data-i="${cell}"]`);
      if (el) el.classList.add(cls);
    }
  }

  function markImmediateViolation() {
    boardEl.querySelectorAll('.wrong').forEach(el => el.classList.remove('wrong'));
    const bad = S.immediateViolation(state, puzzle.signs);

    if (bad) {
      markCells(bad.cells, 'wrong');
      show(bad.text, 'bad');
      return true;
    }

    return false;
  }

  function finishIfSolved() {
    if (solved) return;

    if (state.join('') === puzzle.sol && S.completeAndLegal(state, puzzle.signs)) {
      solved = true;
      solvedAt = Date.now();
      lastHint = null;
      stopTimer();
      render();
      show(`Vyřešeno za ${format(elapsed())} 🎉 Pole jsou zamčená.`, 'good');
    }
  }

  function tap(cell) {
    if (solved || puzzle.givens[cell] != null) return;

    state[cell] = state[cell] == null ? SUN : state[cell] === SUN ? MOON : null;
    lastHint = null;
    clearMarks();
    render();

    if (!markImmediateViolation()) show('');
    finishIfSolved();
  }

  function newGame() {
    newBtn.disabled = true;
    hintBtn.disabled = true;
    show('Generuju lidsky řešitelnou mřížku…');

    setTimeout(() => {
      puzzle = E.generatePuzzle();
      state = puzzle.givens.slice();
      solved = false;
      startedAt = Date.now();
      solvedAt = null;
      lastHint = null;
      render();
      startTimer();
      show(`Hotovo. ${puzzle.clues} indicií, jediné řešení, ověřeno lidským solverem.`);
      newBtn.disabled = false;
      hintBtn.disabled = false;
    }, 20);
  }

  function resetGame() {
    if (!puzzle) return;
    state = puzzle.givens.slice();
    solved = false;
    startedAt = Date.now();
    solvedAt = null;
    lastHint = null;
    clearMarks();
    render();
    startTimer();
    show('Resetováno. Čas běží znovu.');
  }

  function checkGame() {
    clearMarks();
    if (markImmediateViolation()) return;

    let complete = true;
    let wrong = 0;

    for (let i = 0; i < N * N; i++) {
      if (state[i] == null) complete = false;
      else if (state[i] !== puzzle.sol[i]) wrong++;
    }

    if (wrong) {
      show(`${wrong} polí nesedí s finálním řešením. Automaticky červeně značím jen tahy, které už teď porušují pravidla.`, 'bad');
    } else if (!complete) {
      show('Zatím bez zjevného porušení pravidel, ale není hotovo.');
    } else {
      finishIfSolved();
    }
  }

  function hint() {
    if (solved) return;
    clearMarks();

    const step = S.logicalStep(state, puzzle);

    if (!step) {
      lastHint = null;
      render();
      show('Nevidím jednoduchý odvoditelný krok z aktuální pozice. Některý předchozí tah může být legální, ale mimo řešení.', 'bad');
      return;
    }

    if (step.type === 'conflict') {
      lastHint = { support: step.cells || [] };
      render();
      markCells(step.cells, 'wrong');
      show(step.text, 'bad');
      return;
    }

    state[step.cell] = step.value;
    lastHint = { cell: step.cell, support: step.support || [] };
    render();
    show(`${S.cellName(step.cell)} = ${S.typeName(step.value)}. ${step.reason}`);
    finishIfSolved();
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('tangoSaveV3') || 'null');
      if (!saved || !saved.puzzle || !saved.state) return false;

      puzzle = saved.puzzle;
      state = saved.state;
      solved = !!saved.solved;
      startedAt = saved.startedAt || Date.now();
      solvedAt = saved.solvedAt || null;
      lastHint = null;
      render();
      solved ? stopTimer() : startTimer();
      show(solved ? `Obnoveno vyřešené za ${format(elapsed())}.` : 'Obnoveno z minula.');
      return true;
    } catch (_) {
      return false;
    }
  }

  newBtn.addEventListener('click', newGame);
  resetBtn.addEventListener('click', resetGame);
  checkBtn.addEventListener('click', checkGame);
  hintBtn.addEventListener('click', hint);
  document.addEventListener('dblclick', event => event.preventDefault(), { passive: false });

  if (!load()) newGame();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
