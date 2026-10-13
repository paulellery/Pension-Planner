# Known gaps and limitations

Everything the planner simplifies or leaves out, to review and pick from later. Each item notes which way it is likely to push the results.

**Direction:** ⬆ results look better than reality · ⬇ look worse · ↕ could go either way

## Deferred

| Gap | Effect | Notes |
|---|---|---|
| **Earnings / working past retirement.** There is no salary, so a person who keeps working (e.g. person 2 for two more years) adds no income towards the target. Their retirement age only stops their payments in. | ⬇ | Add "Earnings £/yr until retirement" per person. It would count towards the target and be taxed, with National Insurance. |

## Income tax

| Gap | Effect | Notes |
|---|---|---|
| Bands are held level in today's money. In reality they are frozen in cash terms until at least April 2028, so they shrink after inflation and more income is taxed. | ⬆ | Option to hold bands flat in cash terms until a chosen year, then rise with inflation. |
| England, Wales & NI only. No Scottish rates. | ↕ | Add a region setting with Scottish bands. |
| Every pension withdrawal is 25% tax free (like a UFPLS). There is no option to take the tax-free cash as one lump sum up front. | ↕ | Option per pension: lump sum at access age, or 25% of each withdrawal. |
| No £268,275 cap on lifetime tax-free cash (the Lump Sum Allowance). | ⬆ for large pots | Track tax-free cash used per person; once it hits the cap, withdrawals are fully taxable. |
| **Decision (for now):** all savings are treated as ISAs, so interest and withdrawals are untaxed. Cash savings outside an ISA would really be taxed on interest above the Personal Savings Allowance. | ⬆ small | If needed: separate cash savings type, tax interest above the PSA. |
| No Marriage Allowance, dividend or savings allowances. | ⬇ slightly | Marriage Allowance only matters if one person's income is under £12,570. |
| No National Insurance. That's fine while there's no earnings income (see Deferred). | — | Needed alongside earnings. |
| Tax is minimised one year at a time, not across the whole retirement. It can use up ISAs early and then pay more tax later, or miss drawing extra pension at 0–20% in good years to save higher-rate tax later. | ⬇ | Smooth taxable income over the years, or let the user set a fixed amount to draw from pensions each year. |
| Pension is only drawn when needed. It never draws extra just to use up a personal allowance (e.g. moving it into an ISA). | ⬇ | Option to always fill each person's allowance. |
| Payments in are taken as gross, including tax relief. Higher-rate relief and the salary sacrifice / net pay difference aren't shown. | ↕ | Enter net payments and add relief by band. |
| No Annual Allowance (£60k, tapered) or Money Purchase Annual Allowance (£10k after first flexible withdrawal). | ⬆ for big savers | Warn when payments in exceed the limits. |

## People, State and DB pensions

| Gap | Effect | Notes |
|---|---|---|
| No death or survivor modelling. The household target carries on unchanged, both State pensions continue, and DB survivor pensions and inheriting pots aren't modelled. | ↕ | Life expectancy per person; survivor % on DB; reduced target for one person. |
| Pensions passed on at death will face inheritance tax from April 2027. Not modelled. | — | Only relevant once death is modelled. |
| Target income is keyed on the first person's age. | — | Fine for couples of similar age; odd with big age gaps. |
| State pension is a fixed real amount. No triple-lock growth above inflation, deferral uplift or contracted-out reductions. | ⬇ slightly | Optional real growth % for the State pension. |
| DB pensions are assumed to rise with inflation. No early/late retirement factors, no commutation to a lump sum, no caps on increases. | ⬆ if increases are capped | Increase cap and early retirement reduction per scheme. |
| Ages step in whole years. Birthdays, State pension start dates and tax years (April–April) don't line up. | ↕ small | Monthly steps if precision matters. |

## Investments and pots

| Gap | Effect | Notes |
|---|---|---|
| Income, Total and Table use steady growth: the same real return every year, so they show no sequence-of-returns risk. The **Chances** tab covers this with random returns. | ⬆ on those tabs | — |
| Chances: each year's return is independent. No slumps lasting several years beyond chance (2000–02), and no bounce-backs after crashes. | ↕ | Historical replay or a model with memory. |
| Chances: returns are only mildly fat-tailed (Student-t, capped at about −55% in a year). Crashes are likelier than with a normal curve, but probably still rarer than history. | ⬆ slightly | Tune the tail or add an explicit crash probability. |
| Chances: volatility is fixed at 16% (global equities) and isn't a setting. Sterling moves, which have softened global crashes for UK investors, are ignored. | ↕ | Make it a setting if the strategy changes. |
| Chances: spending is fixed whatever markets do. Real people cut back after a crash, so results are a bit pessimistic. | ⬇ | Spending guardrails (cut target X% after a bad year). |
| Inflation is ignored, so growth must be entered above inflation. Easy to enter a nominal rate by mistake. | ⬆ if misentered | Hinted on the field. |
| One growth rate for every pot (all global index funds), after fees. Fee differences between platforms aren't modelled. | ↕ small | Fee % per pot if they differ a lot. |
| Payments in are flat in today's money until retirement. No pay rises, no step changes, no stopping/starting. | ↕ | Escalation % or dated changes. |
| ISA £20k a year allowance is not enforced. | ⬆ if exceeded | Warn above £20k/person/year. |
| Withdrawals are split across a person's open pensions (and across all ISAs) in proportion to size. You can't choose which pot goes first. | ↕ | Draw order per pot. |
| New pensions default to access age 57; existing pensions saved before access ages were added default to "any time". Protected pension ages aren't flagged. | ⬆ if not set | Prompt to set access age on old saves. |
| No annuities. All pension income is drawdown. | ↕ | Option to buy an annuity with part of a pot at a given age. |
| No one-off events: big spends (car, wedding, home repairs), downsizing, inheritances received, mortgage payoff. | ↕ | Dated one-off income/spend list. |

## What if

| Gap | Effect | Notes |
|---|---|---|
| Only three levers: first target band, % change to pension payments, first person's retirement age. | — | Add more as needed (growth rate, second person's retirement age, ISA payments). |
| Changing retirement age also moves the first target band by the same years. | — | Deliberate; revisit if confusing. |
| One scenario at a time, compared against the plan. No saved or named scenarios, no side-by-side of several. | — | Save named scenarios. |

## App

| Gap | Effect | Notes |
|---|---|---|
| Data lives only in this browser (localStorage). Clearing site data loses it unless exported. | — | Remind to export; optional cloud sync. |
| Old saves move pots into ISAs only if the name contains "ISA". | — | Check Details after upgrading. |
| "Gap before pensions open" is reported as one age range with a total, even if there are two separate gaps (e.g. one per person). | — | List each gap. |
| No automated tests. The model has been checked by hand against HMRC figures and worked examples. | — | Add Node tests for `model.js` (it already runs in Node). |
