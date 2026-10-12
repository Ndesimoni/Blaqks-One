import { expect, test } from './helpers/session.js';
import { chooseFormSection, saveRecordForm } from './helpers/record-form.js';

test('new multi-section records validate each step, preserve backtracking edits and save only after review', async ({
  page,
}, testInfo) => {
  await page.goto('/#/clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  await expect(
    dialog.getByRole('button', { name: 'Step 3: Budget & financing', exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Create record', exact: true })).toHaveCount(0);
  await page.locator('#client_id').fill('CL-001');
  await page.locator('#email').fill('invalid');
  await next.click();
  await expect(page.locator('#client_id')).toBeFocused();
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#client_id').fill('CL-STEPS');
  await page.locator('#email').fill('steps@example.com');
  await page.locator('#full_name').fill('Step workflow client');
  await page.locator('#phone').press('Enter');
  await expect(dialog.locator('.form-progress')).toContainText('Step 2 of 6');
  await expect(dialog.locator('.form-step-title')).toBeFocused();
  await page.locator('#preferred_communities').fill('Dubai Marina');
  await next.click();
  await page.locator('#minimum_budget_aed').fill('500');
  await page.locator('#maximum_budget_aed').fill('100');
  await next.click();
  await expect(page.locator('#maximum_budget_aed')).toBeFocused();
  await page.locator('#maximum_budget_aed').fill('1500');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#preferred_communities')).toHaveValue('Dubai Marina');
  await next.click();
  await expect(page.locator('#maximum_budget_aed')).toHaveValue('1500');
  await next.click();
  await page.locator('#lead_quality_score_100').fill('101');
  await next.click();
  await expect(page.locator('#lead_quality_score_100')).toBeFocused();
  await page.locator('#lead_quality_score_100').fill('80');
  await next.click();
  await page.locator('#notes').fill('Retained across steps');
  await next.click();
  await expect(dialog.locator('.form-progress')).toContainText('Review & save');
  await expect(dialog.locator('.record-review')).toContainText('Dubai Marina');
  await expect(dialog.locator('.record-review')).toContainText('Retained across steps');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients.some(
        (row) => row.client_id === 'CL-STEPS',
      ),
    ),
  ).toBe(false);
  await dialog.getByRole('button', { name: 'Edit section: Contact details', exact: true }).click();
  await expect(page.locator('#email')).toHaveValue('steps@example.com');
  await page.locator('#full_name').fill('Reviewed step workflow client');
  await chooseFormSection(page, 'Step 6: Review & save');
  await expect(dialog.locator('.record-review')).toContainText('Reviewed step workflow client');
  await page.screenshot({ path: testInfo.outputPath('client-review-desktop.png') });
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('textbox', { name: 'Search Clients', exact: true }).fill('CL-STEPS');
  await page.getByRole('button', { name: 'Open record CL-STEPS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Retained across steps');
});

test('mobile property steps preserve photos and floor plans through review and reload', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/properties');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Add property', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  await page.locator('#listing_title').fill('Mobile step listing');
  await page.locator('#sale_rental').selectOption('Holiday home');
  await next.click();
  await page.locator('#community').fill('Dubai Marina');
  await next.click();
  await expect(page.locator('#price_basis')).toHaveValue('Nightly');
  await page.locator('#price_annual_rent_aed').fill('750');
  await next.click();
  const fixture = new URL('../fixtures/property-photo.jpg', import.meta.url).pathname;
  await page.getByLabel('Upload property photos').setInputFiles(fixture);
  await expect(page.locator('.editor-photo img')).toHaveCount(1);
  await page.getByLabel('Upload floor plans').setInputFiles(fixture);
  await expect(page.locator('.editor-plan')).toHaveCount(1);
  await page.getByRole('button', { name: 'Balcony', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#price_annual_rent_aed')).toHaveValue('750');
  await next.click();
  await expect(page.locator('.editor-photo img')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Balcony', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await next.click();
  await page.locator('#notes').fill('Mobile listing notes');
  await next.click();
  await expect(dialog.locator('.review-photo-list img')).toHaveCount(1);
  await expect(dialog.locator('.review-media')).toContainText('1 photo · 1 floor plan');
  await expect(dialog.locator('.record-review')).toContainText('Nightly');
  await expect(dialog.getByRole('button', { name: 'Create record', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('property-review-mobile-dark.png') });
  page.once('dialog', (event) => event.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await saveRecordForm(page);
  await page.reload();
  await page
    .getByRole('textbox', { name: 'Search properties', exact: true })
    .fill('Mobile step listing');
  await page.locator('.modern-property-card').first().click();
  await expect(page.locator('.media-photo-hero img')).toHaveCount(1);
  await expect(page.locator('.floorplan-list')).toContainText('property-photo.jpg');
  await expect(page.locator('.amenity-tags')).toContainText('Balcony');
});
