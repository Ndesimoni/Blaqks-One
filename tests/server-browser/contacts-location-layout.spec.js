import { test, expect } from './fixtures.js';
import { assignTeam } from './assign-fixtures.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';
import { focusVisible, tallTargets } from './permissions-visual-helpers.js';

const allTabs = ['All', 'Landlords', 'Clients', 'Security guards', 'Building managers'];
allTabs.push('Other contacts');
const shot = (testInfo, name) =>
  process.env.CONTACTS_QA_SHOTS
    ? `${process.env.CONTACTS_QA_SHOTS}/${name}`
    : testInfo.outputPath(name);

/** Waits for finite animations (the modal enter scale/fade) before measuring or capturing. */
const settle = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((motion) => motion.effect?.getComputedTiming().iterations !== Infinity)
        .map((motion) => motion.finished),
    ).then(() => true),
  );

test('contact tabs and location fields reflow and stay keyboard reachable at 390 and 1280px in both themes', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('ctview');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const group = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  try {
    for (const width of [390, 1280])
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/#/contacts');
        await setTheme(page, theme);
        await expect(group.getByRole('button')).toHaveText(allTabs);
        await group.getByRole('button', { name: 'All', exact: true }).focus();
        for (const name of allTabs.slice(1)) {
          await page.keyboard.press('Tab');
          await expect(group.getByRole('button', { name, exact: true })).toBeFocused();
          await expect(group.getByRole('button', { name, exact: true })).toBeInViewport();
          await focusVisible(page);
        }
        await page.keyboard.press('Enter');
        await expect(group.getByRole('button', { name: 'Other contacts' })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        for (const box of await group
          .getByRole('button')
          .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height)))
          expect(box).toBeGreaterThanOrEqual(36);
        await noPageOverflow(page);
        await page.screenshot({ path: shot(testInfo, `contacts-tabs-${width}-${theme}.png`) });
        await page.getByRole('button', { name: 'Add contact', exact: true }).click();
        const form = page.getByRole('dialog');
        await settle(page);
        const emirate = form.getByLabel('Emirate', { exact: true });
        await expect(emirate.locator('option')).toContainText(['Dubai', 'Abu Dhabi', 'Sharjah']);
        const location = form.getByLabel(/^(Building \/ project|Community|Emirate)$/);
        await expect(location).toHaveCount(3);
        if (width === 390) await tallTargets(location, `${theme} location field`);
        await form.getByLabel('Building / project', { exact: true }).fill('A'.repeat(120));
        await form.getByLabel('Building / project', { exact: true }).focus();
        await focusVisible(page);
        await page.keyboard.press('Tab');
        await expect(form.getByLabel('Community', { exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(emirate).toBeFocused();
        await noPageOverflow(page);
        await settle(page);
        await page.screenshot({ path: shot(testInfo, `contacts-form-${width}-${theme}.png`) });
        page.once('dialog', (prompt) => prompt.accept());
        await page.keyboard.press('Escape');
        await expect(form).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add contact', exact: true })).toBeFocused();
      }
  } finally {
    await context.close();
  }
});
