import { test, expect } from './fixtures.js';
import {
  aed,
  approvalTeam,
  checkLayout,
  entryRow,
  layouts,
  memberPage,
  openEntries,
  overview,
} from './finance-payments-fixtures.js';

test('an agent records a payment, another approver approves it, and the statement and dashboard follow', async ({
  browser,
}) => {
  const team = await approvalTeam('fin-ui-pay');
  const { agent, approver } = team.people;
  const dealId = team.deal.dealId;

  const own = await memberPage(browser, agent.email);
  await openEntries(own.page, 'payments');
  await expect(own.page.getByRole('button', { name: /Awaiting approval/ })).toHaveCount(0);
  // The empty list repeats its Add action.
  await own.page.getByRole('button', { name: 'Record payment', exact: true }).first().click();
  const form = own.page.getByRole('dialog', { name: 'Record payment' });
  const picker = form.getByLabel('Earned deal');
  await expect(picker.locator('option')).toHaveText(['Choose an earned deal', new RegExp(dealId)]);
  await form.getByRole('button', { name: 'Submit payment', exact: true }).click();
  await expect(form.getByText('Choose an earned deal.', { exact: true })).toBeVisible();
  await expect(picker).toBeFocused();
  await picker.selectOption(dealId);
  await form.getByLabel('Amount received').fill('10,000.001');
  await form.getByRole('button', { name: 'Submit payment', exact: true }).click();
  await expect(form.getByText(/up to two decimal places/)).toBeVisible();
  await form.getByLabel('Amount received').fill('10,000');
  await form.getByLabel('Reference').fill('INV-2001');
  const estimate = form.getByRole('definition').filter({ hasText: 'AED' });
  await expect(estimate).toHaveText([aed(4_900_000), aed(50_000), aed(1_050_000)]);
  for (const layout of layouts) await checkLayout(own.page, layout, 'payment-form');
  await own.page.setViewportSize({ width: 1280, height: 900 });
  await form.getByRole('button', { name: 'Submit payment', exact: true }).click();
  await expect(form).toHaveCount(0);

  const [payment] = (await overview(team.agent, team.admin)).payments;
  expect([payment.status, payment.amountFils, payment.vatFils]).toEqual(['pending', 1e6, 5e4]);
  const row = entryRow(own.page, 'payments', payment.paymentId);
  await expect(row).toContainText('Pending approval');
  await expect(row).toContainText(aed(1_000_000));
  await expect(row.getByRole('button', { name: /^Approve/ })).toHaveCount(0);

  const review = await memberPage(browser, approver.email);
  await openEntries(review.page, 'payments', { queue: true });
  const chip = review.page.getByRole('button', { name: /Awaiting approval/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toContainText('1');
  for (const layout of layouts) await checkLayout(review.page, layout, 'payments-queue');
  await review.page.setViewportSize({ width: 1280, height: 900 });
  const queued = entryRow(review.page, 'payments', payment.paymentId);
  await queued.getByRole('button', { name: `Approve ${payment.paymentId}` }).click();
  await expect(review.page.getByText('Nothing is awaiting approval')).toBeVisible();
  await chip.click();
  await expect(queued).toContainText('Approved');

  const after = await overview(team.agent, team.admin);
  expect(after.statement.totals.receivedShareFils).toBe(500_000);
  await own.page.goto('/#/deals');
  await own.page.getByRole('button', { name: 'Commission statement', exact: true }).click();
  const totals = own.page.getByRole('definition');
  await expect(
    totals.filter({ hasText: aed(after.statement.totals.receivedShareFils) }),
  ).toHaveCount(1);
  await own.page.goto('/#/dashboard');
  const panel = own.page.getByRole('region', { name: 'Finance at a glance' });
  const figure = (id) => panel.locator(`[data-figure="${id}"] dd`);
  await expect(figure('earned')).toHaveText(aed(after.statement.totals.earnedFils));
  await expect(figure('received')).toHaveText(aed(after.statement.totals.receivedShareFils));
  await expect(figure('outstanding')).toHaveText(aed(after.statement.totals.outstandingFils));

  const teamView = await overview(team.approver, team.admin);
  await review.page.goto('/#/dashboard');
  const teamPanel = review.page.getByRole('region', { name: 'Finance at a glance' });
  await expect(teamPanel.locator('[data-figure="received"] dd')).toHaveText(
    aed(teamView.teamTotals.receivedFils),
  );
  expect(teamView.teamTotals.receivedFils).toBe(1_000_000);
  await own.context.close();
  await review.context.close();
});
