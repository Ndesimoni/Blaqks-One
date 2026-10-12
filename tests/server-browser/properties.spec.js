import { test, expect } from './fixtures.js';
import { saveRecordForm, session, signIn } from './helpers.js';

test('a linked contact and property photos persist through the real forms and database', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page, 'admin-b');
  await page.goto('/#/contacts');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  await page.getByLabel('Contact ID').fill('BROWSER-LANDLORD');
  await page.getByLabel('Full name').fill('Synthetic Landlord');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#/properties');
  await page.getByRole('button', { name: 'Add property', exact: true }).click();
  await page.getByLabel('Property ID').fill('BROWSER-PROPERTY');
  await page.getByLabel('Listing title').fill('Connected property with photos');
  await page.getByLabel('Contact ID').selectOption('BROWSER-LANDLORD');
  for (let step = 0; step < 3; step++) {
    await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByText('CRM storage', { exact: true })).toBeVisible();
  await expect(page.getByText('Browser storage', { exact: true })).toHaveCount(0);
  await page
    .getByLabel('Upload property photos')
    .setInputFiles(new URL('../fixtures/property-photo.jpg', import.meta.url).pathname);
  await expect(page.locator('.editor-photo img')).toHaveCount(1);
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /Connected property with photos/ }).click();
  await expect(page.locator('.media-photo-hero img')).toBeVisible();
  expect(
    await page.locator('.media-photo-hero img').evaluate((image) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.getByRole('dialog').getByRole('button', { name: /Start message/ })).toHaveCount(
    0,
  );
  await page.screenshot({ path: testInfo.outputPath('connected-property-desktop.png') });
  const identity = await session(page);
  const response = await page.request.get(`/api/crm/workspaces/${identity.user.id}/records`);
  const entry = (await response.json()).records.Properties.find(
    (row) => row.record.property_id === 'BROWSER-PROPERTY',
  );
  expect(entry.record.contact_id).toBe('BROWSER-LANDLORD');
  expect(entry.record.media_photos).toHaveLength(1);
  expect(entry.record.media_photos[0].src).toMatch(/^data:image\//);
  await page.getByRole('button', { name: 'Close record details' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: /Connected property with photos/ }).click();
  await expect(page.getByRole('button', { name: 'Edit record' })).toBeInViewport();
  const panel = await page.getByRole('dialog').locator('.drawer').boundingBox();
  expect(panel.x).toBe(0);
  expect(panel.width).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('connected-property-mobile-light.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
