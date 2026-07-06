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
  function name(v) { return v === SUN ? 'slunce' : 'měsíc'; }
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
      if (pats.every(p => p[pos] === step.value)) candidates.push({ isRow, line, cells, pos, pats });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.pats.length - b.pats.length);
    return candidates[0];
  }

  function isVagueLineReason(reason) {
    const r = (reason || '').toLowerCase();
    return r.includes('započtení') || r.includes('vychází') || r.includes('variant') || r.includes('tvar');
  }

  function namedPatternReason(info, state, step) {
    const vals = info.cells.map(i => state[i]);
    const pos = info.pos;
    const v = step.value;

    if (vals[0] != null && vals[5] != null && vals[0] === vals[5] && (pos === 1 || pos === 4) && v === opposite(vals[0])) {
      return `Oba konce ${lineLabel(info.isRow, info.line)} jsou ${name(vals[0])}. V linii musí být přesně 3 a 3; kdyby hned vedle kraje byl znovu ${name(vals[0])}, prostředek by se už nedal doplnit bez trojice opačných symbolů. Vnitřní pole u obou krajů proto musí být ${name(v)}.`;
    }

    if (vals[0] != null && vals[1] === vals[0] && (pos === 2 || pos === 5) && v === opposite(vals[0])) {
      return `Na začátku ${lineLabel(info.isRow, info.line)} jsou dvě ${name(vals[0])}. Třetí pole nesmí být stejné kvůli trojici; a poslední pole taky vychází opačně, protože jinak už nejde dodržet poměr 3+3 bez trojice.`;
    }

    if (vals[4] != null && vals[5] === vals[4] && (pos === 0 || pos === 3) && v === opposite(vals[4])) {
      return `Na konci ${lineLabel(info.isRow, info.line)} jsou dvě ${name(vals[4])}. Pole před nimi nesmí být stejné kvůli trojici; a první pole taky vychází opačně, protože jinak už nejde dodržet poměr 3+3 bez trojice.`;
    }

    if (vals[0] != null && vals[4] === vals[0] && pos === 5 && v === opposite(vals[0])) {
      return `V ${lineLabel(info.isRow, info.line)} jsou stejný symbol na prvním a pátém místě. Poslední pole musí být opačné; kdyby bylo stejné, zbylá místa už nedají poměr 3+3 bez trojice.`;
    }

    if (vals[1] != null && vals[5] === vals[1] && pos === 0 && v === opposite(vals[1])) {
      return `V ${lineLabel(info.isRow, info.line)} jsou stejný symbol na druhém a posledním místě. První pole musí být opačné; kdyby bylo stejné, zbylá místa už nedají poměr 3+3 bez trojice.`;
    }

    return null;
  }

  function makeConcreteReason(info, state, step) {
    const named = namedPatternReason(info, state, step);
    if (named) return named;

    const shown = info.pats.slice(0, 4).map(p => formatPattern(p, info.pos)).join(' / ');
    const more = info.pats.length > 4 ? ` / … (${info.pats.length} tvarů celkem)` : '';
    const opp = sym(opposite(step.value));
    const here = sym(step.value);

    if (info.pats.length === 1) return `V naznačeném ${lineLabel(info.isRow, info.line)} zbyl jediný možný tvar: ${shown}. Modré místo je v něm ${here}; opačný symbol ${opp} by nedal platné doplnění.`;
    return `V naznačeném ${lineLabel(info.isRow, info.line)} zbývají možné tvary: ${shown}${more}. Ve všech je na modrém místě ${here}; opačný symbol ${opp} by nedal platné doplnění.`;
  }

  S.logicalStep = function improvedLogicalStep(state, puzzle) {
    const step = originalStep(state, puzzle);
    if (!step || step.type !== 'fill') return step;
    if (!isVagueLineReason(step.reason)) return step;

    const info = findForcedLine(state, puzzle, step);
    if (!info) return step;

    return { ...step, support: info.cells.filter(i => state[i] != null), focus: info.cells, reason: makeConcreteReason(info, state, step) };
  };
})();
