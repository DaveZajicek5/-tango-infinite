(() => {
  'use strict';
  const E = window.TangoEngine;
  const S = window.TangoSolver;
  if (!E || !S) return;

  const originalStep = S.logicalStep;
  const N = E.N;
  const SUN = E.SUN;

  function rowOf(i) { return Math.floor(i / N); }
  function colOf(i) { return i % N; }
  function opposite(v) { return v === E.SUN ? E.MOON : E.SUN; }
  function sym(v) { return v === SUN ? '☀' : '☾'; }
  function lineLabel(isRow, n) { return isRow ? `řádku ${n + 1}` : `sloupci ${'ABCDEF'[n]}`; }

  function formatPattern(pattern, pos) {
    return pattern.split('').map((v, i) => i === pos ? `[${sym(v)}]` : sym(v)).join(' ');
  }

  function findForcedLine(state, puzzle, step) {
    const candidates = [];
    for (const isRow of [true, false]) {
      const line = isRow ? rowOf(step.cell) : colOf(step.cell);
      const cells = E.lineCells(isRow, line);
      const pos = cells.indexOf(step.cell);
      const pats = E.lineCandidates(state, isRow, line, puzzle.signs);
      if (!pats.length) continue;
      if (pats.every(p => p[pos] === step.value)) {
        candidates.push({ isRow, line, cells, pos, pats });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.pats.length - b.pats.length);
    return candidates[0];
  }

  function isVagueLineReason(reason) {
    const r = (reason || '').toLowerCase();
    return r.includes('započtení') || r.includes('vychází') || r.includes('variant');
  }

  function makeConcreteReason(info, step) {
    const shown = info.pats.slice(0, 4).map(p => formatPattern(p, info.pos)).join(' / ');
    const more = info.pats.length > 4 ? ` / … (${info.pats.length} tvarů celkem)` : '';
    const opp = sym(opposite(step.value));
    const here = sym(step.value);

    if (info.pats.length === 1) {
      return `V naznačeném ${lineLabel(info.isRow, info.line)} zbyl jediný možný tvar: ${shown}. Modré místo je v něm ${here}; opačný symbol ${opp} by nedal platné doplnění.`;
    }

    return `V naznačeném ${lineLabel(info.isRow, info.line)} zbývají možné tvary: ${shown}${more}. Ve všech je na modrém místě ${here}; opačný symbol ${opp} by nedal platné doplnění.`;
  }

  S.logicalStep = function improvedLogicalStep(state, puzzle) {
    const step = originalStep(state, puzzle);
    if (!step || step.type !== 'fill') return step;
    if (!isVagueLineReason(step.reason)) return step;

    const info = findForcedLine(state, puzzle, step);
    if (!info) return step;

    return {
      ...step,
      support: info.cells.filter(i => state[i] != null),
      focus: info.cells,
      reason: makeConcreteReason(info, step)
    };
  };
})();
