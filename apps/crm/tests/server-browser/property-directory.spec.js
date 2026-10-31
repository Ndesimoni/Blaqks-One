import { add } from '../api/assignment-helpers.mjs';
import { login } from '../api/helpers.mjs';
import { expect, test } from './fixtures.js';
import { signIn } from './helpers.js';

test('property cards and table share twelve-per-page filters and media fallback', async ({
  page,
}) => {
  const admin = await login();
  for (let index = 1; index <= 13; index += 1) {
    const suffix = String(index).padStart(2, '0');
    await add(admin, 'Properties', {
      property_id: `UI4B-${suffix}`,
      listing_title: `UI4b listing ${suffix}`,
      listing_status: 'Available',
      sale_rental: 'Sale',
      property_type: 'Apartment',
      emirate: index === 13 ? 'Abu Dhabi' : 'Dubai',
      community: 'Synthetic community',
      price_annual_rent_aed: String(1_000_000 + index),
    });
  }
  await page.route('**/demo/apartment-interior.jpg', (route) => route.abort());
  await signIn(page);
  await page.goto('/#/properties');
  await page.getByLabel('Search properties').fill('UI4b listing');
  await expect(
    page.getByRole('button', { name: 'Remove Search: UI4b listing filter' }),
  ).toBeVisible();
  await expect(page.locator('.modern-property-card')).toHaveCount(12);
  await expect(page.getByText('Photo unavailable').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Property filters' })).toBeHidden();
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click();
  await page.getByLabel('Emirate', { exact: true }).selectOption('Abu Dhabi');
  const chips = page.getByLabel('Active property filters');
  await expect(
    chips.getByRole('button', { name: 'Remove Emirate: Abu Dhabi filter' }),
  ).toBeVisible();
  await expect(page.locator('.modern-property-card')).toHaveCount(1);
  await chips.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Search properties').fill('UI4b listing');
  await page.getByRole('button', { name: 'Table view' }).click();
  const table = page.getByRole('table', { name: 'Properties records' });
  await expect(table.locator('tbody tr')).toHaveCount(12);
  await page
    .getByRole('navigation', { name: 'Properties pages' })
    .getByRole('button', {
      name: 'Next',
    })
    .click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Card view' }).click();
  await expect(page.locator('.modern-property-card')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.property-grid-refined')).toHaveCSS('grid-template-columns', '358px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
