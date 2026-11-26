import { expect, test } from './helpers/session.js';
import { crmRoutes } from '../../src/config/routes.js';

for (const width of [1440, 768, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`CRM design stays usable at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
      for (const route of [
        ...crmRoutes.map(({ path }) => path),
        '/my-profile',
        '/team-activity',
        '/team-access',
      ]) {
        await page.goto(`/#${route}`);
        await expect(page.locator('.page-heading h1')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (
          ['/', '/properties', '/clients', '/follow-ups', '/messages', '/my-profile'].includes(
            route,
          )
        )
          await page.screenshot({
            path: testInfo.outputPath(`${route.slice(1) || 'overview'}.png`),
            animations: 'disabled',
          });
      }
      expect(errors).toEqual([]);
    });
  }
}
