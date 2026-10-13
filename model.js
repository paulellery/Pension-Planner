// Year-by-year pension projection. All figures are in today's money (no inflation).
// Works in the browser (window.PensionModel) and in Node (module.exports) for testing.
(function (root) {
  'use strict';

  function num(v, fallback) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  // UK income tax, England, Wales & NI, 2025/26 bands held level in today's money.
  // The personal allowance is lost at £1 per £2 over £100k, which works out as a 60% band to £125,140.
  const TAX_BANDS = [[12570, 0], [50270, 0.2], [100000, 0.4], [125140, 0.6], [Infinity, 0.45]];
  // 25% of each pension withdrawal is tax free; the rest is taxed as income.
  const TAXABLE = 0.75;

  function incomeTax(income) {
    let tax = 0;
    let lower = 0;
    for (const [upper, rate] of TAX_BANDS) {
      if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
      lower = upper;
    }
    return tax;
  }

  // Meet an after-tax need as cheaply as possible. Each person's pension is split into tax-band slices
  // above their State/DB income; ISAs are one tax-free slice. Repeatedly take the cheapest next slice,
  // so personal allowances fill first (pensions before ISAs at 0%), then ISAs, then basic rate, etc.
  function drawdown(need, guaranteedBy, pensionAvailable, isaAvailable) {
    const queues = guaranteedBy.map((g, i) => {
      const slices = [];
      let lower = 0;
      for (const [upper, rate] of TAX_BANDS) {
        const from = Math.max(lower, g);
        if (upper > from) slices.push({ person: i, rate: rate * TAXABLE, gross: (upper - from) / TAXABLE });
        lower = upper;
      }
      return slices;
    });
    queues.push([{ isa: true, rate: 0, gross: isaAvailable }]);

    const fromPension = guaranteedBy.map(() => 0);
    const pensionLeft = pensionAvailable.slice();
    let fromIsa = 0;
    let left = need;
    while (left > 1e-6) {
      let best = null;
      for (const q of queues) {
        while (q.length && (q[0].isa ? q[0].gross : Math.min(q[0].gross, pensionLeft[q[0].person])) <= 1e-9) q.shift();
        if (q.length && (!best || q[0].rate < best[0].rate)) best = q;
      }
      if (!best) break;
      const s = best[0];
      const cap = s.isa ? s.gross : Math.min(s.gross, pensionLeft[s.person]);
      const take = Math.min(cap, left / (1 - s.rate));
      left -= take * (1 - s.rate);
      s.gross -= take;
      if (s.isa) fromIsa += take;
      else { fromPension[s.person] += take; pensionLeft[s.person] -= take; }
    }
    return { fromPension, fromIsa, left: Math.max(0, left) };
  }

  function simulate(data) {
    const people = (data && data.people) || [];
    if (!people.length) return { rows: [], runOut: null, startYear: new Date().getFullYear() };

    const p1 = people[0];
    const findPerson = (id) => people.find((p) => p.id === id) || p1;
    const startYear = new Date().getFullYear();
    const startAge = num(p1.age);
    const endAge = num(data.settings && data.settings.endAge, 100);
    const years = Math.max(0, Math.floor(endAge - startAge));

    const pot = (kind) => (p) => ({
      kind,
      owner: findPerson(p.ownerId),
      growth: num(p.growth) / 100,
      monthly: num(p.monthly),
      bal: Math.max(0, num(p.balance)),
      // Owner's age when a pension can first be drawn from. ISAs can be used any time.
      accessAge: kind === 'pension' ? num(p.accessAge, -Infinity) : -Infinity,
    });
    const pots = (data.pots || []).map(pot('pension')).concat((data.isas || []).map(pot('isa')));
    const dbs = (data.db || []).map((d) => ({
      owner: findPerson(d.ownerId),
      annual: num(d.annual),
      startAge: num(d.startAge),
    }));
    const bands = (data.drawdown || [])
      .filter((b) => b.fromAge !== '' && b.fromAge !== undefined)
      .slice()
      .sort((a, b) => num(a.fromAge) - num(b.fromAge));

    const rows = [];
    let runOut = null;
    let gap = null;

    for (let y = 0; y <= years; y++) {
      const age = startAge + y;
      const ageOf = (person) => num(person.age) + y;

      // Each person's State and DB pensions, which are taxed before anything is drawn.
      const guaranteedBy = people.map(() => 0);
      let statePension = 0;
      people.forEach((p, i) => {
        if (ageOf(p) >= num(p.statePensionAge, Infinity)) {
          statePension += num(p.statePension);
          guaranteedBy[i] += num(p.statePension);
        }
      });
      let dbIncome = 0;
      for (const d of dbs) {
        if (ageOf(d.owner) >= d.startAge) {
          dbIncome += d.annual;
          guaranteedBy[people.indexOf(d.owner)] += d.annual;
        }
      }
      const guaranteed = statePension + dbIncome;
      const guaranteedNet = guaranteed - guaranteedBy.reduce((t, g) => t + incomeTax(g), 0);

      // Contributions stop when the pot's owner retires.
      let contributions = 0;
      let startTotal = 0;
      let startIsas = 0;
      let isaAvailable = 0;
      const pensionAvailable = people.map(() => 0);
      for (const p of pots) {
        if (p.kind === 'isa') startIsas += p.bal;
        p.c = ageOf(p.owner) < num(p.owner.retireAge, Infinity) ? p.monthly * 12 : 0;
        p.open = ageOf(p.owner) >= p.accessAge;
        contributions += p.c;
        startTotal += p.bal;
        if (p.open && p.kind === 'isa') isaAvailable += p.bal + p.c;
        else if (p.open) pensionAvailable[people.indexOf(p.owner)] += p.bal + p.c;
      }
      const available = isaAvailable + pensionAvailable.reduce((t, a) => t + a, 0);
      const locked = startTotal + contributions - available;

      // Target income (after tax): the band that applies at person 1's age this year.
      // Pensions and ISAs only need to cover what the State and DB pensions don't.
      let band = null;
      for (const b of bands) if (num(b.fromAge) <= age) band = b;
      const target = band ? num(band.value) : null;
      const need = band ? Math.max(0, target - guaranteedNet) : 0;

      const { fromPension, fromIsa, left } = drawdown(need, guaranteedBy, pensionAvailable, isaAvailable);
      const withdrawn = fromIsa + fromPension.reduce((t, w) => t + w, 0);
      const taxBy = guaranteedBy.map((g, i) => incomeTax(g + fromPension[i] * TAXABLE));
      const tax = taxBy.reduce((t, x) => t + x, 0);

      // Take each person's share from their open pensions, and ISAs from all open ISAs, in proportion
      // to size. Flows happen mid-year so earn half a year's growth.
      let growth = 0;
      let endTotal = 0;
      const fromPot = { pension: 0, isa: 0 };
      const endPot = { pension: 0, isa: 0 };
      for (const p of pots) {
        let out = 0;
        if (p.open && p.kind === 'isa') out = isaAvailable > 0 ? fromIsa * (p.bal + p.c) / isaAvailable : 0;
        else if (p.open) {
          const i = people.indexOf(p.owner);
          out = pensionAvailable[i] > 0 ? fromPension[i] * (p.bal + p.c) / pensionAvailable[i] : 0;
        }
        const net = p.c - out;
        const g = (p.bal + net / 2) * p.growth;
        p.bal = Math.max(0, p.bal + net + g);
        growth += g;
        endTotal += p.bal;
        fromPot[p.kind] += out;
        endPot[p.kind] += p.bal;
      }

      const shortfall = left;
      // A shortfall while money is still locked in pensions is a bridge gap, not running out.
      if (shortfall > 0.5 && locked > 0.5 && !runOut) {
        if (!gap) gap = { fromAge: age, toAge: age, year: startYear + y, total: 0 };
        gap.toAge = age;
        gap.total += shortfall;
      } else if (shortfall > 0.5 && !runOut) {
        runOut = { year: startYear + y, age, shortfall };
      }

      rows.push({
        year: startYear + y,
        age,
        ages: people.map(ageOf),
        contributions,
        growth,
        statePension,
        dbIncome,
        withdrawn,
        fromPensions: fromPot.pension,
        fromIsas: fromPot.isa,
        target,
        gross: guaranteed + withdrawn,
        tax,
        taxBy,
        income: guaranteed + withdrawn - tax,
        shortfall: shortfall > 0.5 ? shortfall : 0,
        startTotal,
        startIsas,
        endTotal,
        endPensions: endPot.pension,
        endIsas: endPot.isa,
        locked,
      });
    }

    return { rows, runOut, gap, startYear };
  }

  const api = { simulate, num, incomeTax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PensionModel = api;
})(this);
