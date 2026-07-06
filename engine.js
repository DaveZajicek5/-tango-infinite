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

  function isPureZigzag(text) {
    return text === '010101' || text === '101010';
  }

  function isStrongZigzag(text) {
    return transitionCount(text) >= 4;
  }

  const ROWS = [];
  for (let n = 0; n < 64; n++) {
    const row = n.toString(2).padStart(6, '0');
    if (countSymbol(row, SUN) === H && !hasThreeTogether(row)) ROWS.push(row);
  }

  function cellIndex(row, col) {
    return row * N + col;
  }

  function lineCells(isRow, lineNumber) {
    return Array.from({ length: N }, (_, k) => isRow ? cellIndex(lineNumber, k) : cellIndex(k, lineNumber));
  }

  function lineText(board, isRow, lineNumber) {
    return lineCells(isRow, lineNumber).map(index => board[index]).join('');
  }

  function buildAllBoards() {
    const boards = [];

    function addRow(rowNumber, chosenRows, columnSunCounts) {
      if (rowNumber === N) {
        boards.push(chosenRows.join(''));
        return;
      }

      for (const row of ROWS) {
        let ok = true;
        const nextCounts = columnSunCounts.slice();

        for (let col = 0; col < N; col++) {
          if (row[col] === SUN) nextCounts[col]++;
          const remainingRows = N - rowNumber - 1;

          if (nextCounts[col] > H || nextCounts[col] + remainingRows < H) {
            ok = false;
            break;
          }

          if (rowNumber >= 2 && chosenRows[rowNumber - 1][col] === row[col] && chosenRows[rowNumber - 2][col] === row[col]) {
            ok = false;
            break;
          }
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

  function randomSolution() {
    const pool = NICE_BOARDS.length ? NICE_BOARDS : ALL_BOARDS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function signCells(sign) {
    const a = cellIndex(sign.r, sign.c);
    return [a, sign.d === 'h' ? a + 1 : a + N];
  }

  function clueFits(board, clue) {
    if (clue.t === 'g') return board[clue.i] === clue.v;
    const [a, b] = signCells(clue);
    return (board[a] === board[b]) === clue.same;
  }

  function boardFitsClues(board, clues) {
    return clues.every(clue => clueFits(board, clue));
  }

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

  function allCluesForSolution(solution) {
    const clues = [];

    for (let i = 0; i < N * N; i++) {
      clues.push({ t: 'g', i, v: solution[i] });
    }

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N - 1; col++) {
        clues.push({ t: 's', r: row, c: col, d: 'h', same: solution[cellIndex(row, col)] === solution[cellIndex(row, col + 1)] });
      }
    }

    for (let row = 0; row < N - 1; row++) {
      for (let col = 0; col < N; col++) {
        clues.push({ t: 's', r: row, c: col, d: 'v', same: solution[cellIndex(row, col)] === solution[cellIndex(row + 1, col)] });
      }
    }

    return clues;
  }

  function puzzleFromClues(clues, solution) {
    const givens = Array(N * N).fill(null);
    const signs = [];

    for (const clue of clues) {
      if (clue.t === 'g') givens[clue.i] = clue.v;
      else signs.push({ t: 's', r: clue.r, c: clue.c, d: clue.d, same: clue.same });
    }

    const shape = boardShapeScore(solution);
    return { sol: solution, givens, signs, clues: clues.length, human: true, shape };
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
        if (isRow && sign.d === 'h' && sign.r === lineNumber) {
          if ((pattern[sign.c] === pattern[sign.c + 1]) !== sign.same) continue patternLoop;
        }
        if (!isRow && sign.d === 'v' && sign.c === lineNumber) {
          if ((pattern[sign.r] === pattern[sign.r + 1]) !== sign.same) continue patternLoop;
        }
      }

      candidates.push(pattern);
    }

    return candidates;
  }

  function generatePuzzle() {
    for (let attempt = 0; attempt < 160; attempt++) {
      const solution = randomSolution();
      let clues = [];
      const pool = shuffle(allCluesForSolution(solution));

      for (const clue of pool) {
        clues.push(clue);

        if (clues.length >= 10 && uniquelySolvable(clues, solution)) {
          const possiblePuzzle = puzzleFromClues(clues, solution);

          if (window.TangoSolver && TangoSolver.humanSolves(possiblePuzzle)) {
            const removals = shuffle(clues.slice()).slice(0, 55);

            for (const clueToRemove of removals) {
              if (clues.length <= 10) break;
              const trial = clues.filter(clue => clue !== clueToRemove);
              const trialPuzzle = puzzleFromClues(trial, solution);

              if (uniquelySolvable(trial, solution) && TangoSolver.humanSolves(trialPuzzle)) {
                clues = trial;
              }
            }

            return puzzleFromClues(clues, solution);
          }
        }
      }
    }

    const fallbackSolution = randomSolution();
    const fallbackClues = allCluesForSolution(fallbackSolution).filter(clue => clue.t === 'g').slice(0, 18);
    return puzzleFromClues(fallbackClues, fallbackSolution);
  }

  return {
    N, H, SUN, MOON, ROWS, ALL_BOARDS, NICE_BOARDS,
    shuffle, countSymbol, hasThreeTogether, transitionCount,
    isPureZigzag, isStrongZigzag, boardShapeScore,
    cellIndex, lineCells, lineText, signCells, lineCandidates,
    generatePuzzle, uniquelySolvable, puzzleFromClues
  };
})();
