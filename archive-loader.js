(() => {
  'use strict';

  const E = window.TangoEngine;
  if (!E || E.__archiveWrapped) return;

  const originalGenerate = E.generatePuzzle;
  const SUN = E.SUN;
  const MOON = E.MOON;
  const N = E.N;

  function readArchive() {
    try {
      const raw = localStorage.getItem('tangoArchivePuzzles');
      const parsed = raw ? JSON.parse(raw) : (window.LI_TANGO_PUZZLES || []);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function signToEngine(sign) {
    return {
      t: 's',
      r: Number(sign.r) - 1,
      c: Number(sign.c) - 1,
      d: sign.d,
      same: sign.sign === '='
    };
  }

  function givenToEngine(value) {
    if (value === 'S' || value === 'sun' || value === SUN) return SUN;
    if (value === 'M' || value === 'moon' || value === MOON) return MOON;
    return null;
  }

  function clueFits(board, clue) {
    if (clue.t === 'g') return board[clue.i] === clue.v;
    const a = E.cellIndex(clue.r, clue.c);
    const b = clue.d === 'h' ? a + 1 : a + N;
    return (board[a] === board[b]) === clue.same;
  }

  function convert(entry) {
    const givens = Array(N * N).fill(null);
    const signs = (entry.signs || []).map(signToEngine).filter(sign => sign.r >= 0 && sign.c >= 0 && (sign.d === 'h' || sign.d === 'v'));
    const clues = [];

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const value = givenToEngine(entry.grid && entry.grid[r] && entry.grid[r][c]);
        if (value != null) {
          const i = E.cellIndex(r, c);
          givens[i] = value;
          clues.push({ t: 'g', i, v: value });
        }
      }
    }
    clues.push(...signs);

    const matches = [];
    for (const board of E.ALL_BOARDS) {
      if (clues.every(clue => clueFits(board, clue))) {
        matches.push(board);
        if (matches.length > 1) break;
      }
    }

    if (matches.length !== 1) return null;
    const puzzle = E.puzzleFromParts(givens, signs, matches[0], `LinkedIn #${entry.n || '?'}`);
    puzzle.source = 'linkedin-archive';
    puzzle.archiveId = entry.n || null;
    return puzzle;
  }

  function archivePuzzle() {
    const entries = readArchive().filter(entry => entry && entry.givenCount !== 0 && entry.signCount !== 0);
    if (!entries.length) return null;

    for (const entry of E.shuffle(entries.slice()).slice(0, 40)) {
      const puzzle = convert(entry);
      if (puzzle && (!window.TangoSolver || TangoSolver.humanSolves(puzzle))) return puzzle;
    }
    return null;
  }

  E.generatePuzzle = function generatePuzzleWithArchive() {
    const archive = archivePuzzle();
    if (archive) return archive;
    return originalGenerate();
  };

  E.importLinkedInArchive = function importLinkedInArchive(entries) {
    if (!Array.isArray(entries)) throw new Error('Expected an array of parsed Tango entries.');
    localStorage.setItem('tangoArchivePuzzles', JSON.stringify(entries));
    return entries.length;
  };

  E.clearLinkedInArchive = function clearLinkedInArchive() {
    localStorage.removeItem('tangoArchivePuzzles');
  };

  E.__archiveWrapped = true;
})();
