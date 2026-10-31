import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import {
  migrationData,
  savedSource,
  openImport,
  reviewImport,
  committed,
  serverRecords,
} from './import-helpers.js';

test('personal browser records require explicit owner mapping and are never copied to organisation', async ({
  page,
}) => {
  await signIn(page, 'owner');
  const key = 'kws-crm-v1:workspace:aidah';
  await savedSource(page, migrationData('PERSONAL'), key);
  await openImport(page, key);
  const destination = page.getByLabel('Destination workspace');
  await expect(destination).toHaveValue('');
  await expect(
    destination.getByRole('option', { name: 'Super Admin workspace', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Preview import' })).toBeDisabled();
  await destination.selectOption({ label: 'Fixture Admin A' });
  const target = await destination.inputValue();
  await page.getByLabel('Add demo photos where a property has no uploaded photos').uncheck();
  await reviewImport(page);
  await committed(page);
  await expect(page.getByRole('region', { name: 'Active workspace' })).toContainText(
    'Fixture Admin A',
  );
  const records = await serverRecords(page, target);
  expect(
    records.Properties.find(({ record }) => record.property_id === 'PERSONAL-PR').record
      .media_photos,
  ).toBeUndefined();
  expect(
    (await serverRecords(page)).Clients.some(({ record }) => record.client_id === 'PERSONAL-CL'),
  ).toBe(false);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, 'admin-b');
  expect((await page.request.get(`/api/crm/workspaces/${target}/records`)).status()).toBe(403);
  await expect(page.getByRole('button', { name: 'Import saved records' })).toHaveCount(0);
});

test('an Admin never reads legacy browser records to offer migration', async ({ page }) => {
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
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Import saved records' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
