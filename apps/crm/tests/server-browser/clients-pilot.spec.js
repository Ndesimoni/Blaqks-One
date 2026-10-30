import { memberPage, setTheme } from './assign-helpers.js';
import { expect, test } from './fixtures.js';
import { addClient, signIn } from './helpers.js';
import { actions, assignTeam, held, setGrants } from './permissions-fixtures.js';

const description = 'Manage relationships, qualification, budgets, and conversion.';
const viewports = [
  { width: 1280, height: 800, label: '1280' },
  { width: 390, height: 844, label: '390' },
];

/** The pilot's viewport matrix: both themes at desktop and phone width (UI3 §7). */
async function capture(page, testInfo, role) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByText(description, { exact: true })).toHaveCount(1);
      await expect(page.getByText(/^Total clients$/)).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (viewport.width < 750) {
        await expect(page.locator('.record-card').first()).toBeVisible();
        await expect(page.locator('.data-table')).toHaveCount(0);
        const top = await page
          .locator('.record-card')
          .first()
          .evaluate((card) => card.getBoundingClientRect().top);
        expect(top, 'first record within 520px').toBeLessThanOrEqual(520);
      } else {
        await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
        await expect(page.locator('.record-card')).toHaveCount(0);
        await expect(page.locator('.data-table thead th')).toHaveCount(8);
      }
      await page.screenshot({
        path: testInfo.outputPath(`clients-${role}-${viewport.label}-${theme}.png`),
      });
    }
  }
}

test('the Clients directory states its count once and offers one primary action', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await signIn(page, 'admin-a');
  await addClient(page, 'PILOT-A', 'Pilot seeded client');
  await addClient(page, 'PILOT-B', 'Pilot second client');
  const count = await page.locator('.record-count-number').innerText();
  const pager = page.getByRole('navigation', { name: 'Clients pages' });
  await expect(pager).toContainText(new RegExp(`of ${count} (records|clients)`));
  await expect(page.locator('.record-count-word')).toHaveText(
    Number(count) === 1 ? 'client' : 'clients',
  );
  await expect(page.getByRole('button', { name: 'Add client', exact: true })).toHaveCount(1);
  await capture(page, testInfo, 'admin');
});

test('restricted staff see their assigned clients read-only as cards and a table', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const team = await assignTeam('uipilot');
  const { one } = team.people;
  await setGrants(team, 'one', { actions: actions(false) });
  await held(team, 'Clients', { full_name: 'Pilot assigned client' }, one.id);
  const staff = await memberPage(browser, one.email);
  const { page } = staff;
  try {
    await page.goto('/#/clients');
    await expect(page.locator('.record-count-number')).toHaveText('1');
    await expect(page.locator('.view-only-chip')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0);
    await capture(page, testInfo, 'staff');
  } finally {
    await staff.context.close();
  }
});
