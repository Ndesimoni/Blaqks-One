import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';
import { companyBody, newCompany, putCompany } from '../api/company-helpers.mjs';
import { noPageOverflow, setTheme } from './assign-helpers.js';
import { signIn } from './helpers.js';

// Blaqks One's platform dashboard (BO1d): platform-wide figures, trends and usage, no money
// per company. Every company here is synthetic and made by the test.
const tiles = ['Companies active', 'Monthly active users', 'Websites live'];
const regions = [
  'New companies and users',
  'Monthly active users',
  'Deals earned',
  'Website enquiries',
  'Transactions between brokers',
  'Records added',
  'Websites',
  'Deals & money',
  'Between brokers',
  'Marketplace',
  'Growth',
  'People',
  'Messages & activity',
  'Records',
  'Users outside the companies',
];

test('Blaqks One reads the platform dashboard, changes the period and downloads the CSV', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { admin } = await newCompany('platform-dashboard');
  const name = `Synthetic Metrics ${Date.now()}`;
  expect((await putCompany(admin, companyBody({ displayName: name }))).status).toBe(200);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'owner');
  // The start page's Platform card opens the dashboard first.
  await page.getByRole('button', { name: 'Open Platform', exact: true }).click();
  await expect(page).toHaveURL(/#\/platform-dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  const figures = page.getByRole('region', { name: 'Key platform figures', exact: true });
  for (const label of tiles) await expect(figures).toContainText(label);
  await expect(figures).toContainText('Deals earned · last 30 days');
  for (const heading of regions)
    await expect(page.getByRole('region', { name: heading, exact: true })).toBeVisible();
  const outside = page.getByRole('region', { name: 'Users outside the companies', exact: true });
  await expect(outside).toContainText('Website visitors');
  await expect(outside).toContainText('Not tracked yet');

  // Company usage: searchable, usage only, never money.
  const usage = page.getByRole('table', { name: 'Company usage', exact: true });
  await page.getByRole('textbox', { name: 'Search companies', exact: true }).fill(name);
  const row = usage.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText(admin.user.name);
  await expect(row).toContainText('1 of 3');
  await expect(usage).not.toContainText('AED');

  // The period switch asks for the chosen period and presses its chip.
  const periods = page.getByRole('group', { name: 'Period', exact: true });
  const yearly = periods.getByRole('button', { name: 'Last 12 months', exact: true });
  const [reply] = await Promise.all([
    page.waitForResponse((answer) => answer.url().includes('/platform/metrics?period=12m')),
    yearly.click(),
  ]);
  expect(reply.status()).toBe(200);
  await expect(yearly).toHaveAttribute('aria-pressed', 'true');
  await expect(periods.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(figures).toContainText('Deals earned · last 12 months');

  // Download CSV: the period's figures, the trends and the usage rows.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Blaqks_One_metrics_12m_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('"Blaqks One platform figures"');
  expect(csv).toContain('"Period","Last 12 months"');
  expect(csv).toContain('"Month","New companies"');
  expect(csv).toContain(`"${name}"`);

  // A usage row opens the company panel from Platform → Companies.
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Open ${name}`, exact: true }).click();
  const panel = page.getByRole('dialog', { name, exact: true });
  await expect(panel).toContainText(`Admin: ${admin.user.name}`);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the platform dashboard fits phones and desktops in both themes, by keyboard', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await signIn(page, 'owner');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/platform-dashboard');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      const figures = page.getByRole('region', { name: 'Key platform figures', exact: true });
      await expect(figures).toBeVisible();
      await expect(page.getByRole('table', { name: 'Company usage', exact: true })).toBeVisible();
      await noPageOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`platform-dashboard-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  // The period chips work from the keyboard.
  const allTime = page
    .getByRole('group', { name: 'Period', exact: true })
    .getByRole('button', { name: 'All time', exact: true });
  await allTime.focus();
  await page.keyboard.press('Enter');
  await expect(allTime).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Key platform figures' })).toContainText(
    'Deals earned · all time',
  );
});

test('a company Admin cannot open the platform dashboard or read its figures', async ({ page }) => {
  const asked = [];
  page.on('request', (request) => {
    if (request.url().includes('/platform/metrics')) asked.push(request.url());
  });
  await signIn(page, 'admin-a');
  await page.goto('/#/platform-dashboard');
  await expect(page.getByRole('heading', { name: /^You don't have access to / })).toBeVisible();
  expect(asked).toEqual([]);
  const refused = await page.request.get('/api/crm/platform/metrics?period=30d');
  expect(refused.status()).toBe(403);
});
