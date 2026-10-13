# Pension Planner

A single-page retirement planner that runs entirely in the browser. Open `index.html`. There is no build step and no server.

It models:

- **Multiple people**, each with a current age, a retirement age and a State Pension (amount and start age).
- **Pensions**, each with an owner, a current value, monthly payments in (which stop at the owner's retirement age) and an **access age**: the owner's age when it can first be drawn from.
- **ISAs and savings**, set up the same way but with no access age: they can be drawn from any time. All savings are treated as ISAs, so they're tax free.
- **Defined benefit pensions**, each paying a fixed amount a year from the owner's chosen age.
- **Target household income after tax, by age band**, keyed on the first person's age. State and defined benefit pensions count towards the target first, and pensions and ISAs are drawn down only for the rest.

It shows when the money runs out: the first year the pots can't make up the gap to the target income.

Before a pension's access age it is locked: it keeps growing, but nothing is drawn from it. ISAs and savings bridge the years until then. The Income chart, Total chart and Table show pensions and ISAs separately. If they can't cover the target while money is still locked, the summary shows a **gap before pensions open** separately from the money running out.

The page has five tabs: **Details** (everything above), **Income** (income each year), **Total** (total in pots), **Table** (year by year) and **Chances**.

The first four use steady growth: the same return every year. **Chances** runs the plan 1,000 times with random market returns, averaging the growth setting with about 16% volatility (global index funds). One return per year applies to every pot, since they're all invested the same way. Returns are slightly fat-tailed, so big falls come up more often than a normal curve gives, and a fixed seed keeps the results steady between edits. It shows the chance the money lasts to the end age, the bad case (1 run in 10) and typical run-out ages, a fan chart of the total in pots, and the chance the money is still lasting at each age. A run fails at the first shortfall, including a gap before pensions open.

Every tab except Details shares a collapsible **What if** panel (closed by default, with a badge showing how many changes are active) for trying changes without editing your details:

- **Target income** for the first age band.
- **% change to monthly pension payments**, applied to every pension (not ISAs).
- **Retirement age** of the first person. The first target income band moves by the same number of years.

The summary cards show the plan's figure under anything the what-if changes, and the Total chart draws the plan as a dashed line. **Back to my plan** clears the changes.

Assumptions:

- Everything is in today's money, so inflation is ignored. One **investment growth** rate (in Settings) applies to every pension and ISA, since they're all invested the same way. It should be real (above inflation) and after fees.
- **Income tax** uses today's (2025/26) bands for England, Wales & NI, hardcoded and held level: personal allowance £12,570 (lost at £1 per £2 over £100k), 20% to £50,270, 40% to £125,140, 45% above. Each person is taxed separately.
- State and DB pensions are taxable income. 25% of each pension withdrawal is tax free and the rest is taxed; ISA withdrawals are tax free. The £268,275 cap on tax-free cash, National Insurance and Scottish rates are ignored. Monthly payments in are taken as the gross amount, including tax relief.
- Each year the pensions and ISAs make up the after-tax target as cheaply as possible: each person's pension first uses their remaining tax-free allowance, then ISAs, then pensions at basic rate, then higher rates. This is the cheapest choice for each year on its own, not a whole-retirement plan.
- It steps through the years annually. Payments in and withdrawals happen mid-year. A person's withdrawal is split across their open pensions in proportion to size, and ISA withdrawals across all ISAs the same way.

Data is saved to `localStorage` in the browser. Use **Export** and **Import** to back it up or move it to another device.

Known gaps and simplifications are tracked in [LIMITATIONS.md](LIMITATIONS.md).
