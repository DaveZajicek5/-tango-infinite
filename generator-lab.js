(() => {
  'use strict';

  const E = window.TangoEngine;
  if (!E || window.__tangoGeneratorLab) return;
  window.__tangoGeneratorLab = true;

  const RATING_KEY = 'tangoGeneratorRatingsV1';
  const SAVE_KEYS = ['tangoSaveV12', 'tangoSaveV11', 'tangoSaveV10'];
  const MODES = E.generatorModes || [
    { id: 'hybrid', label: 'LI mix' },
    { id: 'skeleton', label: 'LI skeleton' },
    { id: 'mutant', label: 'LI mutant' },
    { id: 'grammar', label: 'LI grammar' },
    { id: 'archive', label: 'Archive replay' },
    { id: 'original', label: 'Old generator' }
  ];

  const card = document.querySelector('.card');
  const msg = document.getElementById('msg');
  const newBtn = document.getElementById('new');
  if (!card || !newBtn) return;

  const style = document.createElement('style');
  style.textContent = `
    .genLab{border:1px solid var(--line);border-radius:18px;background:#fbfaf6;padding:12px;margin:10px 0 12px;font-size:14px;color:var(--muted)}
    .genLabTop{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.genLabTitle{font-weight:850;color:var(--ink)}
    .genLab select{appearance:none;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:750;padding:9px 34px 9px 10px;min-width:168px;background-image:linear-gradient(45deg,transparent 50%,#6b6f76 50%),linear-gradient(135deg,#6b6f76 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat}
    .genMeta{margin-top:8px;line-height:1.35}.stars{display:flex;align-items:center;gap:3px;margin-top:10px;flex-wrap:wrap}.starBtn{font-size:24px;line-height:1;border:0;background:transparent;color:#c9b99a;padding:2px 3px;border-radius:8px}.starBtn.on{color:#f7b731}.starBtn:active{transform:scale(.96)}
    .ratingLabel{margin-right:4px;font-weight:750;color:var(--ink)}.labActions{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}.labSmall{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;font-size:13px;font-weight:750;color:var(--muted)}
    .labStats{margin-top:8px;font-size:13px;line-height:1.35;color:var(--muted)}
  `;
  document.head.appendChild(style);

  const lab = document.createElement('div');
  lab.className = 'genLab';
  lab.innerHTML = `
    <div class="genLabTop">
      <span class="genLabTitle">Generator lab</span>
      <select id="genModeSelect" aria-label="Generator method"></select>
    </div>
    <div id="genMeta" class="genMeta">Načítám aktuální setup…</div>
    <div class="stars" id="ratingStars" aria-label="Rate current setup">
      <span class="ratingLabel">Setup rating:</span>
      <button type="button" class="starBtn" data-rating="1">★</button>
      <button type="button" class="starBtn" data-rating="2">★</button>
      <button type="button" class="starBtn" data-rating="3">★</button>
      <button type="button" class="starBtn" data-rating="4">★</button>
      <button type="button" class="starBtn" data-rating="5">★</button>
    </div>
    <div class="labActions">
      <button type="button" class="labSmall" id="exportRatings">Export ratings</button>
      <button type="button" class="labSmall" id="clearRatings">Clear ratings</button>
    </div>
    <div id="labStats" class="labStats"></div>
  `;
  msg.parentNode.insertBefore(lab, msg);

  const select = lab.querySelector('#genModeSelect');
  const meta = lab.querySelector('#genMeta');
  const stars = [...lab.querySelectorAll('.starBtn')];
  const statsEl = lab.querySelector('#labStats');

  for (const mode of MODES) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.label || mode.id;
    select.appendChild(option);
  }
  select.value = E.currentGeneratorMode ? E.currentGeneratorMode() : (localStorage.getItem('tangoGenerator') || 'hybrid');

  function readSave() {
    for (const key of SAVE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.puzzle) return parsed;
      } catch (_) {}
    }
    return null;
  }

  function readRatings() {
    try {
      const value = JSON.parse(localStorage.getItem(RATING_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeRatings(rows) {
    localStorage.setItem(RATING_KEY, JSON.stringify(rows));
  }

  function signSignature(p) {
    return (p.signs || []).map(s => `${s.r},${s.c},${s.d},${s.same ? 1 : 0}`).join('|');
  }

  function givenSignature(p) {
    return (p.givens || []).map(v => v == null ? '.' : v).join('');
  }

  function puzzleKey(p) {
    if (!p) return '';
    return [p.generator || p.source || p.mode || '?', p.archiveId || '', p.sol || '', givenSignature(p), signSignature(p)].join('::');
  }

  function currentPuzzle() {
    return readSave()?.puzzle || null;
  }

  function currentRating() {
    const p = currentPuzzle();
    if (!p) return 0;
    const key = puzzleKey(p);
    const row = readRatings().find(r => r.key === key);
    return row ? row.rating : 0;
  }

  function modeLabel(id) {
    return MODES.find(m => m.id === id)?.label || id || '?';
  }

  function renderStars(rating) {
    for (const star of stars) star.classList.toggle('on', Number(star.dataset.rating) <= rating);
  }

  function ratingStats() {
    const rows = readRatings();
    if (!rows.length) return 'Žádná hodnocení zatím.';
    const byMode = new Map();
    for (const r of rows) {
      const key = r.generator || r.mode || 'unknown';
      if (!byMode.has(key)) byMode.set(key, []);
      byMode.get(key).push(r.rating);
    }
    return [...byMode.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([mode, vals]) => {
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      return `${modeLabel(mode)}: ${avg.toFixed(2)}★ / ${vals.length}`;
    }).join(' · ');
  }

  function renderLab() {
    const saved = readSave();
    const p = saved?.puzzle;
    select.value = E.currentGeneratorMode ? E.currentGeneratorMode() : select.value;
    if (!p) {
      meta.textContent = 'Zatím není vygenerovaný setup.';
      renderStars(0);
      statsEl.textContent = ratingStats();
      return;
    }
    const profile = p.profile ? ` · steps ${p.profile.steps ?? '?'}, =/× ${p.profile.relation ?? 0}, abs ${p.profile.abstractLine ?? 0}` : '';
    const score = p.linkedinScore != null ? ` · LI score ${p.linkedinScore}` : '';
    const origin = p.archiveId ? ` · seed #${p.archiveId}` : '';
    const generator = p.generator || p.source || p.mode || 'unknown';
    meta.textContent = `${modeLabel(generator)} · ${p.givenCount ?? p.givens.filter(v=>v!=null).length} givens, ${p.signCount ?? p.signs.length} signs${origin}${score}${profile}`;
    renderStars(currentRating());
    statsEl.textContent = ratingStats();
  }

  function saveRating(rating) {
    const p = currentPuzzle();
    if (!p) return;
    const key = puzzleKey(p);
    const rows = readRatings().filter(r => r.key !== key);
    rows.push({
      key,
      rating,
      ts: new Date().toISOString(),
      selectedMode: select.value,
      generator: p.generator || p.source || p.mode || 'unknown',
      mode: p.mode || null,
      source: p.source || null,
      archiveId: p.archiveId || null,
      givenCount: p.givenCount ?? p.givens.filter(v => v != null).length,
      signCount: p.signCount ?? p.signs.length,
      score: p.linkedinScore ?? null,
      steps: p.profile?.steps ?? null,
      relation: p.profile?.relation ?? null,
      abstract: p.profile?.abstractLine ?? null,
      solution: p.sol || null,
      givens: givenSignature(p),
      signs: signSignature(p)
    });
    writeRatings(rows);
    renderLab();
  }

  select.addEventListener('change', () => {
    if (E.setGeneratorMode) E.setGeneratorMode(select.value);
    else localStorage.setItem('tangoGenerator', select.value);
    for (const key of SAVE_KEYS) localStorage.removeItem(key);
    setTimeout(() => newBtn.click(), 30);
  });

  stars.forEach(button => button.addEventListener('click', () => saveRating(Number(button.dataset.rating))));

  lab.querySelector('#exportRatings').addEventListener('click', async () => {
    const rows = readRatings();
    const payload = JSON.stringify(rows, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      statsEl.textContent = `Zkopírováno ${rows.length} ratingů do clipboardu. ${ratingStats()}`;
    } catch (_) {
      const blob = new Blob([payload], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tango-generator-ratings.json';
      a.click();
      statsEl.textContent = `Staženo ${rows.length} ratingů. ${ratingStats()}`;
    }
  });

  lab.querySelector('#clearRatings').addEventListener('click', () => {
    if (!confirm('Smazat všechna lokální hodnocení generátorů?')) return;
    localStorage.removeItem(RATING_KEY);
    renderLab();
  });

  newBtn.addEventListener('click', () => setTimeout(renderLab, 120));
  window.addEventListener('storage', renderLab);
  setInterval(renderLab, 2000);
  setTimeout(renderLab, 80);
})();
