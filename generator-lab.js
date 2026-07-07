(() => {
  'use strict';

  const E = window.TangoEngine;
  const S = window.TangoSolver;
  if (!E || window.__tangoGeneratorLab) return;
  window.__tangoGeneratorLab = true;

  const RATING_KEY = 'tangoGeneratorRatingsV1';
  const SESSION_KEY = 'tangoGeneratorSessionsV1';
  const SAVE_KEYS = ['tangoSaveV12', 'tangoSaveV11', 'tangoSaveV10'];
  const MODES = E.generatorModes || [
    { id: 'hybrid', label: 'LI mix' },
    { id: 'skeleton', label: 'LI skeleton' },
    { id: 'mutant', label: 'LI mutant' },
    { id: 'grammar', label: 'LI grammar' },
    { id: 'archive', label: 'Archive replay' },
    { id: 'original', label: 'Old generator' }
  ];

  const msg = document.getElementById('msg');
  const newBtn = document.getElementById('new');
  const hintBtn = document.getElementById('hint');
  if (!msg || !newBtn) return;

  const style = document.createElement('style');
  style.textContent = `
    .genLab{border:1px solid var(--line);border-radius:18px;background:#fbfaf6;padding:12px;margin:10px 0 12px;font-size:14px;color:var(--muted)}
    .genLabTop{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.genLabTitle{font-weight:850;color:var(--ink)}
    .genLab select{appearance:none;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:750;padding:9px 34px 9px 10px;min-width:168px;background-image:linear-gradient(45deg,transparent 50%,#6b6f76 50%),linear-gradient(135deg,#6b6f76 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat}
    .genMeta{margin-top:8px;line-height:1.35}.starRow{display:flex;align-items:center;gap:3px;margin-top:9px;flex-wrap:wrap}.starBtn{font-size:24px;line-height:1;border:0;background:transparent;color:#c9b99a;padding:2px 3px;border-radius:8px}.starBtn.on{color:#f7b731}.starBtn:active{transform:scale(.96)}
    .ratingLabel{width:76px;font-weight:750;color:var(--ink)}.labActions{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}.labSmall{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;font-size:13px;font-weight:750;color:var(--muted)}
    .labStats{margin-top:8px;font-size:13px;line-height:1.35;color:var(--muted)}
  `;
  document.head.appendChild(style);

  const lab = document.createElement('div');
  lab.className = 'genLab';
  lab.innerHTML = `
    <div class="genLabTop"><span class="genLabTitle">Generator lab</span><select id="genModeSelect" aria-label="Generator method"></select></div>
    <div id="genMeta" class="genMeta">Načítám aktuální setup…</div>
    <div class="starRow" data-kind="visual"><span class="ratingLabel">Vizuál</span>${[1,2,3,4,5].map(n=>`<button type="button" class="starBtn" data-rating="${n}">★</button>`).join('')}</div>
    <div class="starRow" data-kind="play"><span class="ratingLabel">Hraní</span>${[1,2,3,4,5].map(n=>`<button type="button" class="starBtn" data-rating="${n}">★</button>`).join('')}</div>
    <div class="labActions"><button type="button" class="labSmall" id="exportRatings">Export lab data</button><button type="button" class="labSmall" id="clearRatings">Clear lab data</button></div>
    <div id="labStats" class="labStats"></div>
  `;
  msg.parentNode.insertBefore(lab, msg);

  const select = lab.querySelector('#genModeSelect');
  const statsEl = lab.querySelector('#labStats');
  const meta = lab.querySelector('#genMeta');
  for (const mode of MODES) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.label || mode.id;
    select.appendChild(option);
  }
  select.value = E.currentGeneratorMode ? E.currentGeneratorMode() : (localStorage.getItem('tangoGenerator') || 'hybrid');

  function readJSON(key, fallback) { try { const x = JSON.parse(localStorage.getItem(key) || 'null'); return x ?? fallback; } catch (_) { return fallback; } }
  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function readRatings() { const x = readJSON(RATING_KEY, []); return Array.isArray(x) ? x : []; }
  function writeRatings(x) { writeJSON(RATING_KEY, x); }
  function readSessions() { const x = readJSON(SESSION_KEY, []); return Array.isArray(x) ? x : []; }
  function writeSessions(x) { writeJSON(SESSION_KEY, x.slice(-250)); }
  function readSave() {
    for (const key of SAVE_KEYS) { const x = readJSON(key, null); if (x?.puzzle) return x; }
    return null;
  }
  function modeLabel(id) { return MODES.find(m => m.id === id)?.label || id || '?'; }
  function signSignature(p) { return (p.signs || []).map(s => `${s.r},${s.c},${s.d},${s.same ? 1 : 0}`).join('|'); }
  function givenSignature(p) { return (p.givens || []).map(v => v == null ? '.' : v).join(''); }
  function puzzleKey(p) { return p ? [p.generator || p.source || p.mode || '?', p.archiveId || '', p.sol || '', givenSignature(p), signSignature(p)].join('::') : ''; }
  function currentPuzzle() { return readSave()?.puzzle || null; }
  function nowISO() { return new Date().toISOString(); }
  function elapsed(saved) { return saved?.startedAt ? Math.max(0, (saved.solvedAt || Date.now()) - saved.startedAt) : null; }

  function stepKind(step) {
    const s = (step?.reason || '').toLowerCase();
    if (s.includes('započtení') || s.includes('vychází') || s.includes('zbývají') || s.includes('variant') || s.includes('tvar') || s.includes('platné doplnění')) return 'line';
    if (s.includes('znak') || s.includes('=') || s.includes('×')) return 'relation';
    if (s.includes('dvě') || s.includes('troj') || s.includes('tři stej')) return 'triple';
    if (s.includes('tři slunce') || s.includes('tři měsíce') || s.includes('přesně')) return 'balance';
    return step?.type || 'basic';
  }

  function sessionBase(saved) {
    const p = saved?.puzzle;
    if (!p) return null;
    return {
      key: puzzleKey(p), firstSeen: nowISO(), selectedMode: select.value,
      generator: p.generator || p.source || p.mode || 'unknown', mode: p.mode || null, source: p.source || null, archiveId: p.archiveId || null,
      givenCount: p.givenCount ?? p.givens.filter(v => v != null).length, signCount: p.signCount ?? p.signs.length, score: p.linkedinScore ?? null,
      steps: p.profile?.steps ?? null, relation: p.profile?.relation ?? null, abstract: p.profile?.abstractLine ?? null,
      givens: givenSignature(p), signs: signSignature(p), hints: []
    };
  }

  function upsertSession(saved = readSave()) {
    const base = sessionBase(saved); if (!base) return null;
    const rows = readSessions(); let row = rows.find(r => r.key === base.key);
    if (!row) { row = base; rows.push(row); }
    row.selectedMode = select.value;
    row.started = !!saved.started || !!saved.startedAt; row.solved = !!saved.solved;
    row.startedAt = saved.startedAt || row.startedAt || null; row.solvedAt = saved.solvedAt || row.solvedAt || null;
    row.elapsedMs = elapsed(saved); row.hintCount = saved.hintCount || row.hintCount || 0;
    writeSessions(rows); return row;
  }

  function currentRatingRow() {
    const p = currentPuzzle(); if (!p) return null;
    const key = puzzleKey(p);
    return readRatings().find(r => r.key === key) || null;
  }

  function renderStars() {
    const row = currentRatingRow() || {};
    for (const starRow of lab.querySelectorAll('.starRow')) {
      const kind = starRow.dataset.kind;
      const val = kind === 'visual' ? (row.visualRating || 0) : (row.playRating || row.rating || 0);
      for (const b of starRow.querySelectorAll('.starBtn')) b.classList.toggle('on', Number(b.dataset.rating) <= val);
    }
  }

  function ratingStats() {
    const rows = readRatings(); const sessions = readSessions();
    if (!rows.length && !sessions.length) return 'Žádná data zatím.';
    const byMode = new Map();
    for (const r of rows) {
      const key = r.generator || r.selectedMode || 'unknown';
      if (!byMode.has(key)) byMode.set(key, { v: [], p: [] });
      if (r.visualRating) byMode.get(key).v.push(r.visualRating);
      if (r.playRating || r.rating) byMode.get(key).p.push(r.playRating || r.rating);
    }
    const parts = [...byMode.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([mode, x]) => {
      const av = a => a.length ? (a.reduce((s,n)=>s+n,0)/a.length).toFixed(2) : '–';
      return `${modeLabel(mode)}: V ${av(x.v)}★ / H ${av(x.p)}★`;
    });
    const solved = sessions.filter(s => s.solved && s.elapsedMs).length;
    if (solved) {
      const avgMs = Math.round(sessions.filter(s => s.solved && s.elapsedMs).reduce((s,x)=>s+x.elapsedMs,0)/solved/1000);
      parts.push(`solved ${solved}, avg ${avgMs}s`);
    }
    return parts.join(' · ');
  }

  function renderLab() {
    const saved = readSave(); const p = saved?.puzzle; select.value = E.currentGeneratorMode ? E.currentGeneratorMode() : select.value;
    if (!p) { meta.textContent = 'Zatím není vygenerovaný setup.'; renderStars(); statsEl.textContent = ratingStats(); return; }
    upsertSession(saved);
    const profile = p.profile ? ` · steps ${p.profile.steps ?? '?'}, =/× ${p.profile.relation ?? 0}, abs ${p.profile.abstractLine ?? 0}` : '';
    const score = p.linkedinScore != null ? ` · LI score ${p.linkedinScore}` : '';
    const origin = p.archiveId ? ` · seed #${p.archiveId}` : '';
    const time = saved.startedAt ? ` · ${Math.round((elapsed(saved)||0)/1000)}s${saved.hintCount ? `, hints ${saved.hintCount}` : ''}` : '';
    const generator = p.generator || p.source || p.mode || 'unknown';
    meta.textContent = `${modeLabel(generator)} · ${p.givenCount ?? p.givens.filter(v=>v!=null).length} givens, ${p.signCount ?? p.signs.length} signs${origin}${score}${profile}${time}`;
    renderStars(); statsEl.textContent = ratingStats();
  }

  function saveRating(kind, rating) {
    const saved = readSave(); const p = saved?.puzzle; if (!p) return;
    upsertSession(saved);
    const key = puzzleKey(p); const rows = readRatings(); let row = rows.find(r => r.key === key);
    if (!row) { row = { key, ts: nowISO() }; rows.push(row); }
    row.updated = nowISO(); row.selectedMode = select.value;
    row.generator = p.generator || p.source || p.mode || 'unknown'; row.mode = p.mode || null; row.source = p.source || null; row.archiveId = p.archiveId || null;
    row.givenCount = p.givenCount ?? p.givens.filter(v => v != null).length; row.signCount = p.signCount ?? p.signs.length; row.score = p.linkedinScore ?? null;
    row.steps = p.profile?.steps ?? null; row.relation = p.profile?.relation ?? null; row.abstract = p.profile?.abstractLine ?? null;
    row.elapsedMs = elapsed(saved); row.hintCount = saved.hintCount || 0; row.givens = givenSignature(p); row.signs = signSignature(p);
    if (kind === 'visual') row.visualRating = rating; else row.playRating = rating;
    row.rating = row.playRating || row.visualRating || rating;
    writeRatings(rows); renderLab();
  }

  function recordHint() {
    const saved = readSave(); const p = saved?.puzzle;
    if (!p || !saved.started || saved.solved || !S?.logicalStep) return;
    const step = S.logicalStep(saved.state.slice(), p); if (!step) return;
    const row = upsertSession(saved); if (!row) return;
    row.hints = row.hints || [];
    row.hints.push({ t: elapsed(saved), kind: stepKind(step), type: step.type, cell: step.cell ?? null, support: step.support?.length || 0, empty: saved.state.filter(v => v == null).length, reason: (step.reason || step.text || '').slice(0, 180) });
    row.hintCount = row.hints.length;
    const rows = readSessions(); const i = rows.findIndex(r => r.key === row.key); if (i >= 0) rows[i] = row;
    writeSessions(rows);
  }

  function compactBundle() {
    return {
      schema: 'tango-lab-v2', exportedAt: nowISO(),
      ratings: readRatings().map(r => ({ k:r.key, v:r.visualRating||null, p:r.playRating||r.rating||null, g:r.generator, m:r.selectedMode, a:r.archiveId||null, gc:r.givenCount, sc:r.signCount, s:r.score, st:r.steps, rel:r.relation, abs:r.abstract, ms:r.elapsedMs||null, hc:r.hintCount||0, gv:r.givens, sg:r.signs })),
      sessions: readSessions().map(s => ({ k:s.key, g:s.generator, m:s.selectedMode, a:s.archiveId||null, gc:s.givenCount, sc:s.signCount, s:s.score, st:s.steps, rel:s.relation, abs:s.abstract, solved:!!s.solved, ms:s.elapsedMs||null, hc:s.hintCount||0, h:(s.hints||[]).map(h=>({t:h.t,k:h.kind,c:h.cell,e:h.empty,r:h.reason})) }))
    };
  }

  select.addEventListener('change', () => { if (E.setGeneratorMode) E.setGeneratorMode(select.value); else localStorage.setItem('tangoGenerator', select.value); for (const key of SAVE_KEYS) localStorage.removeItem(key); setTimeout(() => newBtn.click(), 30); });
  lab.querySelectorAll('.starRow .starBtn').forEach(button => button.addEventListener('click', () => saveRating(button.closest('.starRow').dataset.kind, Number(button.dataset.rating))));
  hintBtn?.addEventListener('click', recordHint, true);

  lab.querySelector('#exportRatings').addEventListener('click', async () => {
    renderLab(); const payload = JSON.stringify(compactBundle(), null, 2);
    try { await navigator.clipboard.writeText(payload); statsEl.textContent = `Lab data zkopírována do clipboardu. ${ratingStats()}`; }
    catch (_) { const blob = new Blob([payload], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tango-lab-data.json'; a.click(); statsEl.textContent = `Staženo tango-lab-data.json. ${ratingStats()}`; }
  });
  lab.querySelector('#clearRatings').addEventListener('click', () => { if (!confirm('Smazat všechna lokální lab data?')) return; localStorage.removeItem(RATING_KEY); localStorage.removeItem(SESSION_KEY); renderLab(); });

  newBtn.addEventListener('click', () => setTimeout(renderLab, 140));
  window.addEventListener('storage', renderLab);
  setInterval(renderLab, 2000);
  setTimeout(renderLab, 120);
})();
