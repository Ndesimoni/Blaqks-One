import { test, expect } from './fixtures.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import { dashboardTeam } from './dashboard-fixtures.js';

const pages = [
  ['dashboard', 'Records in view'],
  ['client-desk', 'Find a client'],
];

test('the connected Dashboard and Client desk reflow at 390px and 1280px in both themes', async ({
  browser,
}, testInfo) => {
  test.setTimeout(150000);
  const { team, one } = await dashboardTeam('dashlayout');
  for (const [who, email] of [
    ['admin', team.people.admin.email],
    ['staff', one.email],
  ]) {
    const { page, context } = await memberPage(browser, email);
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const theme of ['dark', 'light']) {
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          for (const [path, landmark] of pages) {
            await page.goto(`/#/${path}`);
            await setTheme(page, theme);
            await expect(page.getByText(landmark, { exact: true }).first()).toBeVisible();
            await noPageOverflow(page);
            const name = `${path}-${who}-${width}-${theme}.png`;
            await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
          }
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/#/dashboard');
      const first = page.getByRole('region', { name: 'Records in view' }).getByRole('button');
      await first.first().focus();
      await expect(first.first()).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).not.toHaveURL(/#\/dashboard$/);
    } finally {
      await context.close();
    }
  }
});
