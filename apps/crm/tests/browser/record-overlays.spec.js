import { expect, test } from './helpers/session.js';
import { expectRecordOverlay } from './helpers/record-overlay.js';

test('mobile lead and contact overlays keep controls visible, scroll internally and protect drafts', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/leads');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.data-table tbody tr').first().click();
  await expectRecordOverlay(page, { fullScreen: true });
  const workspaceBefore = await page.evaluate(() =>
    localStorage.getItem('kws-crm-v1:workspace:aidah'),
  );
  const dialog = page.getByRole('dialog');
  const body = dialog.locator('.drawer-body');
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(
    page.getByRole('button', { name: 'Close record details', exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Edit lead', exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('lead-details-overlay-mobile-dark.png') });
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  await expectRecordOverlay(page, { fullScreen: true });
  await page.locator('#full_name').fill('Unsaved overlay draft');
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(
    page.getByRole('button', { name: 'Close record editor', exact: true }),
  ).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('lead-editor-overlay-mobile-dark.png') });
  page.once('dialog', (event) => event.dismiss());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#full_name')).toHaveValue('Unsaved overlay draft');
  page.once('dialog', (event) => event.accept());
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    workspaceBefore,
  );
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

  await page.goto('/#/contacts');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  await expectRecordOverlay(page, { fullScreen: true });
  await expect(dialog.locator('.form-stepper')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('contact-overlay-mobile-dark.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.data-table tbody tr').first().click();
  await expectRecordOverlay(page, { fullScreen: true });
  await page.getByRole('button', { name: 'Close record details', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
