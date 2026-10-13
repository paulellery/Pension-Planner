// Year-by-year pension projection. All figures are in today's money (no inflation).
// Works in the browser (window.PensionModel) and in Node (module.exports) for testing.
(function (root) {
  'use strict';

  function num(v, fallback) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
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

      let statePension = 0;
      for (const p of people) {
        if (ageOf(p) >= num(p.statePensionAge, Infinity)) statePension += num(p.statePension);
      }
      let dbIncome = 0;
      for (const d of dbs) {
        if (ageOf(d.owner) >= d.startAge) dbIncome += d.annual;
      }
      const guaranteed = statePension + dbIncome;

      // Contributions stop when the pot's owner retires.
      let contributions = 0;
      let startTotal = 0;
      let available = 0;
      let startIsas = 0;
      for (const p of pots) {
        if (p.kind === 'isa') startIsas += p.bal;
        p.c = ageOf(p.owner) < num(p.owner.retireAge, Infinity) ? p.monthly * 12 : 0;
        p.open = ageOf(p.owner) >= p.accessAge;
        contributions += p.c;
        startTotal += p.bal;
        if (p.open) available += p.bal + p.c;
      }
      const locked = startTotal + contributions - available;

      // Target income: the band that applies at person 1's age this year.
      // Pots only need to cover what the State and DB pensions don't.
      let band = null;
      for (const b of bands) if (num(b.fromAge) <= age) band = b;
      const target = band ? num(band.value) : null;
      const need = band ? Math.max(0, target - guaranteed) : 0;

      const withdrawn = Math.min(need, available);

      // Withdraw proportionally across the pots that can be accessed; flows happen mid-year so earn half a year's growth.
      let growth = 0;
      let endTotal = 0;
      const fromPot = { pension: 0, isa: 0 };
      const endPot = { pension: 0, isa: 0 };
      for (const p of pots) {
        const share = p.open && available > 0 ? (p.bal + p.c) / available : 0;
        const net = p.c - withdrawn * share;
        const g = (p.bal + net / 2) * p.growth;
        p.bal = Math.max(0, p.bal + net + g);
        growth += g;
        endTotal += p.bal;
        fromPot[p.kind] += withdrawn * share;
        endPot[p.kind] += p.bal;
      }

      const shortfall = need - withdrawn;
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
        income: guaranteed + withdrawn,
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

  const api = { simulate, num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PensionModel = api;
})(this);
