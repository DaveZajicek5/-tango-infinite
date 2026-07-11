(() => {
  'use strict';

  const board = document.getElementById('board');
  const hintButton = document.getElementById('hint');
  const message = document.getElementById('msg');
  const toggle = document.getElementById('trainingToggle');
  const delaySelect = document.getElementById('trainingDelay');
  const panel = document.getElementById('trainingPanel');
  const progress = document.getElementById('trainingProgress');
  const coachText = document.getElementById('trainingMessage');
  const showNow = document.getElementById('trainingSkip');

  const STORAGE_KEY = 'tango-training:v1';
  let enabled = false;
  let revealing = false;
  let stepStartedAt = 0;
  let deadline = 0;
  let timer = null;
  let lastSignature = '';
  let stats = loadStats();

  function loadStats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { attempts: [], techniques: {} }; }
    catch (_) { return { attempts: [], techniques: {} }; }
  }

  function saveStats() { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); }
  function delayMs() { return Number(delaySelect.value || 5) * 1000; }
  function signature() { return [...board.querySelectorAll('td')].map(td => currentValue(td)).join(''); }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function currentValue(td) {
    const real = td.querySelector('.token:not(.hintGhost)');
    return real?.classList.contains('sun') ? 'S' : real?.classList.contains('moon') ? 'M' : '.';
  }

  function startStep() {
    if (!enabled || revealing) return;
    stepStartedAt = performance.now();
    deadline = stepStartedAt + delayMs();
    lastSignature = signature();
    coachText.textContent = 'Najdi další logický krok.';
    paint();
  }

  function paint() {
    if (!enabled) return;
    const remaining = Math.max(0, deadline - performance.now());
    progress.style.setProperty('--progress', `${remaining / delayMs() * 100}%`);
    progress.textContent = `${(remaining / 1000).toFixed(1)} s`;
    if (!revealing && remaining <= 0) revealAndDemonstrate();
  }

  function record(technique, ms, assisted) {
    const key = technique || 'Logický krok';
    const item = stats.techniques[key] || { attempts: 0, clean: 0, assisted: 0, totalMs: 0, bestMs: null };
    item.attempts++;
    item[assisted ? 'assisted' : 'clean']++;
    item.totalMs += ms;
    item.bestMs = item.bestMs == null ? ms : Math.min(item.bestMs, ms);
    stats.techniques[key] = item;
    stats.attempts.push({ at: new Date().toISOString(), technique: key, ms, assisted });
    if (stats.attempts.length > 500) stats.attempts.splice(0, stats.attempts.length - 500);
    saveStats();
  }

  function techniqueFromHint() {
    const text = message.textContent.toLowerCase();
    if (text.includes('znak') || text.includes('=') || text.includes('×')) return 'Vztah = / ×';
    if (text.includes('tři stej') || text.includes('dvě')) return 'Žádné tři stejné';
    if (text.includes('limit') || text.includes('přesně') || text.includes('tři slunce') || text.includes('tři měsíce')) return 'Vyvážení řádku/sloupce';
    if (text.includes('platný tvar') || text.includes('možnost') || text.includes('doplnění')) return 'Vynucený tvar linie';
    return 'Logický krok';
  }

  async function revealAndDemonstrate() {
    if (!enabled || revealing || hintButton.disabled) return;
    revealing = true;
    coachText.textContent = 'Sleduj: žlutá pole jsou důvod, modré pole je tah.';
    hintButton.click();
    await sleep(250);
    const target = board.querySelector('.hintCell');
    const ghost = target?.querySelector('.hintGhost');
    if (!target || !ghost) {
      revealing = false;
      coachText.textContent = 'Jednoduchý krok nebyl nalezen.';
      setTimeout(startStep, 850);
      return;
    }
    const wanted = ghost.classList.contains('sun') ? 'S' : 'M';
    const current = currentValue(target);
    const technique = techniqueFromHint();
    target.animate([
      { transform: 'scale(1)', outlineWidth: '4px' },
      { transform: 'scale(1.10)', outlineWidth: '7px' },
      { transform: 'scale(1)', outlineWidth: '4px' }
    ], { duration: 650, easing: 'ease-in-out' });
    await sleep(900);
    const cycle = ['.', 'S', 'M'];
    const clicks = (cycle.indexOf(wanted) - cycle.indexOf(current) + cycle.length) % cycle.length;
    for (let i = 0; i < clicks; i++) target.click();
    record(technique, delayMs(), true);
    coachText.textContent = `${technique}: tah byl předveden.`;
    await sleep(450);
    revealing = false;
    startStep();
  }

  function toggleTraining() {
    enabled = !enabled;
    toggle.textContent = enabled ? 'Trénink: zapnutý' : 'Trénink: vypnutý';
    toggle.classList.toggle('trainingActive', enabled);
    panel.hidden = !enabled;
    if (enabled) {
      timer = setInterval(paint, 50);
      startStep();
    } else {
      clearInterval(timer);
      timer = null;
      revealing = false;
    }
  }

  toggle.addEventListener('click', toggleTraining);
  delaySelect.addEventListener('change', startStep);
  showNow.addEventListener('click', revealAndDemonstrate);

  board.addEventListener('click', event => {
    if (!enabled || revealing || !event.target.closest('td')) return;
    const before = lastSignature;
    setTimeout(() => {
      const next = signature();
      if (!next || next === before) return;
      const elapsed = performance.now() - stepStartedAt;
      record('Samostatně nalezený krok', elapsed, false);
      coachText.textContent = `Krok nalezen za ${(elapsed / 1000).toFixed(2)} s.`;
      startStep();
    }, 0);
  });
})();
