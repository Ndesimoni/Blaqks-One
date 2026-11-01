import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord, setTheme } from './assign-helpers.js';
import { openName } from './record-open.js';

test('an Admin ticks clients in the grid and moves them together from the selection bar', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('gridsel');
  const { admin, one, two } = team.people;
  const first = await held(team, 'Clients', { full_name: 'Grid tick one' }, one.id);
  await held(team, 'Clients', { full_name: 'Grid tick two' }, one.id);
  const alone = await held(team, 'Clients', { full_name: 'Grid left alone' }, one.id);
  const { page, context } = await memberPage(browser, admin.email);
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/clients');
    const table = page.getByRole('table', { name: 'Clients records', exact: true });
    // The mockup's row: no ID column or row buttons; the name opens the record.
    await expect(table.getByRole('columnheader', { name: 'Client', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Client ID' })).toHaveCount(0);
    await expect(table.getByRole('button', { name: /Start message/ })).toHaveCount(0);
    const bar = page.getByRole('group', { name: 'Selected rows' });
    await expect(bar).toHaveCount(0);
    await table.getByRole('checkbox', { name: 'Select Grid tick one' }).check();
    await table.getByRole('checkbox', { name: 'Select Grid tick two' }).check();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bar).toContainText('2 selected');
    await expect(bar.getByRole('button', { name: 'Message' })).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.screenshot({ path: testInfo.outputPath(`grid-selection-${theme}.png`) });
    }
    await bar.getByRole('button', { name: 'Assign to…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reassign 2 records' });
    await expect(dialog).toContainText(`Currently assigned to ${one.name}.`);
    await dialog.getByLabel('New assignee').selectOption({ label: two.name });
    await dialog.getByRole('button', { name: 'Reassign 2', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('2 records reassigned');
    await expect(bar).toHaveCount(0);

    await table.getByRole('button', { name: openName(first.record.client_id) }).focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('dialog');
    await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText(two.name);
    await page.keyboard.press('Escape');
    const untouched = await openRecord(page, alone.record.client_id);
    await expect(untouched.getByRole('region', { name: 'Assigned to' })).toContainText(one.name);
  } finally {
    await context.close();
  }
});
