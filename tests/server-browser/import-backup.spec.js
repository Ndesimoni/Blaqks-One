import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import {
  migrationData,
  savedSource,
  openImport,
  reviewImport,
  committed,
  serverRecords,
  storageKey,
} from './import-helpers.js';

test('download creates a complete backup and import keeps linked records, demo photos and browser source', async ({
  page,
}, testInfo) => {
  await signIn(page, 'owner');
  const data = migrationData('BACKUP');
  const original = await savedSource(page, data);
  await openImport(page);
  await expect(page.getByLabel('Destination workspace')).toBeDisabled();
  await expect(page.getByText('Other records stay in your source')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download source backup' }).click(),
  ]);
  const path = testInfo.outputPath('saved-workspace.json');
  await download.saveAs(path);
  const backup = parseFullBackup(await readFile(path, 'utf8'));
  expect(backup).toEqual(data);
  const preview = await reviewImport(page);
  expect(preview.counts).toEqual({ Clients: 1, Contacts: 1, Properties: 1 });
  await committed(page);
  const records = await serverRecords(page);
  const property = records.Properties.find(
    ({ record }) => record.property_id === 'BACKUP-PR',
  ).record;
  expect(property.contact_id).toBe('BACKUP-CT');
  expect(property.media_photos[0].demo).toBe(true);
  expect(property.media_photos[0].src).toMatch(/^data:image\/jpeg;base64,/);
  expect(
    records.Clients.find(({ record }) => record.client_id === 'BACKUP-CL').record.custom_code,
  ).toBe(42);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(original);
  await page.goto('/#/properties');
  await page.getByLabel('Search properties', { exact: true }).fill('BACKUP-PR');
  await page.getByRole('button', { name: /BACKUP Villa/ }).click();
  await expect(page.locator('.media-photo-hero')).toContainText('Demo photo');
  await expect(page.locator('.media-photo-hero img')).toBeVisible();
  await expect
    .poll(() => page.locator('.media-photo-hero img').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('imported-demo-villa.png') });
  await page.keyboard.press('Escape');
  await openImport(page);
  const repeat = await reviewImport(page);
  expect(repeat.counts).toEqual({ Clients: 0, Contacts: 0, Properties: 0 });
  expect(repeat.skipped).toEqual({ Clients: 1, Contacts: 1, Properties: 1 });
  await committed(page);
});

test('full backup files preserve uploaded media and corrupt files never enable import', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await page.getByRole('button', { name: 'Import saved records', exact: true }).click();
  await page.getByRole('button', { name: 'Full JSON backup', exact: true }).click();
  const input = page.getByLabel('Full JSON backup', { exact: true });
  await input.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('alert')).toContainText('not a Keys with Simoni full backup');
  await expect(page.getByRole('button', { name: 'Preview import', exact: true })).toBeDisabled();
  const data = migrationData('UPLOAD');
  const photo = { name: 'Actual.png', src: 'data:image/png;base64,iVBORw0KGgo=' };
  data.Properties[0].media_photos = [photo];
  await input.setInputFiles({
    name: 'full.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createFullBackup(data))),
  });
  await reviewImport(page);
  await committed(page);
  const records = await serverRecords(page);
  expect(
    records.Properties.find(({ record }) => record.property_id === 'UPLOAD-PR').record.media_photos,
  ).toEqual([photo]);
});
