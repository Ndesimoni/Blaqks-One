import { test, expect } from './fixtures.js';
import {
  createDeal,
  financeDealTeam,
  heldClient,
  memberPage,
  noPageOverflow,
  openDeals,
} from './finance-deals-fixtures.js';

/** This and next month in Dubai time, as `YYYY-MM-DD` target close dates. */
function targets() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const [year, month] = day.split('-').map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return { now: `${day.slice(0, 7)}-15`, later: `${next}-15` };
}

test('Deals list: the mockup columns, Closing this month and the kept filters', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await financeDealTeam('fin-ui-list');
  const clientId = await heldClient(team.admin);
  const { now, later } = targets();
  const closing = await createDeal(team.admin, clientId, {
    stage: 'Negotiation',
    details: { target_close_date: now },
  });
  const nextMonth = await createDeal(team.admin, clientId, {
    stage: 'Offer',
    details: { target_close_date: later },
  });
  const done = await createDeal(team.admin, clientId, {
    stage: 'Completed',
    details: { target_close_date: now },
  });
  const { page, context } = await memberPage(browser, team.people.admin.email);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDeals(page);
  const table = page.getByRole('table', { name: 'Deals' });
  await expect(table.getByRole('columnheader')).toHaveText([
    'Deal',
    'Client',
    'Value',
    'Stage',
    'Agent',
    'Company share',
  ]);
  await expect(table).toContainText('Sale deal');
  await expect(table).toContainText('AED 2,450,000.00');

  // The mockup's preset: open deals whose target close date is this month.
  await page.getByRole('button', { name: 'Closing this month', exact: true }).click();
  await expect(table).toContainText(closing.dealId);
  for (const other of [nextMonth, done]) await expect(table).not.toContainText(other.dealId);

  // Kept filters: Stage narrows within the preset, Clear filters keeps the preset.
  const filters = page.getByRole('group', { name: 'Deal filters' });
  await filters.getByLabel('Stage').selectOption('Offer');
  await expect(page.getByRole('heading', { name: 'No matching deals' })).toBeVisible();
  await filters.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(table).toContainText(closing.dealId);
  await expect(filters.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);

  // Target close is one tick away in the column chooser.
  await page.getByRole('button', { name: 'Choose columns' }).click();
  await page.getByRole('checkbox', { name: 'Target close' }).check();
  await expect(table.getByRole('columnheader', { name: 'Target close' })).toBeVisible();

  // Phones keep the filters behind Filters.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(filters.getByLabel('Stage')).toBeHidden();
  await filters.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(filters.getByLabel('Stage')).toBeVisible();
  await noPageOverflow(page);
  await context.close();
});
