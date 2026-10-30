import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('connected navigation and shared screens reflow in both themes with keyboard access', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'owner');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      }
      for (const route of ['/clients', '/contacts', '/properties']) {
        await page.goto(`/#${route}`);
        await expect(page.locator('.page-heading h1')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        expect(await textContrast(page.locator('.topbar-workspace'))).toBeGreaterThanOrEqual(4.5);
        expect(await textContrast(page.locator('.page-heading p'))).toBeGreaterThanOrEqual(4.5);
      }
      await page.screenshot({ path: testInfo.outputPath(`connected-${width}-${theme}.png`) });
    }
    if (width < 1050) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect(page.getByRole('dialog', { name: 'CRM navigation' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused();
    }
  }
  expect(errors).toEqual([]);
});
