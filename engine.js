window.TangoEngine = (() => {
  const N = 6;
  const H = 3;
  const SUN = '1';
  const MOON = '0';

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function countSymbol(text, symbol) {
    let total = 0;
    for (const ch of text) if (ch === symbol) total++;
    return total;
  }

  function hasThreeTogether(text) {
    for (let i = 0; i < text.length - 2; i++) {
      if (text[i] === text[i + 1] && text[i] === text[i + 2]) return true;
    }
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
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N - 1; col++) clues.push({ t: 's', r: row, c: col, d: 'h', same: solution[cellIndex(row, col)] === solution[cellIndex(row, col + 1)] });
    }
    for (let row = 0; row < N - 1; row++) {
      for (let col = 0; col < N; col++) clues.push({ t: 's', r: row, c: col, d: 'v', same: solution[cellIndex(row, col)] === solution[cellIndex(row + 1, col)] });
    }
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

  function puzzleFromParts(givens, signs, solution) {
    const shape = boardShapeScore(solution);
    const givenCount = givens.filter(v => v != null).length;
    return { sol: solution, givens: givens.slice(), signs: signs.map(s => ({ ...s })), clues: givenCount + signs.length, givenCount, signCount: signs.length, human: true, shape };
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

  function pickBalancedSigns(solution) {
    const all = shuffle(allSignCluesForSolution(solution));
    const target = 7 + Math.floor(Math.random() * 5);
    const selected = [];
    const rowCount = Array(N).fill(0);
    const colCount = Array(N).fill(0);

    for (const sign of all) {
      if (selected.length >= target) break;
      if (sign.d === 'h') {
        if (rowCount[sign.r] >= 2 && Math.random() < 0.75) continue;
        rowCount[sign.r]++;
      } else {
        if (colCount[sign.c] >= 2 && Math.random() < 0.75) continue;
        colCount[sign.c]++;
      }
      selected.push(sign);
    }

    while (selected.length < target && all.length) selected.push(all.pop());
    return selected;
  }

  function humanSolvable(puzzle) { return !window.TangoSolver || TangoSolver.humanSolves(puzzle); }

  function unsolveCells(solution, signs) {
    const givens = solution.split('');
    let removed = true;
    let passes = 0;

    while (removed && passes < 3) {
      removed = false;
      passes++;
      for (const cell of shuffle(Array.from({ length: N * N }, (_, i) => i))) {
        if (givens[cell] == null) continue;
        const old = givens[cell];
        givens[cell] = null;
        const puzzle = puzzleFromParts(givens, signs, solution);
        const clues = cluesFromParts(givens, signs);
        if (uniquelySolvable(clues, solution) && humanSolvable(puzzle)) removed = true;
        else givens[cell] = old;
      }
    }

    return givens;
  }

  function generatePuzzle() {
    let best = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      const solution = randomSolution();
      const signs = pickBalancedSigns(solution);
      const givens = unsolveCells(solution, signs);
      const puzzle = puzzleFromParts(givens, signs, solution);
      const clues = cluesFromParts(givens, signs);
      if (!uniquelySolvable(clues, solution) || !humanSolvable(puzzle)) continue;

      const blanks = givens.filter(v => v == null).length;
      if (blanks >= 18 && blanks <= 27) return puzzle;
      if (!best || blanks > best.givens.filter(v => v == null).length) best = puzzle;
    }

    if (best) return best;
    const fallbackSolution = randomSolution();
    const signs = pickBalancedSigns(fallbackSolution);
    const givens = fallbackSolution.split('');
    for (const i of shuffle(Array.from({ length: N * N }, (_, i) => i)).slice(0, 18)) givens[i] = null;
    return puzzleFromParts(givens, signs, fallbackSolution);
  }

  return {
    N, H, SUN, MOON, ROWS, ALL_BOARDS, NICE_BOARDS,
    shuffle, countSymbol, hasThreeTogether, transitionCount,
    isPureZigzag, isStrongZigzag, boardShapeScore,
    cellIndex, lineCells, lineText, signCells, lineCandidates,
    generatePuzzle, uniquelySolvable, puzzleFromClues, puzzleFromParts
  };
})();
