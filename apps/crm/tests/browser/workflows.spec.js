import { expect, test } from './helpers/session.js';
import { MODS, schema } from '../../src/lib/schema.js';
import { routePath } from '../../src/config/routes.js';
import { saveRecordForm } from './helpers/record-form.js';
import { expectRecordOverlay } from './helpers/record-overlay.js';

test('all 11 record modules create, edit, reload and delete through centered overlays', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (const [index, module] of Object.keys(MODS).entries()) {
    await page.goto('/#' + routePath(module));
    await page.locator('.main-content .btn').filter({ hasText: /^Add / }).first().click();
    await expectRecordOverlay(page);
    if (module === 'Clients')
      await page.screenshot({ path: testInfo.outputPath('client-overlay-desktop.png') });
    const fields = schema(module).filter((field) => !field.calculated);
    const id = `TEST-${index}`;
    await page.locator('#' + fields[0].key).fill(id);
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          ({ module, key, id }) =>
            JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data[module].some(
              (row) => row[key] === id,
            ),
          { module, key: fields[0].key, id },
        ),
      )
      .toBe(true);
    const search = page.getByRole('textbox', {
      name: module === 'Properties' ? 'Search properties' : 'Search ' + module,
      exact: true,
    });
    await search.fill(id);
    await page
      .locator(module === 'Properties' ? '.modern-property-card' : '.data-table tbody tr')
      .first()
      .click();
    await expectRecordOverlay(page);
    if (module === 'Clients')
      await page.screenshot({ path: testInfo.outputPath('client-details-overlay-desktop.png') });
    await page.getByRole('button', { name: 'Edit record', exact: true }).click();
    await expectRecordOverlay(page);
    await page.locator('#' + fields[0].key).fill(id + '-EDIT');
    await saveRecordForm(page);
    await page.reload();
    await search.fill(id + '-EDIT');
    await page
      .locator(module === 'Properties' ? '.modern-property-card' : '.data-table tbody tr')
      .first()
      .click();
    await expectRecordOverlay(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          ({ module, key, id }) =>
            JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data[module].some(
              (row) => row[key] === id,
            ),
          { module, key: fields[0].key, id: id + '-EDIT' },
        ),
      )
      .toBe(false);
  }
  expect(errors).toEqual([]);
});

test('browser history preserves dirty edits when leaving is cancelled', async ({ page }) => {
  await page.goto('/#/properties');
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Unsaved client draft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page.getByRole('dialog', { name: 'New client' })).toBeVisible();
  await expect(page).toHaveURL(/#\/clients$/);
  await expect(page.locator('#full_name')).toHaveValue('Unsaved client draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate(() => history.back());
  await expect(page.locator('.page-heading h1')).toHaveText('Property portfolio');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('failed persistence shows a recovery banner and retry saves the same in-memory record', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/#/clients');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  await page.evaluate(() => {
    window.originalStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'kws-crm-v1:workspace:aidah')
        throw new DOMException('Simulated failure', 'QuotaExceededError');
      return window.originalStorageWrite.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Recovered storage client');
  await saveRecordForm(page);
  await expect(page.locator('.storage-banner')).toContainText('only in memory');
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalStorageWrite;
  });
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.locator('.storage-banner')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('textbox', { name: 'Search Clients', exact: true })
    .fill('Recovered storage client');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
});
