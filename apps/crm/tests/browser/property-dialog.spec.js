import { expect, test } from './helpers/session.js';
import { saveRecordForm } from './helpers/record-form.js';

async function expectPropertyLayout(page, fullScreen = false) {
  const panel = page.getByRole('dialog').locator('.drawer');
  const viewport = page.viewportSize();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
  if (fullScreen) {
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(box.height).toBe(viewport.height);
  } else {
    expect(box.x).toBeGreaterThanOrEqual(24);
    expect(box.y).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThan(900);
  }
  const footer = await panel.locator('.drawer-footer').boundingBox();
  expect(footer.y + footer.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('centered property dialogs retain media, edits, keyboard controls and close protection', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/properties');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  const card = page.locator('.modern-property-card').first();
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectPropertyLayout(page);
  await expect(page.getByRole('dialog').locator('h2')).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expectPropertyLayout(page);
  await page.getByRole('button', { name: 'Add property photos', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.locator('h2')).toBeFocused();
  await expectPropertyLayout(page);
  expect(await editor.locator('.drawer-body').evaluate((body) => body.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('property-editor-desktop.png') });
  await page
    .getByLabel('Upload property photos')
    .setInputFiles(new URL('../fixtures/property-photo.jpg', import.meta.url).pathname);
  await expect(page.locator('.editor-photo img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Step 1: Basic details', exact: true }).click();
  await page.locator('#listing_title').fill('Centered property workflow');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.mouse.click(8, 8);
  await expect(editor).toBeVisible();
  await expect(page.locator('#listing_title')).toHaveValue('Centered property workflow');
  await editor.getByRole('button', { name: 'Next', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close record editor' })).toBeFocused();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  await saveRecordForm(page);
  await expect(editor).toHaveCount(0);
  await page.reload();
  await card.click();
  await expect(page.getByRole('dialog').locator('h2')).toHaveText('Centered property workflow');
  await expect(page.locator('.media-photo-hero img')).toHaveCount(1);
  await expectPropertyLayout(page);
  await page.screenshot({ path: testInfo.outputPath('property-viewer-desktop.png') });
  await page.getByRole('button', { name: 'Close record details' }).click();
  await expect(card).toBeFocused();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await card.click();
  await expectPropertyLayout(page);
  await page.screenshot({ path: testInfo.outputPath('property-viewer-desktop-dark.png') });
  await page.mouse.click(8, 8);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const add = page.getByRole('button', { name: 'Add property', exact: true });
  await add.click();
  await page.locator('#property_id').fill('PR-DISCARDED');
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(add).toBeFocused();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Properties.some(
        (record) => record.property_id === 'PR-DISCARDED',
      ),
    ),
  ).toBe(false);
});

test('mobile property viewers and editors fill the screen with independently scrolling content', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/properties');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.modern-property-card').first().click();
  await expectPropertyLayout(page, true);
  const body = page.getByRole('dialog').locator('.drawer-body');
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Close record details' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Edit record' })).toBeInViewport();
  await page.getByRole('button', { name: 'Edit record' }).click();
  await expectPropertyLayout(page, true);
  await page.getByRole('button', { name: 'Step 4: Photos & presentation', exact: true }).click();
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('property-editor-mobile-dark.png') });
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Close record editor' })).toBeInViewport();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});
