import { expect } from '@playwright/test';
import { checkContrasts } from './check-design-rules.mjs';

export async function checkPropertyFilters(page, base, root) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}?filter-flow#/home`);
  await expect(page.locator('select[name="emirate"] option')).toHaveCount(8);
  await page.getByLabel('Emirate', { exact: true }).selectOption('dubai');
  await page.getByLabel('Community / area', { exact: true }).selectOption('marina');
  await page.getByLabel('Emirate', { exact: true }).selectOption('abu-dhabi');
  await expect(page.getByLabel('Community / area', { exact: true })).toHaveValue('');
  await expect(page.locator('select[name="area"] option')).toHaveCount(2);
  await page.getByLabel('Min budget (AED)', { exact: true }).fill('3000000');
  await page.getByLabel('Max budget (AED)', { exact: true }).fill('2000000');
  await page.getByRole('button', { name: 'Search properties' }).click();
  await expect(page.locator('#filter-error')).toContainText('Maximum budget');
  await expect(page.getByLabel('Min budget (AED)', { exact: true })).toHaveValue('3000000');
  await expect(page.getByLabel('Max budget (AED)', { exact: true })).toBeFocused();
  await page.getByLabel('Min budget (AED)', { exact: true }).fill('2000000');
  await page.getByLabel('Max budget (AED)', { exact: true }).fill('3000000');
  await page.getByRole('button', { name: 'Search properties' }).click();
  await expect(page.locator('.property-card')).toHaveCount(1);
  await expect(page.locator('.chips')).toContainText('Abu Dhabi');
  await expect(page.locator('.chips')).toContainText('AED 2,000,000–3,000,000');
  await page.getByLabel('Sort properties').selectOption('price-desc');
  await expect(page).toHaveURL(/minPrice=2000000/);
  await page.getByLabel('Emirate', { exact: true }).selectOption('dubai');
  await page.getByRole('button', { name: 'Apply filters →' }).click();
  await expect(page.getByLabel('Sort properties')).toHaveValue('price-desc');
  await page.getByLabel('Purpose', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Apply filters →' }).click();
  await expect(page.getByLabel('Sort properties')).toHaveValue('newest');
  await page.goto(`${base}?amenity-flow#/properties?purpose=buy&emirate=dubai`);
  await page.getByText('Size & amenities', { exact: true }).click();
  await page.getByLabel('Swimming pool', { exact: true }).check();
  await page.getByLabel('Private garden', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply filters →' }).click();
  await expect(page).toHaveURL(/amenities=pool%2Cgarden/);
  await expect(page.locator('.property-card')).toHaveCount(2);
  await expect(page.locator('.chips')).toContainText('Swimming pool, Private garden');
  await page.goto(`${base}#/properties?purpose=buy&bedrooms=studio`);
  await expect(page.locator('.property-card')).toHaveCount(1);
  await expect(page.locator('.facts')).toContainText('Studio');
  await page.getByLabel('Property type', { exact: true }).selectOption('Office');
  await expect(page.getByLabel('Bedrooms', { exact: true })).toBeDisabled();
  await page.goto(`${base}#/properties?purpose=holiday&guests=4&nights=2`);
  await expect(page.locator('.property-card')).toHaveCount(2);
  await page.getByLabel('Purpose', { exact: true }).selectOption('rent');
  await expect(page.locator('input[name="nights"]')).toBeDisabled();
  await expect(page.locator('input[name="minPrice"]')).toHaveValue('');
  await expect(page.locator('[data-price-basis]')).toContainText('annual rent');
  let reflowChecks = 0;
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['general', '1', '2', '3', '4']) {
      const scope = theme === 'general' ? '' : `&site=harbour&theme=${theme}`;
      for (const path of [
        'home',
        'properties?purpose=buy&emirate=dubai&minPrice=2000000&maxPrice=3000000&bedrooms=studio&amenities=gym',
      ]) {
        await page.goto(
          `${base}?search-review=${reflowChecks}#/${path}${path.includes('?') ? '' : '?'}${scope}`,
        );
        await expect(page.locator('body')).toHaveAttribute('data-page', path.split('?')[0]);
        if (width <= 1000 && path.startsWith('properties'))
          await page.getByRole('button', { name: /Filters & search/ }).click();
        if (path === 'home') {
          await page.getByText('More filters', { exact: false }).first().click();
          const hero = await page
            .locator(theme === 'general' ? '.hero' : '.company-hero')
            .boundingBox();
          const search = await page.locator('[data-form="search"]').boundingBox();
          if (width <= 760) expect(search.y).toBeGreaterThanOrEqual(hero.y + hero.height - 1);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if ([1440, 390].includes(width) && ['general', '1', '4'].includes(theme)) {
          await page.evaluate(() => document.activeElement?.blur());
          await page.screenshot({
            path: `${root}screenshots/search-${theme}-${path === 'home' ? 'advanced' : 'results'}-${width}.png`,
            fullPage: true,
            style: '.review-bar { display:none; }',
          });
        }
        reflowChecks++;
      }
    }
  }
  await page.goto(`${base}?mobile-draft#/properties?purpose=buy&site=harbour&theme=4`);
  await page.getByRole('button', { name: /Filters & search/ }).click();
  await page.getByLabel('Min budget (AED)', { exact: true }).fill('1234567');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Filters & search/ })).toBeFocused();
  await page.getByRole('button', { name: /Filters & search/ }).click();
  await expect(page.getByLabel('Min budget (AED)', { exact: true })).toHaveValue('1234567');
  await page.goto(`${base}#/enquiry?site=harbour&company=harbour&agent=leila`);
  await expect(page.locator('form[data-form="enquiry"]')).toHaveCount(0);
  await page.goto(`${base}#/enquiry?agent=maya&site=harbour&theme=4`);
  await expect(page.locator('.page-heading')).toContainText('Maya Reed');
  await expect(page.getByRole('link', { name: 'privacy notice', exact: true })).not.toHaveClass(
    /button/,
  );
  await page.goto(
    `${base}#/properties?purpose=buy&minPrice=3000000&maxPrice=2000000&site=harbour&theme=4`,
  );
  const errorContrast = await checkContrasts(page, [
    '.filter-error-summary',
    '.field-error:not(:empty)',
  ]);
  return {
    reflowChecks,
    errorContrast,
    ranges: 'passed',
    geography: 'passed',
    amenities: 'passed',
    mobileDraftAndEscape: 'passed',
    enquiryOwnership: 'passed',
  };
}
