// TEMPORARY design-review capture (not part of the suite); deleted after the finance redesign.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures.js';
import { decided, expenseBody, paymentBody, submit } from '../api/finance-approval-helpers.mjs';
import { approvalTeams } from '../api/finance-approval-helpers.mjs';
import { memberPage } from './assign-helpers.js';

const dir = process.env.DESIGN_SHOTS_DIR;
const sizes = [
  ['desktop', 1280, 900],
  ['mobile', 390, 844],
];

async function capture(page, name, prepare) {
  mkdirSync(dir, { recursive: true });
  for (const theme of ['light', 'dark'])
    for (const [label, width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        document.documentElement.style.colorScheme = value;
      }, theme);
      if (prepare) await prepare();
      await page.waitForTimeout(350);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (wide) console.log(`OVERFLOW ${name} ${label} ${theme}`);
      await page.screenshot({ path: join(dir, `${name}-${label}-${theme}.png`), fullPage: name !== 'dashboard' && !(await page.getByRole('dialog').count()) });
    }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
}

test('finance design capture', async ({ browser }) => {
  test.setTimeout(300000);
  const prefix = 'design-fin';
  const team = await approvalTeams(prefix, { agreement: true });
  const { admin, agent, approver } = team;
  const pay = (amountFils, extra = {}) =>
    submit(agent, admin, 'payments', paymentBody(team.deal.dealId, { amountFils, ...extra }));
  await decided(approver, admin, 'payments', await pay(1_000_000, { reference: 'TRX-88213' }), 'approve');
  await pay(200_000, { reference: 'Bank slip 4471' });
  await pay(300_000);
  await decided(approver, admin, 'payments', await pay(70_000), 'reject', {
    reason: 'Bank slip missing — please attach the transfer confirmation.',
  });
  const toVoid = await decided(approver, admin, 'payments', await pay(150_000), 'approve');
  await decided(admin, admin, 'payments', toVoid, 'void', { reason: 'Duplicate of PAY entry' });
  await submit(agent, admin, 'expenses', expenseBody({ receiptUrl: 'https://receipts.example.com/r/123' }));
  const exp = await submit(agent, admin, 'expenses', expenseBody({ amountFils: 1_250_000, category: 'Photography', supplier: 'Synthetic Studio LLC' }));
  await decided(approver, admin, 'expenses', exp, 'approve');

  const { page } = await memberPage(browser, `${prefix}-admin@team-fixture.test`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const go = async (route) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/dashboard');
    await page.goto(`/#/${route}`);
    await page.waitForTimeout(800);
  };
  const queue = () => page.getByRole('button', { name: /Awaiting approval/ }).click();
  const scenes = [
    ['payments', 'payments', null],
    ['payments-queue', 'payments', queue],
    ['payment-details', 'payments', async () => {
      const code = (await page.locator('.entry-table tbody tr').nth(3).locator('.id-link').innerText()).trim();
      await page.getByRole('button', { name: `Open ${code}`, exact: true }).first().click();
      const details = page.getByRole('dialog', { name: code, exact: true });
      await details.getByRole('button', { name: /history/ }).click().catch(() => {});
      await page.waitForTimeout(800);
    }],
    ['reject-dialog', 'payments', async () => {
      await queue();
      await page.locator('.entry-table').getByRole('button', { name: /^Reject / }).first().click();
    }],
    ['payment-form', 'payments', () => page.getByRole('button', { name: 'Record payment' }).first().click()],
    ['expenses', 'expenses', null],
    ['deals', 'deals', null],
    ['dashboard', 'dashboard', null, () => page.getByRole('region', { name: 'Finance at a glance' }).scrollIntoViewIfNeeded()],
    ['team-finance', 'team-access', () => page.getByRole('button', { name: 'Finance settings', exact: true }).click()],
  ];
  const only = process.env.DESIGN_SCENES?.split(',');
  for (const [name, route, setup, prepare] of scenes) {
    if (only && !only.includes(name)) continue;
    for (let attempt = 0; attempt < 3; attempt += 1)
      try {
        await go(route);
        if (setup) await setup();
        await capture(page, name, prepare);
        break;
      } catch (error) {
        console.log(`RETRY ${name}: ${error.message.split('\n')[0]}`);
      }
  }
});
