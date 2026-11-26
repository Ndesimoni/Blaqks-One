import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow } from './assign-helpers.js';
import { dubaiDay } from './dashboard-fixtures.js';

const tile = (page, label) =>
  page
    .getByRole('region', { name: 'Insight figures' })
    .locator('.kpi-tile')
    .filter({ hasText: label });

test('CRM insights: the mockup tiles and findings over each member’s own records', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await assignTeam('insights');
  const today = dubaiDay();
  const client = (client_id, extra, holder) =>
    held(
      team,
      'Clients',
      { client_id, full_name: `Synthetic ${client_id}`, date_added: today, ...extra },
      holder,
    );
  await client('CL-IN-1', { lead_source: 'Website', lead_stage: 'Negotiation' });
  await client('CL-IN-2', { lead_source: 'Instagram', lead_stage: 'Viewing' });
  await client('CL-IN-3', { lead_source: 'Website', lead_stage: 'New' }, team.people.one.id);
  await client('CL-IN-4', { lead_source: 'Referral', date_added: '2026-01-05' });
  for (const id of ['CL-IN-1', 'CL-IN-2'])
    await held(team, 'Viewings', {
      client_id: id,
      appointment_date_time: `${today} 10:00`,
      viewing_status: 'Completed',
    });

  const admin = await memberPage(browser, team.people.admin.email);
  try {
    const page = admin.page;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/crm-insights');
    // Three new leads this month (two from the website); one of two viewed clients negotiates.
    await expect(tile(page, 'Leads from the website').locator('.kpi-value')).toHaveText('67%');
    await expect(tile(page, 'Best source this month').locator('.kpi-value')).toHaveText('Website');
    await expect(tile(page, 'Viewings to offers').locator('.kpi-value')).toHaveText('1 in 2');
    const feed = page.getByRole('region', { name: 'What stands out' });
    await expect(feed).toContainText('1 client has had no contact for 30 days.');
    await expect(page.getByRole('region', { name: 'Lead quality distribution' })).toBeVisible();
    await feed.getByRole('button', { name: /Quiet clients/ }).click();
    await expect(page).toHaveURL(/#\/clients$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/crm-insights');
    await noPageOverflow(page);
  } finally {
    await admin.context.close();
  }

  // An assigned-only member counts only the lead they hold.
  const staff = await memberPage(browser, team.people.one.email);
  try {
    await staff.page.goto('/#/crm-insights');
    await expect(tile(staff.page, 'Leads from the website')).toContainText('1 of 1 new leads');
    await expect(staff.page.getByText('Synthetic CL-IN-1')).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
