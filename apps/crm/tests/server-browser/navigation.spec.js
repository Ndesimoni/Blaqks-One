import { expect, test } from './fixtures.js';
import { signIn } from './helpers.js';
import { entries } from './navigation-entries.js';
import {
  openPage,
  rail,
  sectionButton,
  sectionNav,
  sectionTabs,
  sectionLabelOf,
  tabLabelOf,
} from './product-nav.js';

test('connected Admin navigation restores every group and unfinished routes never show demo records or forms', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      'kws-crm-v1',
      JSON.stringify({
        data: { Clients: [{ client_id: 'NAV-DEMO-ONLY', full_name: 'Navigation demo sentinel' }] },
        demo: false,
      }),
    ),
  );
  await signIn(page, 'owner');
  // The Super Admin's rail: the CRM, Messages (the preview), Platform and Settings only.
  for (const name of ['CRM', 'Messages', 'Platform', 'Settings'])
    await expect(rail(page).getByRole('button', { name, exact: true })).toBeVisible();
  for (const name of ['Websites', 'Marketplace'])
    await expect(rail(page).getByRole('button', { name, exact: true })).toHaveCount(0);
  // Every destination is reachable through product, section and tab, and marked current.
  for (const name of entries) {
    await openPage(page, name);
    const tabs = sectionTabs(page);
    if (await tabs.count())
      await expect(
        tabs.getByRole('button', { name: tabLabelOf(name), exact: true }),
      ).toHaveAttribute('aria-current', 'page');
  }
  for (const name of ['Messages']) {
    await openPage(page, name);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sectionLabelOf(name));
    await expect(page.getByRole('region', { name: `${name} connection status` })).toContainText(
      `${name} is not connected yet`,
    );
    await expect(page.getByText('Navigation demo sentinel', { exact: true })).toHaveCount(0);
    await expect(page.locator('.data-table tbody tr')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Import saved records', exact: true }),
    ).toHaveCount(0);
  }
  for (const [name, action] of [
    ['Dashboard', 'Create'],
    ['Client desk', 'Create'],
    ['Leads', 'Create'],
    ['Follow-ups', 'Create'],
    ['Viewings', 'Create'],
    ['Shortlist', 'Create'],
    ['Interaction log', 'Create'],
    ['Client care', 'Create'],
  ]) {
    await openPage(page, name);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sectionLabelOf(name));
    // Every page adds records from the top bar's Create (approved mockup).
    await expect(page.getByRole('button', { name: action, exact: true }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: `${name} connection status` })).toHaveCount(0);
    await expect(page.getByText('Navigation demo sentinel', { exact: true })).toHaveCount(0);
  }
  await openPage(page, 'Dashboard');
  await expect(page).toHaveURL(/#\/dashboard$/);
  await page.reload();
  // A restored session opens the workspace before the shell renders; allow for that.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard', { timeout: 20000 });
  await expect(page.getByRole('region', { name: 'Records in view' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dashboard connection status' })).toHaveCount(0);
  // Only the Messages preview still says it is not connected.
  await expect(sectionNav(page).locator('.connected-nav-status')).toHaveCount(0);
  await openPage(page, 'Messages');
  await expect(
    sectionButton(page, 'messages', 'Client inbox').locator('.connected-nav-status'),
  ).toHaveText('Not connected');
  await openPage(page, 'Clients');
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }),
  ).toBeVisible();
  await expect(sectionButton(page, 'crm', 'Clients')).toHaveAttribute('aria-current', 'page');
  await expect(
    sectionTabs(page).getByRole('button', { name: 'All clients', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('restored navigation scrolls its active link into view and stays usable on mobile in both themes', async ({
  page,
}, testInfo) => {
  await signIn(page, 'owner');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
    await page.goto('/#/performance');
    await expect(sectionButton(page, 'crm', 'Reports')).toBeInViewport();
    await expect(sectionTabs(page).getByRole('button', { name: 'Performance' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`navigation-desktop-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    const opener = page.getByRole('button', { name: 'Toggle navigation' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'CRM navigation' });
    const current = dialog.getByRole('button', { name: 'Reports', exact: true });
    await expect(current).toBeInViewport();
    await current.focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`navigation-mobile-${theme}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});
