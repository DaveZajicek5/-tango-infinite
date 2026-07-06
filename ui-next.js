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

  let boardWrap, cover, puzzle, state = [], started = false, solved = false;
  let startedAt = null, solvedAt = null, tick = null, hintMark = null, hintCount = 0;

  function injectStyle() {
    if (!timerEl) {
      timerEl = document.createElement('span');
      timerEl.id = 'timer';
      timerEl.className = 'timer';
      timerEl.textContent = '0:00';
      document.querySelector('header')?.appendChild(timerEl);
    }
    boardWrap = boardEl.closest('.boardWrap') || boardEl.parentElement;
    if (boardWrap && getComputedStyle(boardWrap).position === 'static') boardWrap.style.position = 'relative';
    const style = document.createElement('style');
    style.textContent = `
      #timer.timer{display:inline-flex!important;align-items:center;justify-content:center;min-width:64px;font-variant-numeric:tabular-nums;font-size:18px;font-weight:800;background:#111827;color:#fff;border-radius:999px;padding:8px 12px;margin-left:8px;z-index:20}
      .startCover{position:absolute;inset:-8px;z-index:30;border-radius:22px;background:rgba(247,245,239,.97);display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}.startCover.hidden{display:none}.startBox{max-width:292px}.startTitle{font-size:25px;font-weight:850;margin-bottom:8px}.startText{font-size:15px;line-height:1.35;color:#6b6f76;margin-bottom:14px}.startBtn{border:0;border-radius:16px;padding:15px 26px;font-size:17px;font-weight:850;background:#111827;color:#fff}
      .focusCell{background:#faf6e8!important}.supportCell{background:#fff3af!important}.hintCell{background:#dbeafe!important;outline:4px solid #60a5fa;outline-offset:-6px}.wrong{outline:4px solid rgba(217,48,37,.68)!important;outline-offset:-6px}.hintGhost{opacity:.38;filter:saturate(.9)}.finished{cursor:default}
    `;
    document.head.appendChild(style);
  }

  function token(v, ghost = false) {
    if (v == null) return '';
    return `<span class="token ${v === SUN ? 'sun' : 'moon'}${ghost ? ' hintGhost' : ''}"></span>`;
  }
  function show(t, cls = '') { msg.textContent = t; msg.className = cls; }
  function fmt(ms) { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function elapsed() { return startedAt ? (solvedAt || Date.now()) - startedAt : 0; }
  function paintTimer() { timerEl.textContent = fmt(elapsed()); }
  function startTimer() { clearInterval(tick); tick = setInterval(paintTimer, 250); paintTimer(); }
  function stopTimer() { clearInterval(tick); tick = null; paintTimer(); }
  function cellRow(i) { return Math.floor(i / N); }
  function cellCol(i) { return i % N; }
  function sameRow(cells) { return cells.length > 1 && cells.every(c => cellRow(c) === cellRow(cells[0])); }
  function sameCol(cells) { return cells.length > 1 && cells.every(c => cellCol(c) === cellCol(cells[0])); }
  function lineCellsFromStep(step) {
    const cells = [step.cell, ...(step.support || [])];
    if (sameRow(cells)) return E.lineCells(true, cellRow(step.cell));
    if (sameCol(cells)) return E.lineCells(false, cellCol(step.cell));
    return cells;
  }

  function save() {
    try { localStorage.setItem('tangoSaveV11', JSON.stringify({ puzzle, state, started, solved, startedAt, solvedAt, hintCount })); } catch (_) {}
  }

  function render() {
    boardEl.innerHTML = '';
    const focus = hintMark?.focus || [];
    for (let r = 0; r < N; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < N; c++) {
        const i = E.cellIndex(r, c);
        const td = document.createElement('td');
        td.dataset.i = String(i);
        if (puzzle.givens[i] != null) td.classList.add('locked');
        if (solved) td.classList.add('finished');
        if (focus.includes(i)) td.classList.add('focusCell');
        if (hintMark?.support?.includes(i)) td.classList.add('supportCell');
        if (hintMark?.cell === i) td.classList.add('hintCell');
        td.innerHTML = hintMark?.cell === i && state[i] == null ? token(hintMark.value, true) : token(state[i]);
        td.addEventListener('click', () => tap(i));
        for (const sign of puzzle.signs) {
          if (sign.r === r && sign.c === c) {
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
    hintBtn.disabled = solved || !started;
    checkBtn.disabled = solved || !started;
    resetBtn.disabled = !puzzle;
    save();
  }

  function clearHints() { hintMark = null; hintBtn.textContent = 'Nápověda'; }
  function clearPaint() { boardEl.querySelectorAll('.wrong,.hintCell,.supportCell,.focusCell').forEach(e => e.classList.remove('wrong', 'hintCell', 'supportCell', 'focusCell')); }
  function mark(cells, cls) { for (const i of cells || []) boardEl.querySelector(`[data-i="${i}"]`)?.classList.add(cls); }

  function stepKind(step) {
    const s = (step.reason || '').toLowerCase();
    if (s.includes('započtení') || s.includes('vychází') || s.includes('variant') || s.includes('tvar')) return 'line';
    if (s.includes('znak') || s.includes('=') || s.includes('×')) return 'relation';
    if (s.includes('dvě') || s.includes('troj') || s.includes('tři stej')) return 'triple';
    if (s.includes('tři slunce') || s.includes('tři měsíce') || s.includes('přesně')) return 'balance';
    return 'basic';
  }

  function symbol(v) { return v === SUN ? '☀' : '☾'; }
  function opposite(v) { return v === SUN ? MOON : SUN; }
  function patternText(pattern, pos) { return pattern.split('').map((v, i) => i === pos ? `[${symbol(v)}]` : symbol(v)).join(' '); }
  function lineName(isRow, n) { return isRow ? `řádku ${n + 1}` : `sloupci ${'ABCDEF'[n]}`; }

  function forcedLineInfo(step) {
    const out = [];
    for (const isRow of [true, false]) {
      const line = isRow ? cellRow(step.cell) : cellCol(step.cell);
      const cells = E.lineCells(isRow, line);
      const pos = cells.indexOf(step.cell);
      const candidates = E.lineCandidates(state, isRow, line, puzzle.signs);
      if (candidates.length && candidates.every(p => p[pos] === step.value)) out.push({ isRow, line, cells, pos, candidates });
    }
    if (!out.length) return null;
    out.sort((a, b) => a.candidates.length - b.candidates.length);
    return out[0];
  }

  function concreteLineHint(step) {
    const info = forcedLineInfo(step);
    if (!info) return 'V naznačené linii zkus platné doplnění. Modré pole vychází stejně ve všech možnostech.';
    const shown = info.candidates.slice(0, 3).map(p => patternText(p, info.pos)).join(' / ');
    const more = info.candidates.length > 3 ? ` / … (${info.candidates.length} možností celkem)` : '';
    const good = symbol(step.value), bad = symbol(opposite(step.value));
    if (info.candidates.length === 1) return `V ${lineName(info.isRow, info.line)} zbývá jediný platný tvar: ${shown}. V modrém místě je ${good}; ${bad} by nedal žádné platné doplnění.`;
    return `V ${lineName(info.isRow, info.line)} zbývají jen tyto tvary: ${shown}${more}. V každém je na modrém místě ${good}; ${bad} by nedal žádné platné doplnění.`;
  }

  function hintText(step) {
    switch (stepKind(step)) {
      case 'relation': return 'Znak mezi žlutým a modrým polem určuje vztah: = stejné, × opačné. Proto do modrého pole patří slabě zobrazený symbol.';
      case 'triple': return 'Druhá možnost by vytvořila tři stejné symboly za sebou. Proto do modrého pole patří slabě zobrazený symbol.';
      case 'balance': return 'V naznačené linii už je dosažen limit jednoho symbolu. Zbývající prázdná pole musí být opačný symbol.';
      case 'line': return concreteLineHint(step);
      default: return step.reason || 'Do modrého pole patří slabě zobrazený symbol.';
    }
  }

  function showViolation() {
    boardEl.querySelectorAll('.wrong').forEach(e => e.classList.remove('wrong'));
    const bad = S.immediateViolation(state, puzzle.signs);
    if (!bad) return false;
    mark(bad.cells, 'wrong'); show(bad.text, 'bad'); return true;
  }

  function finishIfSolved() {
    if (solved || state.join('') !== puzzle.sol || !S.completeAndLegal(state, puzzle.signs)) return;
    solved = true; started = false; solvedAt = Date.now(); clearHints(); stopTimer(); hideCover(); render();
    let best = Number(localStorage.getItem('tangoBestMs') || 0);
    const clean = hintCount === 0;
    const isBest = clean && (!best || elapsed() < best);
    if (isBest) localStorage.setItem('tangoBestMs', String(elapsed()));
    localStorage.setItem('tangoSolvedCount', String(Number(localStorage.getItem('tangoSolvedCount') || 0) + 1));
    show(`Vyřešeno za ${fmt(elapsed())}${hintCount ? ` · nápovědy: ${hintCount}` : ' · bez nápovědy'}${isBest ? ' · nový nejlepší čas' : ''} 🎉`, 'good');
  }

  function tap(i) {
    if (!started || solved || puzzle.givens[i] != null) return;
    state[i] = state[i] == null ? SUN : state[i] === SUN ? MOON : null;
    clearHints(); clearPaint(); render();
    if (!showViolation()) show('');
    finishIfSolved();
  }

  function showCover() {
    if (!boardWrap) return;
    cover?.remove();
    cover = document.createElement('div'); cover.className = 'startCover';
    const best = Number(localStorage.getItem('tangoBestMs') || 0);
    cover.innerHTML = `<div class="startBox"><div class="startTitle">Hra připravena</div><div class="startText">Zadání je zakryté. Čas začne až po startu.${best ? `<br>Nejlepší čistý čas: ${fmt(best)}` : ''}</div><button class="startBtn" type="button">Start</button></div>`;
    cover.querySelector('button').addEventListener('click', startGame);
    boardWrap.appendChild(cover);
  }
  function hideCover() { cover?.classList.add('hidden'); }

  function newGame() {
    newBtn.disabled = true; hintBtn.disabled = true; checkBtn.disabled = true;
    stopTimer(); timerEl.textContent = '0:00'; show('Generuju novou hru…');
    setTimeout(() => {
      puzzle = E.generatePuzzle(); state = puzzle.givens.slice(); started = false; solved = false; startedAt = null; solvedAt = null; hintCount = 0; clearHints(); render(); showCover();
      show(`Připraveno. ${puzzle.clues} indicií.`); newBtn.disabled = false;
    }, 20);
  }

  function startGame() { if (!puzzle || solved) return; started = true; startedAt = Date.now(); solvedAt = null; hideCover(); startTimer(); render(); show(''); }
  function resetGame() { if (!puzzle) return; state = puzzle.givens.slice(); started = false; solved = false; startedAt = null; solvedAt = null; hintCount = 0; clearHints(); stopTimer(); timerEl.textContent = '0:00'; render(); showCover(); show('Resetováno. Čas začne až po Start.'); }

  function checkGame() {
    if (!started || solved) return;
    clearPaint(); if (showViolation()) return;
    const missing = state.some(v => v == null);
    const wrong = state.filter((v, i) => v != null && v !== puzzle.sol[i]).length;
    if (wrong) show(`${wrong} polí je legálních, ale nevede k finálnímu řešení.`, 'bad');
    else if (missing) show('Zatím bez zjevného porušení pravidel, ale není hotovo.');
    else finishIfSolved();
  }

  function hint() {
    if (!started || solved) return;
    clearPaint();
    const step = S.logicalStep(state, puzzle);
    if (!step) { clearHints(); render(); show('Nevidím jednoduchý krok. Některý legální tah může vést mimo řešení.', 'bad'); return; }
    if (step.type === 'conflict') { hintMark = { support: step.cells || [], focus: step.cells || [] }; render(); mark(step.cells, 'wrong'); show(step.text, 'bad'); return; }
    hintCount++;
    hintMark = { cell: step.cell, value: step.value, support: step.support || [], focus: lineCellsFromStep(step) };
    render(); show(hintText(step));
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('tangoSaveV11') || localStorage.getItem('tangoSaveV10') || localStorage.getItem('tangoSaveV9') || localStorage.getItem('tangoSaveV8') || localStorage.getItem('tangoSaveV7') || 'null');
      if (!saved?.puzzle || !saved?.state) return false;
      puzzle = saved.puzzle; state = saved.state; started = !!saved.started && !saved.solved; solved = !!saved.solved; startedAt = saved.startedAt || null; solvedAt = saved.solvedAt || null; hintCount = saved.hintCount || 0; clearHints(); render();
      if (solved) { stopTimer(); show(`Obnoveno vyřešené za ${fmt(elapsed())}.`); }
      else if (started) { hideCover(); startTimer(); show(''); }
      else { stopTimer(); timerEl.textContent = '0:00'; showCover(); show(`Připraveno. ${puzzle.clues} indicií.`); }
      return true;
    } catch (_) { return false; }
  }

  injectStyle();
  newBtn.addEventListener('click', newGame);
  resetBtn.addEventListener('click', resetGame);
  checkBtn.addEventListener('click', checkGame);
  hintBtn.addEventListener('click', hint);
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  if (!load()) newGame();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
