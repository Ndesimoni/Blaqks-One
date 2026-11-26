import { expect, test } from './helpers/session.js';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { labels, nav } from '../../src/config/navigation.js';
import { SEED_CRM } from '../../src/data/demo.js';
import { saveRecordForm } from './helpers/record-form.js';

async function navigate(page, name) {
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: new RegExp(`^${name}$`) })
    .click();
}

test('dark mode is the default and saved light mode and targets persist independently of records', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  const workspaceBefore = await page.evaluate(() =>
    localStorage.getItem('kws-crm-v1:workspace:aidah'),
  );
  await navigate(page, 'Performance');
  const month = await page.locator('input[type="month"]').inputValue();
  await page.getByRole('spinbutton', { name: 'Target for New enquiries', exact: true }).fill('55');
  await page.getByRole('spinbutton', { name: 'Target for Earned fees', exact: true }).fill('42000');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kws-crm-preferences'))?.theme))
    .toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    workspaceBefore,
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await navigate(page, 'Performance');
  await expect(page.locator('input[type="month"]')).toHaveValue(month);
  await expect(
    page.getByRole('spinbutton', { name: 'Target for New enquiries', exact: true }),
  ).toHaveValue('55');
  await expect(
    page.getByRole('spinbutton', { name: 'Target for Earned fees', exact: true }),
  ).toHaveValue('42000');
});

test('failed storage writes preserve in-memory editing and theme behavior', async ({ page }) => {
  const errors = [];
  const messages = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  const workspaceBefore = await page.evaluate(() =>
    localStorage.getItem('kws-crm-v1:workspace:aidah'),
  );
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'kws-crm-v1:workspace:aidah' || key === 'kws-crm-preferences') {
        throw new DOMException('Simulated storage failure', 'QuotaExceededError');
      }
      return setItem.call(this, key, value);
    };
  });
  await navigate(page, 'Clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Unsaved Storage Client');
  await saveRecordForm(page);
  await expect
    .poll(() => messages.some((message) => message.includes('Browser storage is full')))
    .toBe(true);
  await page
    .getByRole('textbox', { name: 'Search Clients', exact: true })
    .fill('Unsaved Storage Client');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    workspaceBefore,
  );
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('all 19 CRM screens render and the original workbook is served', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.sidebar .nav-item')).toHaveCount(19);
  for (const name of nav.flatMap((group) => group.items.map(([label]) => label))) {
    await navigate(page, name);
    await expect(page.locator('.page-heading h1')).toHaveText(labels[name]);
  }
  const workbook = await page.request.get('/data/Keys_with_Simoni_Real_Estate_CRM_Enhanced.xlsx');
  expect(workbook.ok()).toBe(true);
  const zip = await JSZip.loadAsync(await workbook.body());
  const xml = await zip.file('xl/workbook.xml').async('string');
  expect(xml.match(/<(?:\w+:)?sheet\b/g)).toHaveLength(17);
  expect(errors).toEqual([]);
});

test('clients can be created, searched, edited, saved across reload, and deleted', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await navigate(page, 'Clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Structure Test Client');
  await page.locator('#phone').fill('+971 50 010 1010');
  await saveRecordForm(page);
  await expect(page.locator('.editor-drawer')).toHaveCount(0);
  const search = page.getByRole('textbox', { name: 'Search Clients', exact: true });
  await search.pressSequentially('Structure Test Client');
  await expect(search).toBeFocused();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.locator('.data-table tbody tr').click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await page.locator('#full_name').fill('Updated Structure Client');
  await saveRecordForm(page);
  await page.reload();
  await navigate(page, 'Clients');
  await search.fill('Updated Structure Client');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.locator('.data-table tbody tr').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('property filters, search focus, and paginated table work', async ({ page }) => {
  await page.goto('/');
  await navigate(page, 'Properties');
  const cards = page.locator('.modern-property-card');
  await expect(cards).toHaveCount(12);
  const pages = page.getByRole('navigation', { name: 'Property pages', exact: true });
  await expect(page.getByRole('button', { name: /^More property listings/ })).toHaveCount(0);
  await pages.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(pages).toContainText('Page 2 of 2');
  await pages.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(cards).toHaveCount(12);
  await page.getByRole('button', { name: /Holiday homes/ }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: /For rent/ }).click();
  await expect(cards).toHaveCount(4);
  await page.getByRole('button', { name: /All listings/ }).click();
  const search = page.getByRole('textbox', { name: 'Search properties', exact: true });
  await search.pressSequentially('Marina');
  await expect(search).toBeFocused();
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(12);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
});

