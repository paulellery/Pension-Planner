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
        { id: uid(), name: 'Workplace pension', ownerId: a, balance: 150000, monthly: 500, growth: 5 },
        { id: uid(), name: 'SIPP', ownerId: b, balance: 60000, monthly: 250, growth: 5 },
        { id: uid(), name: 'ISA', ownerId: a, balance: 20000, monthly: 200, growth: 4 },
      ],
      db: [{ id: uid(), name: 'Final salary scheme', ownerId: b, annual: 8000, startAge: 65 }],
      drawdown: [
        { id: uid(), fromAge: 60, mode: 'amount', value: 58000 },
        { id: uid(), fromAge: 75, mode: 'amount', value: 45000 },
        { id: uid(), fromAge: 85, mode: 'amount', value: 38000 },
      ],
      settings: { endAge: 100 },
    };
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
    for (const k of ['people', 'pots', 'db', 'drawdown']) if (Array.isArray(d[k])) out[k] = d[k];
    if (d.settings) out.settings = { ...out.settings, ...d.settings };
    if (!out.people.length) out.people = example().people.slice(0, 1);
    return out;
  }

  let state = load();

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
      ['name', 'text', 'Pot'],
      ['ownerId', 'owner', 'Owner'],
      ['balance', 'number', 'Current value £'],
      ['monthly', 'number', 'Paying in £/month'],
      ['growth', 'number', 'Growth %/yr'],
    ],
    db: [
      ['name', 'text', 'Scheme'],
      ['ownerId', 'owner', 'Owner'],
      ['annual', 'number', 'Pension £/yr'],
      ['startAge', 'number', 'Starts at owner age'],
    ],
    drawdown: [
      ['fromAge', 'number', 'From age'],
      ['mode', 'mode', 'Type'],
      ['value', 'number', 'Amount'],
    ],
  };

  const BLANK = {
    people: () => ({ name: 'Person ' + (state.people.length + 1), age: 50, retireAge: 65, statePension: 12548, statePensionAge: 67 }),
    pots: () => ({ name: 'New pot', ownerId: state.people[0].id, balance: 0, monthly: 0, growth: 5 }),
    db: () => ({ name: 'DB pension', ownerId: state.people[0].id, annual: 0, startAge: 65 }),
    drawdown: () => {
      const last = state.drawdown[state.drawdown.length - 1];
      return { fromAge: last ? num(last.fromAge) + 10 : state.people[0].retireAge, mode: 'amount', value: last ? last.value : 30000 };
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
    } else if (type === 'mode') {
      control = `<select ${attrs}>
        <option value="amount"${item.mode !== 'percent' ? ' selected' : ''}>Income target £/yr</option>
        <option value="percent"${item.mode === 'percent' ? ' selected' : ''}>% of pots per yr</option>
      </select>`;
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
  }

  function refreshOwnerSelects() {
    document.querySelectorAll('select.owner').forEach((sel) => {
      const item = state[sel.dataset.col][sel.dataset.i];
      sel.innerHTML = ownerOptions(item.ownerId);
    });
  }

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'endAge') {
      state.settings.endAge = el.value;
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
        for (const x of [...state.pots, ...state.db]) if (x.ownerId === removed.id) x.ownerId = state.people[0].id;
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
    const { rows, runOut } = simulate(state);
    renderSummary(rows, runOut);
    renderIncomeChart(rows, runOut);
    renderPotChart(rows, runOut);
    renderTable(rows);
  }

  function renderSummary(rows, runOut) {
    const p1 = state.people[0];
    const el = document.getElementById('summary');
    if (!rows.length) { el.innerHTML = ''; return; }
    const retireRow = rows.find((r) => r.age >= num(p1.retireAge)) || rows[0];
    const potsAtRetire = retireRow.startTotal;
    const last = rows[rows.length - 1];
    const firstDraw = rows.find((r) => r.target !== null || r.withdrawn > 0);

    const runOutCard = runOut
      ? `<div class="card bad"><div class="label">Money runs out</div>
           <div class="value">Age ${runOut.age} (${runOut.year})</div>
           <div class="note">${esc(p1.name)}'s age. From then, income drops to the guaranteed pensions — short by ${money(runOut.shortfall)} that year.</div></div>`
      : `<div class="card good"><div class="label">Money runs out</div>
           <div class="value">Never</div>
           <div class="note">Pots last beyond age ${last.age}, with ${money(last.endTotal)} left.</div></div>`;

    el.innerHTML = runOutCard + `
      <div class="card"><div class="label">Pots at ${esc(p1.name)}'s retirement (age ${retireRow.age})</div>
        <div class="value">${money(potsAtRetire)}</div></div>
      <div class="card"><div class="label">Income in first drawdown year</div>
        <div class="value">${firstDraw ? money(firstDraw.income) : '—'}</div>
        <div class="note">${firstDraw ? 'At age ' + firstDraw.age : 'No drawdown plan set'}</div></div>
      <div class="card"><div class="label">Left in pots at age ${last.age}</div>
        <div class="value">${money(last.endTotal)}</div></div>`;
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
    const max = niceMax(Math.max(0, ...rows.map((r) => Math.max(r.income, r.target || 0))));
    el.innerHTML = frame(rows, max, runOut, ({ x, y, step }) => {
      const bw = Math.max(1, step * 0.8), off = (step - bw) / 2;
      let out = '';
      rows.forEach((r, i) => {
        let base = 0;
        const tip = `Age ${r.age}: state ${money(r.statePension)}, DB ${money(r.dbIncome)}, pots ${money(r.withdrawn)}${r.target !== null ? ', target ' + money(r.target) : ''}`;
        out += `<g><title>${esc(tip)}</title>`;
        for (const [cls, v] of [['state', r.statePension], ['db', r.dbIncome], ['pots', r.withdrawn]]) {
          if (v > 0) out += `<rect class="${cls}" x="${x(i) + off}" width="${bw}" y="${y(base + v)}" height="${y(base) - y(base + v)}"/>`;
          base += v;
        }
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

  function renderPotChart(rows, runOut) {
    const el = document.getElementById('potChart');
    const max = niceMax(Math.max(0, ...rows.map((r) => Math.max(r.startTotal, r.endTotal))));
    el.innerHTML = frame(rows, max, runOut, ({ x, y, step }) => {
      if (!rows.length) return '';
      const pts = rows.map((r, i) => `${x(i) + step / 2},${y(r.endTotal)}`);
      const line = 'M' + pts.join('L');
      const area = `${line}L${x(rows.length - 1) + step / 2},${y(0)}L${x(0) + step / 2},${y(0)}Z`;
      const tips = rows.map((r, i) => `<rect x="${x(i)}" width="${step}" y="${M.t}" height="${H - M.t - M.b}" fill="transparent"><title>Age ${r.age} (${r.year}): ${money(r.endTotal)}</title></rect>`).join('');
      return `<path class="area" d="${area}"/><path class="line" d="${line}"/>${tips}`;
    });
  }

  function renderTable(rows) {
    const others = state.people.slice(1);
    const head = `<tr><th>${esc(state.people[0].name)} age</th>${others.map((p) => `<th>${esc(p.name)}</th>`).join('')}
      <th>Year</th><th>Paid in</th><th>Growth</th><th>State pension</th><th>DB pensions</th><th>From pots</th>
      <th>Total income</th><th>Target</th><th>Shortfall</th><th>Pots at year end</th></tr>`;
    const body = rows.map((r) => `<tr class="${r.shortfall ? 'short' : ''}">
      <td>${r.age}</td>${r.ages.slice(1).map((a) => `<td>${a}</td>`).join('')}
      <td>${r.year}</td><td>${money(r.contributions)}</td><td>${money(r.growth)}</td>
      <td>${money(r.statePension)}</td><td>${money(r.dbIncome)}</td><td>${money(r.withdrawn)}</td>
      <td>${money(r.income)}</td><td>${r.target !== null ? money(r.target) : '—'}</td>
      <td class="shortfall">${r.shortfall ? money(r.shortfall) : ''}</td><td>${money(r.endTotal)}</td></tr>`).join('');
    document.getElementById('table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  }

  renderForms();
  renderResults();
})();
