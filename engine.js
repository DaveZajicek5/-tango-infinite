window.TangoEngine = (() => {
  const N = 6;
  const H = 3;
  const SUN = '1';
  const MOON = '0';

  const PROFILES = [
    { id: 'quick', label: 'Rychlá', weight: 3, signMin: 10, signMax: 14, blankMin: 7, blankMax: 12, abstractMax: 0, attempts: 45 },
    { id: 'classic', label: 'Klasická', weight: 5, signMin: 7, signMax: 12, blankMin: 13, blankMax: 20, abstractMax: 1, attempts: 75 },
    { id: 'hard', label: 'Těžší', weight: 3, signMin: 5, signMax: 10, blankMin: 19, blankMax: 27, abstractMax: 3, attempts: 95 }
  ];

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function randint(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  function countSymbol(text, symbol) {
    let total = 0;
    for (const ch of text) if (ch === symbol) total++;
    return total;
  }

  function hasThreeTogether(text) {
    for (let i = 0; i < text.length - 2; i++) if (text[i] === text[i + 1] && text[i] === text[i + 2]) return true;
    return false;
  }

  function transitionCount(text) {
    let total = 0;
    for (let i = 0; i < text.length - 1; i++) if (text[i] !== text[i + 1]) total++;
    return total;
  }

  function isPureZigzag(text) { return text === '010101' || text === '101010'; }
  function isStrongZigzag(text) { return transitionCount(text) >= 4; }

  const ROWS = [];
  for (let n = 0; n < 64; n++) {
    const row = n.toString(2).padStart(6, '0');
    if (countSymbol(row, SUN) === H && !hasThreeTogether(row)) ROWS.push(row);
  }

  function cellIndex(row, col) { return row * N + col; }
  function lineCells(isRow, lineNumber) { return Array.from({ length: N }, (_, k) => isRow ? cellIndex(lineNumber, k) : cellIndex(k, lineNumber)); }
  function lineText(board, isRow, lineNumber) { return lineCells(isRow, lineNumber).map(index => board[index]).join(''); }

  function buildAllBoards() {
    const boards = [];
    function addRow(rowNumber, chosenRows, columnSunCounts) {
      if (rowNumber === N) { boards.push(chosenRows.join('')); return; }
      for (const row of ROWS) {
        let ok = true;
        const nextCounts = columnSunCounts.slice();
        for (let col = 0; col < N; col++) {
          if (row[col] === SUN) nextCounts[col]++;
          const remainingRows = N - rowNumber - 1;
          if (nextCounts[col] > H || nextCounts[col] + remainingRows < H) { ok = false; break; }
          if (rowNumber >= 2 && chosenRows[rowNumber - 1][col] === row[col] && chosenRows[rowNumber - 2][col] === row[col]) { ok = false; break; }
        }
        if (ok) addRow(rowNumber + 1, chosenRows.concat(row), nextCounts);
      }
    }
    addRow(0, [], Array(N).fill(0));
    return boards;
  }

  const ALL_BOARDS = buildAllBoards();

  function boardShapeScore(board) {
    let pureZigzags = 0;
    let strongZigzags = 0;
    for (const isRow of [true, false]) {
      for (let line = 0; line < N; line++) {
        const text = lineText(board, isRow, line);
        if (isPureZigzag(text)) pureZigzags++;
        if (isStrongZigzag(text)) strongZigzags++;
      }
    }
    return { pureZigzags, strongZigzags };
  }

  function acceptableBoardShape(board) {
    const score = boardShapeScore(board);
    return score.pureZigzags <= 1 && score.strongZigzags <= 4;
  }

  const NICE_BOARDS = ALL_BOARDS.filter(acceptableBoardShape);
  function randomSolution() { const pool = NICE_BOARDS.length ? NICE_BOARDS : ALL_BOARDS; return pool[Math.floor(Math.random() * pool.length)]; }

  function signCells(sign) { const a = cellIndex(sign.r, sign.c); return [a, sign.d === 'h' ? a + 1 : a + N]; }
  function clueFits(board, clue) { if (clue.t === 'g') return board[clue.i] === clue.v; const [a, b] = signCells(clue); return (board[a] === board[b]) === clue.same; }
  function boardFitsClues(board, clues) { return clues.every(clue => clueFits(board, clue)); }

  function countSolutions(clues, limit = 2) {
    let total = 0;
    let first = null;
    for (const board of ALL_BOARDS) {
      if (boardFitsClues(board, clues)) {
        total++;
        if (!first) first = board;
        if (total >= limit) break;
      }
    }
    return { total, first };
  }

  function allSignCluesForSolution(solution) {
    const clues = [];
    for (let row = 0; row < N; row++) for (let col = 0; col < N - 1; col++) clues.push({ t: 's', r: row, c: col, d: 'h', same: solution[cellIndex(row, col)] === solution[cellIndex(row, col + 1)] });
    for (let row = 0; row < N - 1; row++) for (let col = 0; col < N; col++) clues.push({ t: 's', r: row, c: col, d: 'v', same: solution[cellIndex(row, col)] === solution[cellIndex(row + 1, col)] });
    return clues;
  }

  function allCluesForSolution(solution) {
    const clues = [];
    for (let i = 0; i < N * N; i++) clues.push({ t: 'g', i, v: solution[i] });
    return clues.concat(allSignCluesForSolution(solution));
  }

  function cluesFromParts(givens, signs) {
    const clues = [];
    for (let i = 0; i < N * N; i++) if (givens[i] != null) clues.push({ t: 'g', i, v: givens[i] });
    return clues.concat(signs);
  }

  function puzzleFromParts(givens, signs, solution, mode = null) {
    const shape = boardShapeScore(solution);
    const givenCount = givens.filter(v => v != null).length;
    return { sol: solution, givens: givens.slice(), signs: signs.map(s => ({ ...s })), clues: givenCount + signs.length, givenCount, signCount: signs.length, human: true, shape, mode };
  }

  function puzzleFromClues(clues, solution) {
    const givens = Array(N * N).fill(null);
    const signs = [];
    for (const clue of clues) clue.t === 'g' ? givens[clue.i] = clue.v : signs.push({ t: 's', r: clue.r, c: clue.c, d: clue.d, same: clue.same });
    return puzzleFromParts(givens, signs, solution);
  }

  function uniquelySolvable(clues, solution) {
    const result = countSolutions(clues, 2);
    return result.total === 1 && result.first === solution;
  }

  function lineCandidates(state, isRow, lineNumber, signs) {
    const cells = lineCells(isRow, lineNumber);
    const candidates = [];
    patternLoop: for (const pattern of ROWS) {
      for (let position = 0; position < N; position++) {
        const value = state[cells[position]];
        if (value != null && value !== pattern[position]) continue patternLoop;
      }
      for (const sign of signs) {
        if (isRow && sign.d === 'h' && sign.r === lineNumber && (pattern[sign.c] === pattern[sign.c + 1]) !== sign.same) continue patternLoop;
        if (!isRow && sign.d === 'v' && sign.c === lineNumber && (pattern[sign.r] === pattern[sign.r + 1]) !== sign.same) continue patternLoop;
      }
      candidates.push(pattern);
    }
    return candidates;
  }

  function isAbstractReason(reason) {
    const r = (reason || '').toLowerCase();
    return r.includes('započtení') || r.includes('vychází') || r.includes('zbývají') || r.includes('variant') || r.includes('tvar') || r.includes('platné doplnění');
  }

  function solveProfile(puzzle) {
    if (!window.TangoSolver) return { ok: true, steps: 0, abstractLine: 0 };
    const sim = puzzle.givens.slice();
    let steps = 0;
    let abstractLine = 0;
    let conflicts = 0;

    for (let guard = 0; guard < 90; guard++) {
      if (TangoSolver.completeAndLegal(sim, puzzle.signs)) return { ok: sim.join('') === puzzle.sol, steps, abstractLine, conflicts };
      const step = TangoSolver.logicalStep(sim, puzzle);
      if (!step) return { ok: false, steps, abstractLine, conflicts };
      if (step.type === 'conflict') { conflicts++; return { ok: false, steps, abstractLine, conflicts }; }
      if (step.type !== 'fill') return { ok: false, steps, abstractLine, conflicts };
      if (isAbstractReason(step.reason)) abstractLine++;
      sim[step.cell] = step.value;
      steps++;
    }

    return { ok: false, steps, abstractLine, conflicts };
  }

  function profileAccepts(puzzle, profile) {
    const trace = solveProfile(puzzle);
    puzzle.profile = trace;
    return trace.ok && trace.abstractLine <= profile.abstractMax;
  }

  function pickBalancedSigns(solution, profile) {
    const all = shuffle(allSignCluesForSolution(solution));
    const target = randint(profile.signMin, profile.signMax);
    const selected = [];
    const rowCount = Array(N).fill(0);
    const colCount = Array(N).fill(0);

    for (const sign of all) {
      if (selected.length >= target) break;
      if (sign.d === 'h') {
        if (rowCount[sign.r] >= 2 && Math.random() < 0.7) continue;
        rowCount[sign.r]++;
      } else {
        if (colCount[sign.c] >= 2 && Math.random() < 0.7) continue;
        colCount[sign.c]++;
      }
      selected.push(sign);
    }

    while (selected.length < target && all.length) selected.push(all.pop());
    return selected;
  }

  function unsolveCells(solution, signs, profile, targetBlanks) {
    const givens = solution.split('');
    let blanks = 0;
    let removed = true;
    let passes = 0;

    while (removed && passes < 4 && blanks < targetBlanks) {
      removed = false;
      passes++;
      for (const cell of shuffle(Array.from({ length: N * N }, (_, i) => i))) {
        if (blanks >= targetBlanks) break;
        if (givens[cell] == null) continue;
        const old = givens[cell];
        givens[cell] = null;
        const puzzle = puzzleFromParts(givens, signs, solution, profile.label);
        const clues = cluesFromParts(givens, signs);
        if (uniquelySolvable(clues, solution) && profileAccepts(puzzle, profile)) { removed = true; blanks++; }
        else givens[cell] = old;
      }
    }

    return givens;
  }

  function chooseProfile() {
    try {
      const forced = localStorage.getItem('tangoMode');
      const found = PROFILES.find(p => p.id === forced);
      if (found) return found;
    } catch (_) {}
    const total = PROFILES.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    for (const profile of PROFILES) {
      roll -= profile.weight;
      if (roll <= 0) return profile;
    }
    return PROFILES[1];
  }

  function generateWithProfile(profile) {
    let best = null;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < profile.attempts; attempt++) {
      const solution = randomSolution();
      const signs = pickBalancedSigns(solution, profile);
      const targetBlanks = randint(profile.blankMin, profile.blankMax);
      const givens = unsolveCells(solution, signs, profile, targetBlanks);
      const puzzle = puzzleFromParts(givens, signs, solution, profile.label);
      const clues = cluesFromParts(givens, signs);
      if (!uniquelySolvable(clues, solution) || !profileAccepts(puzzle, profile)) continue;

      const blanks = givens.filter(v => v == null).length;
      const inRange = blanks >= profile.blankMin && blanks <= profile.blankMax;
      const score = (inRange ? 30 : 0) - Math.abs(blanks - targetBlanks) * 2 + blanks * 0.35 - puzzle.profile.abstractLine * 5 - Math.abs(puzzle.profile.steps - (profile.blankMin + profile.blankMax) / 2) * 0.2;
      if (score > bestScore) { best = puzzle; bestScore = score; }
      if (inRange && Math.random() < 0.35) return puzzle;
    }

    return best;
  }

  function generatePuzzle() {
    const primary = chooseProfile();
    const order = [primary].concat(shuffle(PROFILES.filter(p => p.id !== primary.id)));
    for (const profile of order) {
      const puzzle = generateWithProfile(profile);
      if (puzzle) return puzzle;
    }

    const fallbackSolution = randomSolution();
    const profile = PROFILES[1];
    const signs = pickBalancedSigns(fallbackSolution, profile);
    const givens = fallbackSolution.split('');
    for (const i of shuffle(Array.from({ length: N * N }, (_, i) => i)).slice(0, profile.blankMin)) givens[i] = null;
    return puzzleFromParts(givens, signs, fallbackSolution, profile.label);
  }

  return {
    N, H, SUN, MOON, ROWS, ALL_BOARDS, NICE_BOARDS, PROFILES,
    shuffle, countSymbol, hasThreeTogether, transitionCount,
    isPureZigzag, isStrongZigzag, boardShapeScore,
    cellIndex, lineCells, lineText, signCells, lineCandidates,
    generatePuzzle, uniquelySolvable, puzzleFromClues, puzzleFromParts, solveProfile
  };
})();
