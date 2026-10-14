import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('the hand-off dialog and Assigned to filter work by keyboard in both themes at 390px', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const team = await assignTeam('keys');
  const { admin, one } = team.people;
  const client = await held(team, 'Clients', { full_name: 'Keyboard client' }, one.id);
  const id = client.record.client_id;
  const errors = [];
  const { page, context } = await memberPage(browser, admin.email);
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['dark', 'light']) {
        await setTheme(page, theme);
        await page.goto('/#/clients');
        const filter = page.getByRole('group', { name: 'Assignment' });
        const assignedTo = filter.getByLabel('Assigned to');
        await assignedTo.focus();
        await assignedTo.selectOption({ label: one.name });
        await expect(filter.getByRole('status')).toHaveText('1 record');
        const box = await filter.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        await noPageOverflow(page);
        expect(await textContrast(filter.locator('label'))).toBeGreaterThanOrEqual(4.5);
        await page.screenshot({ path: testInfo.outputPath(`filter-${width}-${theme}.png`) });

        const open = page.getByRole('button', { name: `Open record ${id}`, exact: true });
        await open.focus();
        await expect(open).toBeFocused();
        await page.keyboard.press('Enter');
        const details = page.getByRole('dialog', { name: 'Keyboard client' });
        await expect(details).toBeVisible();
        const reassign = details.getByRole('button', { name: 'Reassign', exact: true });
        await reassign.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: `Reassign ${id}` });
        await expect(dialog.getByRole('heading', { name: `Reassign ${id}` })).toBeFocused();
        const order = [
          dialog.getByRole('button', { name: 'Close reassignment' }),
          dialog.getByLabel('New assignee'),
          dialog.getByLabel('Hand-off note (optional)'),
          dialog.getByRole('button', { name: 'Cancel', exact: true }),
          dialog.getByRole('button', { name: 'Close reassignment' }),
        ];
        for (const control of order) {
          await page.keyboard.press('Tab');
          await expect(control).toBeFocused();
        }
        const panel = await dialog.locator('.drawer').boundingBox();
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(width);
        await noPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`handoff-${width}-${theme}.png`) });
        // Shift+Tab back to Cancel, then dismiss with the keyboard.
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Enter');
        await expect(dialog).toHaveCount(0);
        await expect(details).toBeVisible();
        await expect(reassign).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(details).toHaveCount(0);
        await expect(open).toBeFocused();
        await assignedTo.selectOption({ label: 'Everyone' });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Escape closes only the hand-off dialog and returns focus to Reassign', async ({
  browser,
}) => {
  const team = await assignTeam('escape');
  const client = await held(team, 'Clients', { full_name: 'Escape client' });
  const id = client.record.client_id;
  const { page, context } = await memberPage(browser, team.people.admin.email);
  try {
    await page.goto('/#/clients');
    await page.getByRole('button', { name: `Open record ${id}`, exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Escape client' });
    const reassign = details.getByRole('button', { name: 'Reassign', exact: true });
    await reassign.click();
    const dialog = page.getByRole('dialog', { name: `Reassign ${id}` });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(details).toBeVisible();
    await expect(reassign).toBeFocused();
  } finally {
    await context.close();
  }
});
