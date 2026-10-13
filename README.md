# Pension Planner

A single-page retirement planner that runs entirely in the browser. Open `index.html`. There is no build step and no server.

It models:

- **Multiple people**, each with a current age, a retirement age and a State Pension (amount and start age).
- **Multiple pots** (pensions, ISAs, savings), each with an owner, a current value, monthly payments in (which stop at the owner's retirement age) and its own growth rate.
- **Defined benefit pensions**, each paying a fixed amount a year from the owner's chosen age.
- **Target household income by age band**, keyed on the first person's age. State and defined benefit pensions count towards the target first, and the pots are drawn down only for the rest.

It shows when the money runs out: the first year the pots can't make up the gap to the target income.

Assumptions:

- Everything is in today's money, so inflation is ignored and growth rates should be real (above inflation).
- Tax is ignored.
- It steps through the years annually. Payments in and withdrawals happen mid-year, and withdrawals are taken from each pot in proportion to its size.

Data is saved to `localStorage` in the browser. Use **Export** and **Import** to back it up or move it to another device.
