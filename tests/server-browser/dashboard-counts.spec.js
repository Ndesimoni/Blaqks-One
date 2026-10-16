import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import {
  dashSection,
  dashboardTeam,
  expectCounts,
  metric,
  priorities as prioritiesOf,
  viewingsPanel,
} from './dashboard-fixtures.js';

const team = (counts) => ({
  Clients: counts,
  Properties: counts,
  'Follow-ups': counts,
  Viewings: counts,
  Contacts: 0,
});

test('an Admin dashboard counts the whole team and narrows to one member’s workload', async ({
  browser,
}) => {
  const { team: fixture, one } = await dashboardTeam('dashadmin');
  const { page, context } = await memberPage(browser, fixture.people.admin.email);
  try {
    await page.goto('/#/dashboard');
    await expect(page.locator('.page-heading h1')).toHaveText('Overview');
    await expect(page.getByRole('region', { name: 'Dashboard connection status' })).toHaveCount(0);
    await expect(page.getByText('Figures from your whole team’s records')).toBeVisible();
    await expectCounts(page, team(2));
    await expect(metric(page, 'ACTIVE LEADS')).toHaveText('2');
    await expect(metric(page, 'PROPERTIES')).toHaveText('2');
    await expect(metric(page, 'FOLLOW-UPS DUE')).toHaveText('2');
    await expect(metric(page, 'UPCOMING VIEWINGS')).toHaveText('2');
    for (const hidden of ['OPEN DEALS', 'FEES RECEIVED', 'Commission performance', 'Deal pipeline'])
      await expect(page.getByText(hidden, { exact: true })).toHaveCount(0);
    await expect(dashSection(page, 'Lead pipeline')).toBeVisible();
    const filter = page.getByLabel('Assigned to', { exact: true });
    await expect(filter.locator('option', { hasText: one.name })).toHaveCount(1);
    await filter.selectOption({ label: one.name });
    await expect(page.getByText('Figures for the selected workload')).toBeVisible();
    await expectCounts(page, team(1));
    await expect(metric(page, 'ACTIVE LEADS')).toHaveText('1');
    await expect(page.getByText('Call Dash hidden client')).toHaveCount(0);
    await filter.selectOption({ label: 'Everyone' });
    await expectCounts(page, team(2));
  } finally {
    await context.close();
  }
});

test('an assigned-only member counts only their own records and never a hidden one', async ({
  browser,
}) => {
  const { one } = await dashboardTeam('dashstaff');
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/dashboard');
    await expect(page.getByText('Figures from the records assigned to you')).toBeVisible();
    await expectCounts(page, team(1));
    await expect(metric(page, 'ACTIVE LEADS')).toHaveText('1');
    await expect(metric(page, 'PROPERTIES')).toHaveText('1');
    await expect(metric(page, 'FOLLOW-UPS DUE')).toHaveText('1');
    await expect(metric(page, 'UPCOMING VIEWINGS')).toHaveText('1');
    await expect(page.getByLabel('Assigned to', { exact: true })).toHaveCount(0);
    const priorities = prioritiesOf(page);
    await expect(priorities).toContainText('Call Dash client one');
    await expect(priorities).toContainText('Dash client one');
    const viewings = viewingsPanel(page);
    await expect(viewings).toContainText('Dash Marina listing');
    for (const secret of ['Dash hidden client', 'Call Dash hidden client', 'Dash hidden listing'])
      await expect(page.getByText(secret)).toHaveCount(0);
    const pipeline = dashSection(page, 'Lead pipeline');
    await expect(pipeline).toContainText('Qualified');
    await expect(pipeline).not.toContainText('New');
    const sources = dashSection(page, 'Lead sources');
    await expect(sources).toContainText('Bayut');
    await expect(sources).not.toContainText('Referral');
    await page.getByRole('button', { name: 'Clients: 1 record', exact: true }).click();
    await expect(page).toHaveURL(/#\/clients$/);
  } finally {
    await context.close();
  }
});
