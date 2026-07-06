window.TangoSolver = (() => {
  const E = window.TangoEngine;
  const { N, H, SUN, MOON } = E;
  const COLS = 'ABCDEF';

  function other(value) {
    return value === SUN ? MOON : SUN;
  }

  function cellName(index) {
    const row = Math.floor(index / N);
    const col = index % N;
    return `${COLS[col]}${row + 1}`;
  }

  function typeName(value) {
    return value === SUN ? 'slunce' : 'měsíc';
  }

  function lineName(isRow, n) {
    return isRow ? `řádku ${n + 1}` : `sloupci ${COLS[n]}`;
  }

  function completeAndLegal(state, signs) {
    if (state.some(value => value == null)) return false;

    for (let line = 0; line < N; line++) {
      for (const isRow of [true, false]) {
        const text = E.lineCells(isRow, line).map(index => state[index]).join('');
        if (E.countSymbol(text, SUN) !== H || E.hasThreeTogether(text)) return false;
      }
    }

    for (const sign of signs) {
      const [a, b] = E.signCells(sign);
      if ((state[a] === state[b]) !== sign.same) return false;
    }

    return true;
  }

  function immediateViolation(state, signs) {
    for (const sign of signs) {
      const [a, b] = E.signCells(sign);
      if (state[a] != null && state[b] != null && ((state[a] === state[b]) !== sign.same)) {
        return { cells: [a, b], text: `${cellName(a)} a ${cellName(b)} porušují znak ${sign.same ? '=' : '×'}.` };
      }
    }

    for (const isRow of [true, false]) {
      for (let line = 0; line < N; line++) {
        const cells = E.lineCells(isRow, line);
        const suns = cells.filter(index => state[index] === SUN).length;
        const moons = cells.filter(index => state[index] === MOON).length;

        if (suns > H) return { cells: cells.filter(index => state[index] === SUN), text: `V ${lineName(isRow, line)} jsou víc než 3 slunce.` };
        if (moons > H) return { cells: cells.filter(index => state[index] === MOON), text: `V ${lineName(isRow, line)} jsou víc než 3 měsíce.` };

        for (let i = 0; i < N - 2; i++) {
          const triple = [cells[i], cells[i + 1], cells[i + 2]];
          if (state[triple[0]] != null && state[triple[0]] === state[triple[1]] && state[triple[1]] === state[triple[2]]) {
            return { cells: triple, text: `V ${lineName(isRow, line)} jsou tři stejné symboly za sebou.` };
          }
        }
      }
    }

    return null;
  }

  function signStep(state, puzzle) {
    for (const sign of puzzle.signs) {
      const [a, b] = E.signCells(sign);
      const av = state[a];
      const bv = state[b];

      if (av != null && bv == null) {
        const value = sign.same ? av : other(av);
        return { type: 'fill', cell: b, value, support: [a], reason: `${cellName(a)} je ${typeName(av)} a mezi ${cellName(a)} a ${cellName(b)} je znak ${sign.same ? '=' : '×'}, takže ${cellName(b)} musí být ${typeName(value)}.` };
      }

      if (bv != null && av == null) {
        const value = sign.same ? bv : other(bv);
        return { type: 'fill', cell: a, value, support: [b], reason: `${cellName(b)} je ${typeName(bv)} a mezi ${cellName(a)} a ${cellName(b)} je znak ${sign.same ? '=' : '×'}, takže ${cellName(a)} musí být ${typeName(value)}.` };
      }
    }

    return null;
  }

  function tripleStep(state) {
    for (const isRow of [true, false]) {
      for (let line = 0; line < N; line++) {
        const cells = E.lineCells(isRow, line);

        for (let i = 0; i < N - 2; i++) {
          const a = cells[i];
          const b = cells[i + 1];
          const c = cells[i + 2];
          const av = state[a];
          const bv = state[b];
          const cv = state[c];

          if (av != null && av === bv && cv == null) {
            const value = other(av);
            return { type: 'fill', cell: c, value, support: [a, b], reason: `V ${lineName(isRow, line)} už jsou dvě ${typeName(av)} vedle sebe (${cellName(a)}–${cellName(b)}). Třetí stejné vedle nich nesmí být, takže ${cellName(c)} musí být ${typeName(value)}.` };
          }

          if (bv != null && bv === cv && av == null) {
            const value = other(bv);
            return { type: 'fill', cell: a, value, support: [b, c], reason: `V ${lineName(isRow, line)} už jsou dvě ${typeName(bv)} vedle sebe (${cellName(b)}–${cellName(c)}). Třetí stejné vedle nich nesmí být, takže ${cellName(a)} musí být ${typeName(value)}.` };
          }

          if (av != null && av === cv && bv == null) {
            const value = other(av);
            return { type: 'fill', cell: b, value, support: [a, c], reason: `V ${lineName(isRow, line)} jsou ${cellName(a)} a ${cellName(c)} obě ${typeName(av)}. Kdyby bylo stejné i prostřední pole, vznikly by tři v řadě, takže ${cellName(b)} musí být ${typeName(value)}.` };
          }
        }
      }
    }

    return null;
  }

  function balanceStep(state) {
    for (const isRow of [true, false]) {
      for (let line = 0; line < N; line++) {
        const cells = E.lineCells(isRow, line);
        const empty = cells.filter(index => state[index] == null);
        if (!empty.length) continue;

        const suns = cells.filter(index => state[index] === SUN).length;
        const moons = cells.filter(index => state[index] === MOON).length;

        if (suns === H) {
          const cell = empty[0];
          return { type: 'fill', cell, value: MOON, support: cells.filter(index => state[index] === SUN), reason: `V ${lineName(isRow, line)} už jsou tři slunce. Řádek/sloupec má mít přesně tři slunce a tři měsíce, takže ${cellName(cell)} musí být měsíc.` };
        }

        if (moons === H) {
          const cell = empty[0];
          return { type: 'fill', cell, value: SUN, support: cells.filter(index => state[index] === MOON), reason: `V ${lineName(isRow, line)} už jsou tři měsíce. Řádek/sloupec má mít přesně tři slunce a tři měsíce, takže ${cellName(cell)} musí být slunce.` };
        }
      }
    }

    return null;
  }

  function candidateStep(state, puzzle) {
    for (const isRow of [true, false]) {
      for (let line = 0; line < N; line++) {
        const cells = E.lineCells(isRow, line);
        const candidates = E.lineCandidates(state, isRow, line, puzzle.signs);

        if (!candidates.length) {
          return { type: 'conflict', cells, text: `Pro ${lineName(isRow, line)} už neexistuje žádné platné doplnění.` };
        }

        for (let position = 0; position < N; position++) {
          const cell = cells[position];
          if (state[cell] != null) continue;

          const forced = candidates[0][position];
          if (candidates.every(pattern => pattern[position] === forced)) {
            return { type: 'fill', cell, value: forced, support: cells.filter(index => state[index] != null), reason: `V ${lineName(isRow, line)} po započtení počtů, zákazu tří stejných za sebou a znaků =/× vychází na ${cellName(cell)} vždy ${typeName(forced)}.` };
          }
        }
      }
    }

    return null;
  }

  function logicalStep(state, puzzle) {
    const bad = immediateViolation(state, puzzle.signs);
    if (bad) return { type: 'conflict', ...bad };

    return signStep(state, puzzle)
      || tripleStep(state)
      || balanceStep(state)
      || candidateStep(state, puzzle);
  }

  function humanSolves(puzzle) {
    const state = puzzle.givens.slice();

    for (let i = 0; i < 80; i++) {
      if (completeAndLegal(state, puzzle.signs)) return state.join('') === puzzle.sol;
      const step = logicalStep(state, puzzle);
      if (!step || step.type !== 'fill') return false;
      state[step.cell] = step.value;
    }

    return false;
  }

  return { cellName, typeName, immediateViolation, logicalStep, completeAndLegal, humanSolves };
})();
