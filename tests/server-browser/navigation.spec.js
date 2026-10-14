import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { nav, labels } from '../../src/config/navigation.js';

test('connected Admin navigation restores every group and unfinished routes never show demo records or forms', async ({
  page,
}) => {
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
  const sidebar = page.getByRole('navigation', { name: 'CRM sections', exact: true });
  for (const group of nav) {
    await expect(sidebar.getByText(group.header, { exact: true })).toBeVisible();
    for (const [name] of group.items)
      await expect(sidebar.getByRole('button', { name, exact: true })).toHaveCount(1);
  }
  for (const name of [
    'Messages',
    'CRM insights',
    'Payments',
    'Expenses',
    'Date search',
    'Performance',
    'Guide',
  ]) {
    await sidebar.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.page-heading h1')).toHaveText(labels[name]);
    await expect(page.getByRole('region', { name: `${name} connection status` })).toContainText(
      'NOT CONNECTED YET',
    );
    await expect(page.getByText('Navigation demo sentinel', { exact: true })).toHaveCount(0);
    await expect(page.locator('.data-table tbody tr')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Import saved records', exact: true }),
    ).toHaveCount(0);
  }
  for (const [name, action] of [
    ['Dashboard', 'Add new lead'],
    ['Client desk', 'Add client'],
    ['Leads', 'Add lead'],
    ['Follow-ups', 'Add follow-up'],
    ['Viewings', 'Add viewing'],
    ['Shortlist', 'Add match'],
    ['Interaction log', 'Add conversation'],
    ['Client care', 'Add touchpoint'],
  ]) {
    await sidebar.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.page-heading h1')).toHaveText(labels[name]);
    // An empty list repeats its Add action in the empty state.
    await expect(page.getByRole('button', { name: action, exact: true }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: `${name} connection status` })).toHaveCount(0);
    await expect(page.getByText('Navigation demo sentinel', { exact: true })).toHaveCount(0);
  }
  await sidebar.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await page.reload();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
  await expect(page.getByRole('region', { name: 'Records in view' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dashboard connection status' })).toHaveCount(0);
  // Deals is connected (finance F2); Payments and Expenses follow in F3.
  for (const name of ['Dashboard', 'Client desk', 'Deals'])
    await expect(
      sidebar.getByRole('button', { name, exact: true }).locator('.connected-nav-status'),
    ).toHaveCount(0);
  await expect(
    sidebar.getByRole('button', { name: 'Payments', exact: true }).locator('.connected-nav-status'),
  ).toHaveText('Not connected');
  await sidebar.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add client', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Clients', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
    await expect(
      page
        .getByRole('navigation', { name: 'CRM sections' })
        .getByRole('button', { name: 'Performance', exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`navigation-desktop-${theme}.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    const opener = page.getByRole('button', { name: 'Toggle navigation' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'CRM navigation' });
    const current = dialog.getByRole('button', { name: 'Performance', exact: true });
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
