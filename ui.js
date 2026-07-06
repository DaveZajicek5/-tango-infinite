(() => {
  'use strict';

  const E = window.TangoEngine;
  const S = window.TangoSolver;
  const { N, SUN, MOON } = E;

  const boardEl = document.getElementById('board');
  const msg = document.getElementById('msg');
  const newBtn = document.getElementById('new');
  const hintBtn = document.getElementById('hint');
  const resetBtn = document.getElementById('reset');
  const checkBtn = document.getElementById('check');

  let timerEl = document.getElementById('timer');
  let startCover = null;
  let boardWrap = null;

  let puzzle = null;
  let state = [];
  let solved = false;
  let gameStarted = false;
  let startedAt = null;
  let solvedAt = null;
  let tick = null;
  let lastHint = null;

  function ensureExtraUi() {
    if (!timerEl) {
      timerEl = document.createElement('span');
      timerEl.id = 'timer';
      timerEl.className = 'timer';
      timerEl.textContent = '0:00';
      const header = document.querySelector('header');
      if (header) header.appendChild(timerEl);
    }

    boardWrap = boardEl.closest('.boardWrap') || boardEl.parentElement;
    if (boardWrap && getComputedStyle(boardWrap).position === 'static') boardWrap.style.position = 'relative';

    const style = document.createElement('style');
    style.textContent = `
      #timer.timer{display:inline-flex!important;align-items:center;justify-content:center;min-width:64px;font-variant-numeric:tabular-nums;font-size:18px;font-weight:800;background:#111827;color:#fff;border-radius:999px;padding:8px 12px;margin-left:8px;z-index:20}
      .startCover{position:absolute;inset:-8px;z-index:30;border-radius:22px;background:rgba(247,245,239,.96);display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
      .startCover.hidden{display:none}
      .startBox{max-width:290px}.startTitle{font-size:24px;font-weight:850;margin-bottom:8px}.startText{font-size:15px;line-height:1.35;color:#6b6f76;margin-bottom:14px}.startBtn{border:0;border-radius:16px;padding:15px 24px;font-size:17px;font-weight:800;background:#111827;color:white}.hintCell{background:#dbeafe!important;outline:4px solid #60a5fa;outline-offset:-6px}.supportCell{background:#fff7cc!important}.finished{cursor:default}.wrong{outline:4px solid rgba(217,48,37,.65)!important;outline-offset:-6px}`;
    document.head.appendChild(style);
  }

  function createStartCover() {
    if (!boardWrap) return;
    if (startCover) startCover.remove();
    startCover = document.createElement('div');
    startCover.className = 'startCover';
    startCover.innerHTML = '<div class="startBox"><div class="startTitle">Hra připravena</div><div class="startText">Mřížka je už vygenerovaná, ale zakrytá. Čas začne běžet až po startu.</div><button class="startBtn" type="button">Start</button></div>';
    startCover.querySelector('button').addEventListener('click', startGame);
    boardWrap.appendChild(startCover);
  }

  function showStartCover() {
    createStartCover();
    if (startCover) startCover.classList.remove('hidden');
  }

  function hideStartCover() {
    if (startCover) startCover.classList.add('hidden');
  }

  function setButtonState() {
    hintBtn.disabled = solved || !gameStarted;
    checkBtn.disabled = solved || !gameStarted;
    resetBtn.disabled = !puzzle;
  }

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
      localStorage.setItem('tangoSaveV6', JSON.stringify({ puzzle, state, solved, gameStarted, startedAt, solvedAt }));
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
    setButtonState();
    save();
  }

  function clearMarks() {
    boardEl.querySelectorAll('.wrong,.hintCell,.supportCell').forEach(el => el.classList.remove('wrong', 'hintCell', 'supportCell'));
  }

  function clearHint() {
    lastHint = null;
    hintBtn.textContent = 'Nápověda';
  }

  function markCells(cells, cls) {
    for (const cell of cells || []) {
      const el = boardEl.querySelector(`[data-i="${cell}"]`);
      if (el) el.classList.add(cls);
    }
  }

  function hintText(step) {
    const target = S.cellName(step.cell);
    const value = S.typeName(step.value);
    const support = step.support || [];
    const supportNames = support.map(S.cellName).join(', ');
    const intro = support.length
      ? `Nejdřív se podívej na žlutá pole (${supportNames}). Modré pole ${target} je další odvoditelný tah.`
      : `Modré pole ${target} je další odvoditelný tah.`;
    return `${intro} Závěr: ${target} = ${value}. Proč: ${step.reason}`;
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
      gameStarted = false;
      solvedAt = Date.now();
      clearHint();
      stopTimer();
      hideStartCover();
      render();
      show(`Vyřešeno za ${format(elapsed())} 🎉 Pole jsou zamčená.`, 'good');
    }
  }

  function tap(cell) {
    if (!gameStarted || solved || puzzle.givens[cell] != null) return;
    state[cell] = state[cell] == null ? SUN : state[cell] === SUN ? MOON : null;
    clearHint();
    clearMarks();
    render();
    if (!markImmediateViolation()) show('');
    finishIfSolved();
  }

  function preparePuzzle(textWhenReady) {
    newBtn.disabled = true;
    hintBtn.disabled = true;
    checkBtn.disabled = true;
    show('Generuju lidsky řešitelnou mřížku…');
    stopTimer();
    timerEl.textContent = '0:00';

    setTimeout(() => {
      puzzle = E.generatePuzzle();
      state = puzzle.givens.slice();
      solved = false;
      gameStarted = false;
      startedAt = null;
      solvedAt = null;
      clearHint();
      render();
      showStartCover();
      show(textWhenReady || `Připraveno. ${puzzle.clues} indicií, jediné řešení, ověřeno lidským solverem.`);
      newBtn.disabled = false;
      setButtonState();
    }, 20);
  }

  function startGame() {
    if (!puzzle || solved) return;
    gameStarted = true;
    startedAt = Date.now();
    solvedAt = null;
    hideStartCover();
    startTimer();
    setButtonState();
    show('');
    save();
  }

  function resetGame() {
    if (!puzzle) return;
    state = puzzle.givens.slice();
    solved = false;
    gameStarted = false;
    startedAt = null;
    solvedAt = null;
    clearHint();
    stopTimer();
    timerEl.textContent = '0:00';
    clearMarks();
    render();
    showStartCover();
    show('Resetováno. Čas začne až po Start.');
  }

  function checkGame() {
    if (!gameStarted || solved) return;
    clearMarks();
    if (markImmediateViolation()) return;

    let complete = true;
    let wrong = 0;
    for (let i = 0; i < N * N; i++) {
      if (state[i] == null) complete = false;
      else if (state[i] !== puzzle.sol[i]) wrong++;
    }

    if (wrong) show(`${wrong} polí nesedí s finálním řešením. Automaticky červeně značím jen tahy, které už teď porušují pravidla.`, 'bad');
    else if (!complete) show('Zatím bez zjevného porušení pravidel, ale není hotovo.');
    else finishIfSolved();
  }

  function hint() {
    if (!gameStarted || solved) return;
    clearMarks();
    const step = S.logicalStep(state, puzzle);

    if (!step) {
      clearHint();
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

    lastHint = { cell: step.cell, support: step.support || [], value: step.value };
    render();
    hintBtn.textContent = 'Nápověda';
    show(hintText(step));
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('tangoSaveV6') || localStorage.getItem('tangoSaveV5') || localStorage.getItem('tangoSaveV4') || 'null');
      if (!saved || !saved.puzzle || !saved.state) return false;
      puzzle = saved.puzzle;
      state = saved.state;
      solved = !!saved.solved;
      gameStarted = !!saved.gameStarted && !solved;
      startedAt = saved.startedAt || null;
      solvedAt = saved.solvedAt || null;
      clearHint();
      render();
      if (solved) {
        stopTimer();
        hideStartCover();
        show(`Obnoveno vyřešené za ${format(elapsed())}.`);
      } else if (gameStarted) {
        hideStartCover();
        startTimer();
        show('Obnoveno z minula.');
      } else {
        stopTimer();
        timerEl.textContent = '0:00';
        showStartCover();
        show('Připraveno. Čas začne až po Start.');
      }
      setButtonState();
      return true;
    } catch (_) {
      return false;
    }
  }

  ensureExtraUi();
  newBtn.addEventListener('click', () => preparePuzzle());
  resetBtn.addEventListener('click', resetGame);
  checkBtn.addEventListener('click', checkGame);
  hintBtn.addEventListener('click', hint);
  document.addEventListener('dblclick', event => event.preventDefault(), { passive: false });

  if (!load()) preparePuzzle();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
