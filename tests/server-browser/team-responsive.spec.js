import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { openTeam } from './team-helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('team forms scroll smoothly and retain drafts with keyboard controls in both themes', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      }
      await openTeam(page);
      expect(await textContrast(page.locator('.connected-team-toolbar p'))).toBeGreaterThanOrEqual(
        4.5,
      );
      await page.getByRole('button', { name: 'Invite teammate', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Invite teammate' });
      await expect(dialog.getByLabel('Full name')).toBeFocused();
      await dialog
        .getByLabel('Full name')
        .fill('A long fictional colleague name for responsive team layouts');
      await dialog.getByLabel('Email address').fill('layout@browser-team.test');
      await dialog.getByLabel('Phone number').fill('+971501234567');
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      const positions = dialog.getByRole('group', { name: 'Positions', exact: false });
      await expect(positions.getByRole('checkbox')).toHaveCount(8);
      await positions.getByRole('checkbox', { name: 'Team Supervisor', exact: true }).check();
      await dialog
        .getByRole('group', { name: 'Messaging permissions' })
        .getByRole('checkbox', { name: 'Email', exact: true })
        .check();
      await positions.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
      await expect(
        dialog
          .getByRole('group', { name: 'Messaging permissions' })
          .getByRole('checkbox', { name: 'Email', exact: true }),
      ).toBeChecked();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(dialog).toContainText('Team Supervisor');
      await expect(dialog).toContainText('Receptionist');
      await dialog.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(
        positions.getByRole('checkbox', { name: 'Team Supervisor', exact: true }),
      ).toBeChecked();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`team-form-${width}-${theme}.png`) });
      page.once('dialog', (alert) => alert.dismiss());
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      page.once('dialog', (alert) => alert.accept());
      await dialog.getByRole('button', { name: 'Close team form', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Invite teammate', exact: true }),
      ).toBeFocused();
    }
  }
  expect(errors).toEqual([]);
});
