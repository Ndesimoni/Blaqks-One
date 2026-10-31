import { test, expect } from './fixtures.js';
import {
  aed,
  approvalTeam,
  checkLayout,
  decided,
  expenseBody,
  layouts,
  memberPage,
  overview,
  paymentBody,
  submit,
} from './finance-payments-fixtures.js';

/** Collects every `GET /finance` body the page receives. */
function watchOverviews(page) {
  const bodies = [];
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname.endsWith('/finance'))
      bodies.push(await response.json().catch(() => null));
  });
  return bodies;
}

const panelOf = (page) => page.getByRole('region', { name: 'Finance at a glance' });
const figure = (page, id) => panelOf(page).locator(`[data-figure="${id}"] dd`);

test('Dashboard finance equals the API totals; the own view never shows company figures', async ({
  browser,
}) => {
  const team = await approvalTeam('fin-ui-dash');
  const { admin, agent, approver } = team;
  const pay = (amountFils) =>
    submit(agent, admin, 'payments', paymentBody(team.deal.dealId, { amountFils }));
  await decided(approver, admin, 'payments', await pay(1_000_000), 'approve');
  await pay(70_000);
  await submit(agent, admin, 'expenses', expenseBody());
  const company = await submit(admin, admin, 'expenses', expenseBody({ amountFils: 300_000 }));
  await decided(approver, admin, 'expenses', company, 'approve');
  const own = await overview(agent, admin);
  const teamView = await overview(admin);
  expect(teamView.teamTotals.pendingCount).toBe(2);

  const agentPage = await memberPage(browser, team.people.agent.email);
  const bodies = watchOverviews(agentPage.page);
  await agentPage.page.goto('/#/dashboard');
  const panel = panelOf(agentPage.page);
  await expect(panel.getByRole('heading', { name: 'Your finance' })).toBeVisible();
  await expect(figure(agentPage.page, 'earned')).toHaveText(aed(own.statement.totals.earnedFils));
  await expect(figure(agentPage.page, 'received')).toHaveText(
    aed(own.statement.totals.receivedShareFils),
  );
  await expect(figure(agentPage.page, 'outstanding')).toHaveText(
    aed(own.statement.totals.outstandingFils),
  );
  await expect(panel.locator('.finance-widget')).toHaveCount(3);
  await expect(panel.getByText('Your submissions awaiting approval')).toBeVisible();
  await expect(panel.locator('.finance-widget-count')).toHaveText('2');
  const html = await agentPage.page.content();
  // The company share equals the agent's own 50% here, so team-only sums are checked instead.
  const { grossFils, receivedFils, expensesApprovedFils } = teamView.teamTotals;
  for (const hidden of ['Company share', 'Fees earned', 'Approved expenses'])
    expect(html, hidden).not.toContain(hidden);
  for (const fils of [grossFils, receivedFils, expensesApprovedFils])
    expect(html, String(fils)).not.toContain(aed(fils));
  const body = bodies.find((value) => value?.scope);
  expect(body.scope).toBe('own');
  expect(Object.keys(body)).not.toContain('teamTotals');
  for (const layout of layouts) await checkLayout(agentPage.page, layout, 'dashboard-finance-own');
  await agentPage.context.close();

  const adminPage = await memberPage(browser, team.people.admin.email);
  await adminPage.page.goto('/#/dashboard');
  await expect(
    panelOf(adminPage.page).getByRole('heading', { name: 'Team finance' }),
  ).toBeVisible();
  const totals = teamView.teamTotals;
  for (const [id, fils] of [
    ['fees', totals.grossFils],
    ['company', totals.companyFils],
    ['received', totals.receivedFils],
    ['outstanding', totals.outstandingFils],
    ['vat', totals.vatFils],
    ['expenses', totals.expensesApprovedFils],
  ])
    await expect(figure(adminPage.page, id)).toHaveText(aed(fils));
  expect([totals.receivedFils, totals.expensesApprovedFils]).toEqual([1_000_000, 300_000]);
  await expect(panelOf(adminPage.page).locator('.finance-widget-count')).toHaveText('2');
  for (const layout of layouts) await checkLayout(adminPage.page, layout, 'dashboard-finance-team');
  await adminPage.page.setViewportSize({ width: 1280, height: 900 });
  await panelOf(adminPage.page).getByRole('button', { name: 'Review expenses' }).click();
  await expect(adminPage.page.locator('.page-heading h1')).toHaveText('Business expenses');
  const chip = adminPage.page.getByRole('button', { name: /Awaiting approval/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(adminPage.page.getByRole('table', { name: 'Expenses' })).toContainText(
    'Pending approval',
  );
  await expect(adminPage.page.getByRole('table', { name: 'Expenses' })).not.toContainText(
    'Approved',
  );
  await adminPage.context.close();
});
