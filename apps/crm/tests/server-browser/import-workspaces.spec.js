import { test, expect } from './fixtures.js';
import { session, signIn, signOut } from './helpers.js';
import {
  migrationData,
  savedSource,
  openImport,
  reviewImport,
  committed,
  serverRecords,
} from './import-helpers.js';

test('an Admin imports personal browser records into their own company only (BO1a)', async ({
  page,
}) => {
  await signIn(page);
  const key = 'kws-crm-v1:workspace:aidah';
  await savedSource(page, migrationData('PERSONAL'), key);
  await openImport(page, key);
  // A personal set names the member of this company who receives it; no other company.
  const member = page.getByLabel('Give the records to');
  await expect(member).toBeEnabled();
  await expect(member.locator('option:checked')).toHaveText(/\(you\)$/);
  await page.getByLabel('Add demo photos where a property has no uploaded photos').uncheck();
  await reviewImport(page);
  await committed(page);
  const { user } = await session(page);
  const records = await serverRecords(page);
  expect(
    records.Properties.find(({ record }) => record.property_id === 'PERSONAL-PR').record
      .media_photos,
  ).toBeUndefined();
  await signOut(page);
  await signIn(page, 'admin-b');
  expect((await page.request.get(`/api/crm/workspaces/${user.workspaceId}/records`)).status()).toBe(
    403,
  );
  await signOut(page);
  // Blaqks One neither imports nor reads the company's records.
  await signIn(page, 'owner');
  await expect(page.getByRole('button', { name: 'Import saved records' })).toHaveCount(0);
  expect((await page.request.get(`/api/crm/workspaces/${user.workspaceId}/records`)).status()).toBe(
    403,
  );
});

test('opening the CRM never reads legacy browser records', async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'kws-crm-v1' || key.startsWith('kws-crm-v1:workspace:'))
        throw Error('An Admin must not read legacy workspace records');
      return read.call(this, key);
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // The Admin's Import waits for a click: opening the CRM reads no browser records.
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Import saved records' })).toBeVisible();
  expect(errors).toEqual([]);
});
