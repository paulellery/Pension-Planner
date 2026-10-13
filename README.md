# Pension Planner

A single-page retirement planner that runs entirely in the browser. Open `index.html`. There is no build step and no server.

It models:

- **Multiple people**, each with a current age, a retirement age and a State Pension (amount and start age).
- **Multiple pots** (pensions, ISAs, savings), each with an owner, a current value, monthly payments in (which stop at the owner's retirement age) and its own growth rate.
- **Defined benefit pensions**, each paying a fixed amount a year from the owner's chosen age.
- **A drawdown plan by age band.** Each band is keyed on the first person's age and is either:
  - an *income target*, where pots top up the State Pension and defined benefit pensions to reach a total household income, or
  - a *percentage* of the pots withdrawn each year.

It shows when the money runs out: the first year the pots can't cover the planned drawdown.

Assumptions:

- Everything is in today's money, so inflation is ignored and growth rates should be real (above inflation).
- Tax is ignored.
- It steps through the years annually. Payments in and withdrawals happen mid-year, and withdrawals are taken from each pot in proportion to its size.

Data is saved to `localStorage` in the browser. Use **Export** and **Import** to back it up or move it to another device.
