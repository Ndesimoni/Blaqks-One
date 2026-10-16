import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, setTheme, workspaceRecords } from './assign-helpers.js';
import { metric, viewingsPanel } from './dashboard-fixtures.js';

/**
 * Agent one holds a listing and one client. Agent two's client and a queued client have viewings
 * booked on one's listing; one's own client has a viewing in between.
 */
async function heldListingTeam(prefix) {
  const team = await assignTeam(prefix);
  const { one, two } = team.people;
  const listing = await held(team, 'Properties', { listing_title: 'Dash held listing' }, one.id);
  const mine = await held(team, 'Clients', { full_name: 'Dash own buyer' }, one.id);
  const buyer = await held(team, 'Clients', { full_name: 'Secret buyer' }, two.id);
  const queued = await held(team, 'Clients', { full_name: 'Queued buyer' }, null);
  for (const [client, time] of [
    [buyer, '2099-01-15 14:30'],
    [mine, '2099-02-01 09:00'],
    [queued, '2099-03-01 16:00'],
  ])
    await held(team, 'Viewings', {
      client_id: client.record.client_id,
      property_id: listing.record.property_id,
      appointment_date_time: time,
      viewing_status: 'Scheduled',
      client_feedback: 'Private viewing feedback',
      next_action: 'Private next step',
    });
  return { team, one, two };
}

const secrets = ['Secret buyer', 'Queued buyer', 'Private viewing feedback', 'Private next step'];

test('a listing holder sees other agents’ viewings on it as time, property and agent only', async ({
  browser,
}) => {
  const { one, two } = await heldListingTeam('dashheld');
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.goto('/#/dashboard');
    const panel = viewingsPanel(page);
    const rows = panel.locator('.agenda-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveText(/^15 Jan\s*14:30\s*Dash held listing\s*Booked by /);
    await expect(rows.nth(0)).toContainText(`Booked by ${two.name}`);
    await expect(rows.nth(1)).toHaveText(
      /^1 Feb\s*09:00\s*Dash held listing\s*Dash own buyer\s*Viewing$/,
    );
    await expect(rows.nth(2)).toHaveText(
      /^1 Mar\s*16:00\s*Dash held listing\s*Unassigned\s*Viewing$/,
    );
    await expect(panel).toContainText('Client details stay with the responsible agent.');
    await expect(panel).toContainText('Your next appointments and others booked on your listings');
    // Only the caller's own viewing can be opened; held-listing rows contain no control.
    const heldRows = panel.locator('.agenda-row-held');
    await expect(heldRows).toHaveCount(2);
    await expect(heldRows.locator('button, a, [role="button"], [tabindex]')).toHaveCount(0);
    await expect(panel.locator('button.agenda-row')).toHaveCount(1);
    for (const secret of [...secrets, 'VW-', 'Scheduled'])
      await expect(panel).not.toContainText(secret);
    await heldRows.first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The upcoming figure still counts only the caller's own visible viewings.
    await expect(metric(page, 'UPCOMING VIEWINGS')).toHaveText('1');
    const { body } = await workspaceRecords(page);
    expect(body.scope).toBe('assigned');
    expect(body.listingViewings).toHaveLength(2);
    await panel.locator('button.agenda-row').click();
    await expect(page.getByRole('dialog')).toContainText('Dash own buyer');
  } finally {
    await context.close();
  }
});

test('a team-scope Admin sees each viewing once, openable, with no held-listing rows', async ({
  browser,
}) => {
  const { team, one } = await heldListingTeam('dashheldadmin');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  try {
    await page.goto('/#/dashboard');
    const panel = viewingsPanel(page);
    await expect(panel.locator('button.agenda-row')).toHaveCount(3);
    await expect(panel.locator('.agenda-row-held')).toHaveCount(0);
    await expect(panel.locator('button.agenda-row').first()).toContainText('Secret buyer');
    await expect(panel).not.toContainText('Client details stay with the responsible agent.');
    const { body } = await workspaceRecords(page);
    expect(body.scope).toBe('team');
    expect(body.listingViewings).toEqual([]);
    await page.getByLabel('Assigned to', { exact: true }).selectOption({ label: one.name });
    await expect(page.getByText('Figures for the selected workload')).toBeVisible();
    await expect(panel.locator('.agenda-row-held')).toHaveCount(0);
    await expect(panel.locator('button.agenda-row')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('held-listing rows reflow at 390px and stay quiet on hover in both themes', async ({
  browser,
}, testInfo) => {
  const { one } = await heldListingTeam('dashheldlayout');
  const { page, context } = await memberPage(browser, one.email);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/dashboard');
    const panel = viewingsPanel(page);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await expect(panel.locator('.agenda-row-held')).toHaveCount(2);
      await noPageOverflow(page);
      const row = panel.locator('.agenda-row-held').first();
      await row.hover();
      await expect(row).toHaveCSS('cursor', 'default');
      await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await panel.screenshot({ path: testInfo.outputPath(`held-viewings-390-${theme}.png`) });
    }
  } finally {
    await context.close();
  }
});
