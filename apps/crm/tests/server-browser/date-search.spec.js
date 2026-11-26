import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { overview } from '../api/finance-deals-helpers.mjs';
import { paymentBody, submit } from '../api/finance-approval-helpers.mjs';
import { memberPage, performanceTeam } from './performance-fixtures.js';

const today = () => query(`SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date)::text`);

test('date search finds a follow-up and a payment, rejects a reversed range and hides finance', async ({
  browser,
}) => {
  const team = await performanceTeam('date-search');
  const { admin, agent, lead } = team;
  const day = today();
  const created = await admin.request(`/workspaces/${admin.user.workspaceId}/records/Follow-ups`, {
    method: 'POST',
    body: { record: { activity_id: 'DS-FU-1', due_date: day } },
  });
  expect(created.status).toBe(201);
  const [deal] = (await overview(agent, admin)).deals;
  await submit(agent, admin, 'payments', paymentBody(deal.dealId));

  const adminPage = await memberPage(browser, team.people.admin.email);
  const page = adminPage.page;
  await page.goto('/#/date-search');
  await expect(page.getByRole('region', { name: /connection status/ })).toHaveCount(0);
  // The mockup's form: changes apply with Search.
  const type = page.getByLabel('Records', { exact: true });
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await expect(type.locator('option')).toHaveText([
    'New enquiries',
    'Follow-ups',
    'Viewings',
    'Care appointments',
    'Deals earned',
    'Fee receipts',
    'Expenses paid',
  ]);
  await type.selectOption('Follow-ups');
  await search.click();
  await expect(page.getByRole('button', { name: /DS-FU-1/ })).toBeVisible();
  await type.selectOption('Fee receipts');
  await search.click();
  const payment = page.getByRole('button', { name: /PM-/ });
  await expect(payment).toHaveCount(1);
  await page.getByLabel('From', { exact: true }).fill(day);
  await page.getByLabel('To', { exact: true }).fill('2000-01-01');
  await search.click();
  await expect(page.getByRole('alert')).toContainText('on or after the start date');
  await expect(payment).toHaveCount(0);
  // Clear returns to the last 30 days of the first record type.
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(type).toHaveValue('New enquiries');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await type.selectOption('Fee receipts');
  await page.getByLabel('From', { exact: true }).fill(day);
  await page.getByLabel('To', { exact: true }).press('Enter');
  await payment.click();
  await expect(page).toHaveURL(/#\/payments/);
  await adminPage.context.close();

  const leadPage = await memberPage(browser, team.people.lead.email);
  await leadPage.page.goto('/#/date-search');
  const options = leadPage.page.getByLabel('Records', { exact: true }).locator('option');
  await expect(options).not.toHaveCount(0);
  await expect(options.filter({ hasText: /Deals earned|Fee receipts|Expenses paid/ })).toHaveCount(
    0,
  );
  await expect(leadPage.page.locator('main')).not.toContainText('AED');
  expect(lead).toBeTruthy();
  await leadPage.context.close();
});
