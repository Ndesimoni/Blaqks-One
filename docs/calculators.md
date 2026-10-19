# UAE calculators

Status: packets Q3 purchase costs, Q4 mortgage repayment, Q5 rental yield/ROI and Q6 off-plan payment schedule implemented 2026-10-19. They are client-side only and save no records.

## Purchase costs

`src/lib/finance/calculators.js` holds the pure calculation. Inputs are whole fils and basis points; every line rounds half-up to the fils through the same helper as the commission engine.

| Line              | Default  | Basis           |
| ----------------- | -------- | --------------- |
| DLD transfer fee  | 4%       | Property price  |
| Agency fee        | 2%       | Property price  |
| VAT on agency fee | 5% (UAE) | Agency fee only |

The defaults are editable in the screen and are labelled as starting points, not legal advice. Clearing a rate restores its default. VAT never applies to the property price or the DLD fee in this estimate.

## Mortgage repayment

`src/lib/finance/mortgage.js` holds the annuity estimate. It uses the standard formula
`M = P · r(1+r)^n / ((1+r)^n − 1)` with the annual rate in basis points and the term in whole
months, then rounds the monthly payment half-up to the fils.

- **Zero rate:** the monthly payment is the principal divided by the months and rounded
  half-up, while total repayment equals the principal exactly, so no interest appears.
- **Invalid input:** a down payment above the price, a term outside 1–50 whole years, a rate
  outside 0–100%, or any non-integer amount is refused.
- The screen shows loan amount, monthly payment, total interest and total repaid. Bank fees
  and insurance are explicitly outside the estimate, and nothing is saved.

## Rental yield and ROI

`src/lib/finance/yield.js` reports the measurements separately:

- **Gross yield:** annual rent ÷ property value.
- **Net yield:** (annual rent − annual costs) ÷ property value.
- **ROI:** annual net income ÷ cash invested.

Percentages are signed and rounded half-up to one basis point. A zero property value leaves
both yields blank and a zero cash investment leaves ROI blank, instead of dividing by zero.
Negative net income is shown as a loss. The screen labels every figure an estimate and states
that returns are not guaranteed.

## Off-plan payment schedule

`src/lib/finance/offPlan.js` accepts 1–20 milestones with a label, share in basis points and
ISO due date.

- Shares must total exactly 100%; dates must be real calendar days in non-decreasing order.
- Amounts use cumulative shares, so every fils of the price is allocated exactly once and the
  final milestone absorbs rounding.
- The screen shows the schedule table and downloads it as a readable CSV, which can be opened
  in Excel. It never writes to a property or any other record.

## Screen and access

- **Calculators** sits under Resources in the connected navigation and is available to every signed-in role. It needs no API call, workspace record or finance grant, and performs no database write.
- `PurchaseCalculator`, `MortgageCalculator`, `YieldCalculator` and `OffPlanCalculator` use `useI18n()` for every label and format money, percentages and dates with the selected locale (`format.money`, `format.percent`, `format.date`). They use logical CSS properties, visible focus states and `aria-live` result regions.
- English and Arabic catalogues live in `src/i18n/catalogs/{en,ar}/calculators.js`; `npm run check:i18n` enforces parity.

## Tests

`tests/unit/calculators.test.js` covers zero and maximum prices, 0% and 100% rates, half-up rounding to fils, and invalid prices or rates. `tests/unit/mortgage.test.js` covers the standard annuity case, zero-rate repayment, a full down payment, and invalid amounts, rates and terms. `tests/unit/yield.test.js` covers gross and net yield, ROI, zero denominators, negative income, rounding and invalid amounts. `tests/unit/off-plan.test.js` covers exact 100% totals, cumulative rounding, zero and maximum prices, invalid shares/dates/counts and CSV output. The production build, translation parity, boundaries and the unit suite pass. Browser checks for mobile, keyboard, dark mode, English and Arabic remain part of CI; they were not run locally because the Playwright browser binary is not installed on this machine.