test('property photos survive JSON backup and restore', async ({ page }, testInfo) => {
  await page.goto('/');
  await navigate(page, 'Properties');
  await page.locator('.modern-property-card').first().click();
  await page.getByRole('button', { name: 'Add property photos', exact: true }).click();
  await page
    .getByLabel('Upload property photos')
    .setInputFiles(new URL('../fixtures/property-photo.jpg', import.meta.url).pathname);
  await expect(page.locator('.editor-photo img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Balcony', exact: true }).click();
  await saveRecordForm(page);
  await expect(page.locator('.property-cover-img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Data & export' }).click();
  const download = page.waitForEvent('download');
  await page.getByText('Full backup with photos (JSON)', { exact: true }).click();
  const backupPath = testInfo.outputPath('workspace-backup.json');
  await (await download).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.format).toBe('keys-with-simoni-full-backup');
  expect(backup.data.Properties[0].media_photos).toHaveLength(1);
  await page.getByRole('button', { name: 'Data & export' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByText('Start with blank CRM', { exact: true }).click();
  await page.getByRole('button', { name: 'Data & export' }).click();
  await page.getByText('Restore full backup (JSON)', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('input[accept=".json,application/json"]').setInputFiles(backupPath);
  await expect(page.locator('.toast')).toContainText('backup restored');
  await navigate(page, 'Properties');
  await expect(page.locator('.property-cover-img')).toHaveCount(1);
  await page.locator('.modern-property-card').first().click();
  await expect(page.locator('.media-photo-hero img')).toHaveCount(1);
  await expect(page.locator('.amenity-tags')).toContainText('Balcony');
});

test('17-sheet Excel export and import retain edited records', async ({ page }, testInfo) => {
  await page.goto('/');
  await navigate(page, 'Clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Excel Structure Client');
  await saveRecordForm(page);
  await page.getByRole('button', { name: 'Data & export' }).click();
  const download = page.waitForEvent('download');
  await page.getByText('Export 17-sheet Excel', { exact: true }).click();
  const workbookPath = testInfo.outputPath('workspace.xlsx');
  await (await download).saveAs(workbookPath);
  const zip = await JSZip.loadAsync(await readFile(workbookPath));
  expect((await zip.file('xl/workbook.xml').async('string')).match(/<sheet\b/g)).toHaveLength(17);
  expect(await zip.file('xl/worksheets/sheet3.xml').async('string')).toContain(
    'Excel Structure Client',
  );
  await page.getByRole('button', { name: 'Data & export' }).click();
  await page.getByText('Import Excel workbook', { exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('input[accept^=".xlsx"]').setInputFiles(workbookPath);
  await expect(page.locator('.toast')).toContainText('records from Excel');
  await navigate(page, 'Clients');
  await page
    .getByRole('textbox', { name: 'Search Clients', exact: true })
    .fill('Excel Structure Client');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
});

test('existing browser workspace and theme preferences still load on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const data = SEED_CRM();
  data.Clients.push({ client_id: 'CL-LEGACY', full_name: 'Existing Browser Client' });
  await page.evaluate((saved) => {
    localStorage.setItem(
      'kws-crm-v1:workspace:aidah',
      JSON.stringify({ data: saved, demo: false }),
    );
    localStorage.setItem('kws-crm-preferences', JSON.stringify({ targets: {}, theme: 'dark' }));
  }, data);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await navigate(page, 'Clients');
  await page
    .getByRole('textbox', { name: 'Search Clients', exact: true })
    .fill('Existing Browser Client');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await navigate(page, 'Properties');
  await expect(page.locator('.modern-property-card')).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Property pages', exact: true })).toContainText(
    'Page 1 of 2',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-properties.png'), fullPage: true });
});
