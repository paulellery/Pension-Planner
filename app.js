(function () {
  'use strict';

  const KEY = 'pension-planner:v1';
  const { simulate, num } = window.PensionModel;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  const money = (v) => gbp.format(Math.round(v || 0));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function example() {
    const a = uid(), b = uid();
    return {
      people: [
        { id: a, name: 'Alex', age: 50, retireAge: 60, statePension: 12548, statePensionAge: 67 },
        { id: b, name: 'Sam', age: 48, retireAge: 60, statePension: 12548, statePensionAge: 67 },
      ],
      pots: [
        { id: uid(), name: 'Workplace pension', ownerId: a, balance: 150000, monthly: 500, accessAge: 57 },
        { id: uid(), name: 'SIPP', ownerId: b, balance: 60000, monthly: 250, accessAge: 57 },
      ],
      isas: [
        { id: uid(), name: 'Stocks & shares ISA', ownerId: a, balance: 20000, monthly: 200 },
      ],
      db: [{ id: uid(), name: 'Final salary scheme', ownerId: b, annual: 8000, startAge: 65 }],
      drawdown: [
        { id: uid(), fromAge: 60, value: 58000 },
        { id: uid(), fromAge: 75, value: 45000 },
        { id: uid(), fromAge: 85, value: 38000 },
      ],
      settings: { endAge: 100, growth: 5 },
      whatIf: noWhatIf(),
    };
  }

  function noWhatIf() {
    return { target: null, contribPct: null, retireAge: null };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalise(JSON.parse(raw));
    } catch (e) { /* fall through to example */ }
    return example();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function normalise(d) {
    const out = example();
    for (const k of ['people', 'pots', 'isas', 'db', 'drawdown']) if (Array.isArray(d[k])) out[k] = d[k];
    // Older saves kept ISAs among the pots.
    if (!Array.isArray(d.isas)) {
      const isISA = (p) => /\bisa\b/i.test(p.name || '');
      out.isas = out.pots.filter(isISA).map(({ accessAge, ...p }) => p);
      out.pots = out.pots.filter((p) => !isISA(p));
    }
    if (d.settings) out.settings = { ...out.settings, ...d.settings };
    out.whatIf = { ...noWhatIf(), ...d.whatIf };
    // Older saves had a growth rate per pot: use their size-weighted average.
    const all = [...out.pots, ...out.isas].filter((p) => p.growth !== undefined);
    if (all.length && !(d.settings && d.settings.growth !== undefined)) {
      const total = all.reduce((t, p) => t + num(p.balance), 0);
      const avg = total > 0 ? all.reduce((t, p) => t + num(p.growth) * num(p.balance), 0) / total : num(all[0].growth);
      out.settings.growth = Math.round(avg * 10) / 10;
    }
    for (const p of [...out.pots, ...out.isas]) delete p.growth;
    if (!out.people.length) out.people = example().people.slice(0, 1);
    return out;
  }

  let state = load();

  // ---- What if -----------------------------------------------------------
  // Temporary overrides on top of the saved details, applied to a copy.

  function firstBand(list) {
    return list
      .filter((b) => b.fromAge !== '' && b.fromAge !== undefined)
      .reduce((min, b) => (!min || num(b.fromAge) < num(min.fromAge) ? b : min), null);
  }

  function hasWhatIf() {
    return Object.values(state.whatIf).some((v) => v !== null);
  }

  function withWhatIf(base) {
    const w = base.whatIf;
    const s = JSON.parse(JSON.stringify(base));
    const band = firstBand(s.drawdown);
    if (w.contribPct !== null) {
      for (const p of s.pots) p.monthly = Math.max(0, num(p.monthly) * (1 + w.contribPct / 100));
    }
    if (w.target !== null && band) band.value = w.target;
    if (w.retireAge !== null) {
      // The first target income band moves with retirement, keeping any gap between them.
      const shift = w.retireAge - num(s.people[0].retireAge);
      s.people[0].retireAge = w.retireAge;
      if (band && shift) {
        band.fromAge = num(band.fromAge) + shift;
        s.drawdown = s.drawdown.filter((b) => b === band || num(b.fromAge) > band.fromAge);
      }
    }
    return s;
  }

  function planValues() {
    const band = firstBand(state.drawdown);
    return {
      target: band ? num(band.value) : null,
      contribPct: 0,
      retireAge: num(state.people[0].retireAge),
      band,
    };
  }

  function renderWhatIf() {
    const plan = planValues();
    const shown = withWhatIf(state);
    const p1 = state.people[0];
    const monthly = (d) => d.pots.reduce((t, p) => t + num(p.monthly), 0);
    const shownBand = firstBand(shown.drawdown);

    for (const el of document.querySelectorAll('[data-w]')) {
      const k = el.dataset.w;
      if (document.activeElement !== el) el.value = state.whatIf[k] ?? plan[k] ?? '';
      el.closest('label').classList.toggle('changed', state.whatIf[k] !== null);
    }
    document.querySelector('[data-w="target"]').disabled = !plan.band;
    document.getElementById('wTargetFrom').textContent = shownBand ? `(from age ${num(shownBand.fromAge)})` : '';
    document.getElementById('wTargetPlan').textContent = plan.band ? `Plan: ${money(plan.target)}` : 'Add a target income in Details first';
    document.getElementById('wContribPlan').textContent =
      `${money(monthly(shown))}/month in total` + (state.whatIf.contribPct !== null ? ` (plan: ${money(monthly(state))})` : '');
    document.getElementById('wRetireName').textContent = p1.name || 'First person';
    document.getElementById('wRetirePlan').textContent = `Plan: ${plan.retireAge}`;
    const changes = Object.values(state.whatIf).filter((v) => v !== null).length;
    document.getElementById('whatifReset').hidden = !changes;
    const count = document.getElementById('whatifCount');
    count.hidden = !changes;
    count.textContent = changes === 1 ? '1 change' : `${changes} changes`;
  }

  document.getElementById('whatifReset').addEventListener('click', () => {
    state.whatIf = noWhatIf();
    save();
    renderResults();
  });

  // ---- Tabs --------------------------------------------------------------

  const TABS = ['details', 'income', 'total', 'table'];

  function showTab(tab) {
    if (!TABS.includes(tab)) tab = 'details';
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== tab;
    document.getElementById('resultsHead').hidden = tab === 'details';
  }

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    history.replaceState(null, '', '#' + b.dataset.tab);
    showTab(b.dataset.tab);
  });

  // ---- Forms -------------------------------------------------------------

  const FIELDS = {
    people: [
      ['name', 'text', 'Name'],
      ['age', 'number', 'Current age'],
      ['retireAge', 'number', 'Retirement age'],
      ['statePension', 'number', 'State pension £/yr'],
      ['statePensionAge', 'number', 'State pension age'],
    ],
    pots: [
      ['name', 'text', 'Pension'],
      ['ownerId', 'owner', 'Owner'],
      ['balance', 'number', 'Current value £'],
      ['monthly', 'number', 'Paying in £/month'],
      ['accessAge', 'number', 'Access from age'],
    ],
    isas: [
      ['name', 'text', 'ISA'],
      ['ownerId', 'owner', 'Owner'],
      ['balance', 'number', 'Current value £'],
      ['monthly', 'number', 'Paying in £/month'],
    ],
    db: [
      ['name', 'text', 'Scheme'],
      ['ownerId', 'owner', 'Owner'],
      ['annual', 'number', 'Pension £/yr'],
      ['startAge', 'number', 'Starts at owner age'],
    ],
    drawdown: [
      ['fromAge', 'number', 'From age'],
      ['value', 'number', 'After tax £/yr'],
    ],
  };

  const BLANK = {
    people: () => ({ name: 'Person ' + (state.people.length + 1), age: 50, retireAge: 65, statePension: 12548, statePensionAge: 67 }),
    isas: () => ({ name: 'ISA', ownerId: state.people[0].id, balance: 0, monthly: 0 }),
    pots: () => ({ name: 'Pension', ownerId: state.people[0].id, balance: 0, monthly: 0, accessAge: 57 }),
    db: () => ({ name: 'DB pension', ownerId: state.people[0].id, annual: 0, startAge: 65 }),
    drawdown: () => {
      const last = state.drawdown[state.drawdown.length - 1];
      return { fromAge: last ? num(last.fromAge) + 10 : state.people[0].retireAge, value: last ? last.value : 30000 };
    },
  };

  function ownerOptions(selected) {
    return state.people.map((p) => `<option value="${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name || 'Unnamed')}</option>`).join('');
  }

  function field(col, i, item, [key, type, label]) {
    const attrs = `data-col="${col}" data-i="${i}" data-f="${key}"`;
    let control;
    if (type === 'owner') {
      control = `<select ${attrs} class="owner">${ownerOptions(item[key])}</select>`;
    } else {
      const extra = type === 'number' ? ' inputmode="decimal" step="any"' : '';
      control = `<input type="${type}" ${attrs} value="${esc(item[key])}"${extra}>`;
    }
    return `<label>${label}${control}</label>`;
  }

  function renderForms() {
    for (const col of Object.keys(FIELDS)) {
      const list = state[col];
      document.getElementById(col).innerHTML = list.map((item, i) => `
        <div class="item">
          ${FIELDS[col].map((f) => field(col, i, item, f)).join('')}
          <button type="button" class="remove" data-remove="${col}" data-i="${i}" title="Remove" aria-label="Remove">×</button>
        </div>`).join('') || '<p class="hint">None yet.</p>';
    }
    document.getElementById('endAge').value = state.settings.endAge;
    document.getElementById('growth').value = state.settings.growth;
  }

  function refreshOwnerSelects() {
    document.querySelectorAll('select.owner').forEach((sel) => {
      const item = state[sel.dataset.col][sel.dataset.i];
      sel.innerHTML = ownerOptions(item.ownerId);
    });
  }

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'endAge' || el.id === 'growth') {
      state.settings[el.id] = el.value;
    } else if (el.dataset.w) {
      const k = el.dataset.w;
      const v = parseFloat(el.value);
      // Blank or back to the plan's value means no change.
      state.whatIf[k] = Number.isFinite(v) && v !== planValues()[k] ? v : null;
    } else if (el.dataset.col) {
      const item = state[el.dataset.col][el.dataset.i];
      item[el.dataset.f] = el.type === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
      if (el.dataset.col === 'people' && el.dataset.f === 'name') refreshOwnerSelects();
    } else {
      return;
    }
    save();
    renderResults();
  });

  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const rem = e.target.closest('[data-remove]');
    if (add) {
      state[add.dataset.add].push({ id: uid(), ...BLANK[add.dataset.add]() });
    } else if (rem) {
      const col = rem.dataset.remove;
      if (col === 'people' && state.people.length === 1) return alert('You need at least one person.');
      const [removed] = state[col].splice(+rem.dataset.i, 1);
      if (col === 'people') {
        for (const x of [...state.pots, ...state.isas, ...state.db]) if (x.ownerId === removed.id) x.ownerId = state.people[0].id;
      }
    } else {
      return;
    }
    save();
    renderForms();
    renderResults();
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Replace your data with the example figures?')) return;
    state = example();
    save(); renderForms(); renderResults();
  });
  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pension-planner.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state = normalise(JSON.parse(await file.text()));
      save(); renderForms(); renderResults();
    } catch (err) {
      alert('Could not read that file: ' + err.message);
    }
    e.target.value = '';
  });

  // ---- Results -----------------------------------------------------------

  function renderResults() {
    const shown = withWhatIf(state);
    const { rows, runOut, gap } = simulate(shown);
    const plan = hasWhatIf() ? simulate(state) : null;
    renderWhatIf();
    renderSummary(shown, rows, runOut, gap, plan);
    renderIncomeChart(rows, runOut);
    renderPotChart(rows, runOut, plan && plan.rows);
    renderTable(rows);
  }

  const gapText = (g) => (g.fromAge === g.toAge ? `Age ${g.fromAge}` : `Ages ${g.fromAge}–${g.toAge}`);

  function headlines(data, rows, runOut, gap) {
    const retireRow = rows.find((r) => r.age >= num(data.people[0].retireAge)) || rows[0];
    const last = rows[rows.length - 1];
    const firstDraw = rows.find((r) => r.target !== null || r.withdrawn > 0);
    return {
      runOut: runOut ? `Age ${runOut.age}` : 'Never',
      gap: gap ? gapText(gap) : 'None',
      retire: `${money(retireRow.startTotal)} at ${retireRow.age}`,
      firstIncome: firstDraw ? `${money(firstDraw.income)} at ${firstDraw.age}` : '—',
      left: money(last.endTotal),
      tax: money(rows.reduce((t, r) => t + r.tax, 0)),
    };
  }

  function renderSummary(data, rows, runOut, gap, plan) {
    const p1 = data.people[0];
    const el = document.getElementById('summary');
    if (!rows.length) { el.innerHTML = ''; return; }
    const retireRow = rows.find((r) => r.age >= num(p1.retireAge)) || rows[0];
    const potsAtRetire = retireRow.startTotal;
    const retireIsas = retireRow.startIsas;
    const last = rows[rows.length - 1];
    const firstDraw = rows.find((r) => r.target !== null || r.withdrawn > 0);

    // With a what-if, note the plan's figure under any card that changed.
    const now = headlines(data, rows, runOut, gap);
    const was = plan && plan.rows.length ? headlines(state, plan.rows, plan.runOut, plan.gap) : null;
    const planNote = (k) => (was && was[k] !== now[k] ? `<div class="note was">Plan: ${was[k]}</div>` : '');

    const runOutCard = runOut
      ? `<div class="card bad"><div class="label">Money runs out</div>
           <div class="value">Age ${runOut.age} (${runOut.year})</div>
           <div class="note">${esc(p1.name)}'s age. From then, income drops to the guaranteed pensions — short by ${money(runOut.shortfall)} that year.</div>${planNote('runOut')}</div>`
      : `<div class="card good"><div class="label">Money runs out</div>
           <div class="value">Never</div>
           <div class="note">Pots last beyond age ${last.age}, with ${money(last.endTotal)} left.</div>${planNote('runOut')}</div>`;

    const gapCard = gap || (was && was.gap !== 'None')
      ? `<div class="card${gap ? ' bad' : ' good'}"><div class="label">Gap before pensions open</div>
           <div class="value">${gap ? gapText(gap) : 'None'}</div>
           <div class="note">${gap
             ? `Not enough in ISAs and open pensions to reach the target until the pensions can be drawn — short by ${money(gap.total)} in total.`
             : 'ISAs cover the target until the pensions open.'}</div>${planNote('gap')}</div>`
      : '';

    el.innerHTML = runOutCard + gapCard + `
      <div class="card"><div class="label">Pots at ${esc(p1.name)}'s retirement (age ${retireRow.age})</div>
        <div class="value">${money(potsAtRetire)}</div>
        <div class="note">${money(retireRow.startTotal - retireIsas)} pensions, ${money(retireIsas)} ISAs</div>${planNote('retire')}</div>
      <div class="card"><div class="label">Income after tax in first retirement year</div>
        <div class="value">${firstDraw ? money(firstDraw.income) : '—'}</div>
        <div class="note">${firstDraw ? `At age ${firstDraw.age}, after ${money(firstDraw.tax)} tax` : 'No target income set'}</div>${planNote('firstIncome')}</div>
      <div class="card"><div class="label">Income tax to age ${last.age}</div>
        <div class="value">${now.tax}</div>${planNote('tax')}</div>
      <div class="card"><div class="label">Left in pots at age ${last.age}</div>
        <div class="value">${money(last.endTotal)}</div>${planNote('left')}</div>`;
  }

  const W = 900, H = 280, M = { t: 12, r: 12, b: 28, l: 64 };

  function niceMax(v) {
    if (v <= 0) return 1000;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function shortMoney(v) {
    if (v >= 1e6) return '£' + +(v / 1e6).toFixed(2) + 'm';
    if (v >= 1e3) return '£' + +(v / 1e3).toFixed(1) + 'k';
    return '£' + v;
  }
  function frame(rows, max, runOut, body) {
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const n = rows.length;
    const step = iw / Math.max(n, 1);
    const x = (i) => M.l + i * step;
    const y = (v) => M.t + ih - (v / max) * ih;
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      grid += `<line class="grid-line" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/>
               <text x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end">${shortMoney(v)}</text>`;
    }
    rows.forEach((r, i) => {
      if (r.age % 5 === 0) grid += `<text x="${x(i) + step / 2}" y="${H - 8}" text-anchor="middle">${r.age}</text>`;
    });
    let marker = '';
    if (runOut) {
      const i = rows.findIndex((r) => r.age === runOut.age);
      marker = `<line class="runout" x1="${x(i)}" x2="${x(i)}" y1="${M.t}" y2="${M.t + ih}"/>
                <text class="runout-label" x="${x(i) + 4}" y="${M.t + 12}">Runs out ${runOut.age}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${grid}${body({ x, y, step })}${marker}</svg>`;
  }

  function renderIncomeChart(rows, runOut) {
    const el = document.getElementById('incomeChart');
    const max = niceMax(Math.max(0, ...rows.map((r) => Math.max(r.gross, r.target || 0))));
    el.innerHTML = frame(rows, max, runOut, ({ x, y, step }) => {
      const bw = Math.max(1, step * 0.8), off = (step - bw) / 2;
      let out = `<defs><pattern id="taxHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" class="tax-bg"/><line x1="0" y1="0" x2="0" y2="6" class="tax-stroke"/></pattern></defs>`;
      rows.forEach((r, i) => {
        let base = 0;
        const tip = `Age ${r.age}: state ${money(r.statePension)}, DB ${money(r.dbIncome)}, pensions ${money(r.fromPensions)}, ISAs ${money(r.fromIsas)}, tax ${money(r.tax)}, after tax ${money(r.income)}${r.target !== null ? ', target ' + money(r.target) : ''}`;
        out += `<g><title>${esc(tip)}</title>`;
        for (const [cls, v] of [['state', r.statePension], ['db', r.dbIncome], ['pots', r.fromPensions], ['isa', r.fromIsas]]) {
          if (v > 0) out += `<rect class="${cls}" x="${x(i) + off}" width="${bw}" y="${y(base + v)}" height="${y(base) - y(base + v)}"/>`;
          base += v;
        }
        // Tax comes off the top of the bar, so the unhatched part is income after tax.
        if (r.tax > 0) out += `<rect class="tax" x="${x(i) + off}" width="${bw}" y="${y(r.gross)}" height="${y(r.gross - r.tax) - y(r.gross)}"/>`;
        out += '</g>';
      });
      // Target line as horizontal steps.
      let d = '';
      rows.forEach((r, i) => {
        if (r.target === null) return;
        const prev = rows[i - 1];
        d += (prev && prev.target !== null ? 'L' : 'M') + `${x(i)},${y(r.target)}L${x(i) + step},${y(r.target)}`;
      });
      if (d) out += `<path class="target" d="${d}"/>`;
      return out;
    });
  }

  function renderPotChart(rows, runOut, planRows) {
    const el = document.getElementById('potChart');
    const all = planRows ? rows.concat(planRows) : rows;
    const max = niceMax(Math.max(0, ...all.map((r) => Math.max(r.startTotal, r.endTotal))));
    for (const el of document.querySelectorAll('#potLegend .vs')) el.hidden = !planRows;
    el.innerHTML = frame(rows, max, runOut, ({ x, y, step }) => {
      if (!rows.length) return '';
      const path = (list) => 'M' + list.map((r, i) => `${x(i) + step / 2},${y(r.endTotal)}`).join('L');
      const line = path(rows);
      const planLine = planRows ? `<path class="plan-line" d="${path(planRows)}"/>` : '';
      const base = `L${x(rows.length - 1) + step / 2},${y(0)}L${x(0) + step / 2},${y(0)}Z`;
      const area = line + base;
      // ISAs shaded along the bottom; the rest of the area up to the total is pensions.
      const isaArea = 'M' + rows.map((r, i) => `${x(i) + step / 2},${y(r.endIsas)}`).join('L') + base;
      const tips = rows.map((r, i) => `<rect x="${x(i)}" width="${step}" y="${M.t}" height="${H - M.t - M.b}" fill="transparent"><title>Age ${r.age} (${r.year}): ${money(r.endTotal)} — pensions ${money(r.endPensions)}, ISAs ${money(r.endIsas)}</title></rect>`).join('');
      return `<path class="area" d="${area}"/><path class="isa-area" d="${isaArea}"/>${planLine}<path class="line" d="${line}"/>${tips}`;
    });
  }

  function renderTable(rows) {
    const others = state.people.slice(1);
    const lockedCol = rows.some((r) => r.locked > 0.5);
    const head = `<tr><th>${esc(state.people[0].name)} age</th>${others.map((p) => `<th>${esc(p.name)}</th>`).join('')}
      <th>Year</th><th>Paid in</th><th>Growth</th><th>State pension</th><th>DB pensions</th><th>From pensions</th><th>From ISAs</th>
      <th>Before tax</th><th>Income tax</th><th>After tax</th><th>Target</th><th>Shortfall</th><th>Pensions at year end</th><th>ISAs at year end</th>${lockedCol ? '<th>Not yet accessible</th>' : ''}</tr>`;
    const body = rows.map((r) => `<tr class="${r.shortfall ? 'short' : ''}">
      <td>${r.age}</td>${r.ages.slice(1).map((a) => `<td>${a}</td>`).join('')}
      <td>${r.year}</td><td>${money(r.contributions)}</td><td>${money(r.growth)}</td>
      <td>${money(r.statePension)}</td><td>${money(r.dbIncome)}</td><td>${money(r.fromPensions)}</td><td>${money(r.fromIsas)}</td>
      <td>${money(r.gross)}</td><td>${money(r.tax)}</td><td>${money(r.income)}</td><td>${r.target !== null ? money(r.target) : '—'}</td>
      <td class="shortfall">${r.shortfall ? money(r.shortfall) : ''}</td><td>${money(r.endPensions)}</td><td>${money(r.endIsas)}</td>${lockedCol ? `<td>${r.locked > 0.5 ? money(r.locked) : ''}</td>` : ''}</tr>`).join('');
    document.getElementById('table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  }

  renderForms();
  renderResults();
  showTab(location.hash.slice(1));
})();
