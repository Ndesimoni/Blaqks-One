import { test, expect } from './fixtures.js';
import {
  aed,
  checkLayout,
  createDeal,
  dealCall,
  financeDealTeam,
  heldClient,
  layouts,
  memberPage,
  openDeal,
  openDeals,
} from './finance-deals-fixtures.js';
import { day } from '../api/finance-helpers.mjs';

// Net 49,000.00 with an Admin override of 60% and a 10% second agent from the holder's share.
const [PRIMARY, SECOND, COMPANY] = [2_646_000, 294_000, 1_960_000];
const REASON = 'Private override reason for the Admin only';

test('an agent’s own view shows only their commission, never the company share or reasons', async ({
  browser,
}) => {
  const team = await financeDealTeam('fin-ui-own');
  const { agent, second } = team.people;
  const clientId = await heldClient(team.agent);
  let deal = await createDeal(team.agent, clientId);
  deal = await dealCall(team, deal, 'PUT', '/split', {
    secondAgentId: second.id,
    secondAgentShareBp: 1000,
    overrideAgentShareBp: 6000,
    reason: REASON,
  });
  deal = await dealCall(team, deal, 'POST', '/earn', { earnedOn: day(0) });
  expect(deal.calculation.companyFils).toBe(COMPANY);

  const { page, context } = await memberPage(browser, agent.email);
  const overviews = [];
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith('/finance')) overviews.push(await response.json().catch(() => null));
  });
  await openDeals(page);
  await expect(page.getByRole('button', { name: 'Add deal', exact: true })).toBeVisible();
  const table = page.getByRole('table', { name: 'Deals' });
  await expect(table).toContainText(deal.dealId);
  await expect(table.getByRole('columnheader', { name: 'Your commission' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Holder' })).toHaveCount(0);
  await expect(page.getByLabel('Assigned to')).toHaveCount(0);

  const details = await openDeal(page, deal.dealId);
  const commission = details.getByRole('region', { name: 'Commission' });
  await expect(commission).toContainText('Your commission');
  await expect(commission).toContainText(aed(PRIMARY));
  await expect(commission).toContainText('Adjusted by Admin');
  await expect(commission).toContainText(`Shared with ${second.name}`);
  for (const action of ['Change split', 'Mark earned', 'Revise', 'Unearn', 'Move deal'])
    await expect(details.getByRole('button', { name: action })).toHaveCount(0);
  for (const layout of layouts) await checkLayout(page, layout, 'deal-details-own');
  await page.setViewportSize({ width: 1280, height: 900 });

  const html = await page.content();
  for (const hidden of [aed(COMPANY), aed(SECOND), 'Company share', REASON, 'Split source'])
    expect(html, hidden).not.toContain(hidden);
  await details.getByRole('button', { name: 'Close deal details' }).click();
  await page.getByRole('button', { name: 'Commission statement', exact: true }).click();
  const lines = page.getByRole('table', { name: 'Your statement lines' });
  await expect(lines).toContainText(deal.dealId);
  await expect(lines).toContainText('Adjusted by Admin');
  await expect(page.getByLabel('Agent', { exact: true })).toHaveCount(0);
  for (const layout of layouts) await checkLayout(page, layout, 'deals-statement-own');

  const body = overviews.find((value) => value?.scope);
  expect(body.scope).toBe('own');
  expect(Object.keys(body)).not.toContain('teamTotals');
  expect(JSON.stringify(body)).not.toContain(REASON);
  expect(JSON.stringify(body)).not.toContain(String(COMPANY));
  await context.close();
});
