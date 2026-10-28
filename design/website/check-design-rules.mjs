import { expect } from '@playwright/test';

export async function checkDesignRules(page, base) {
  await page.goto(`${base}#/properties`);
  await expect(page.locator('input[name="maxPrice"]')).toBeDisabled();
  await page.locator('select[name="purpose"]').selectOption('rent');
  await expect(page.locator('input[name="maxPrice"]')).toBeEnabled();
  await expect(page.locator('[data-price-basis]')).toContainText('annual rent');
  await page.locator('input[name="maxPrice"]').fill('150000');
  await page.getByRole('button', { name: /Apply filters/ }).click();
  const labels = await page.locator('.price').allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => label.includes('/ year'))).toBe(true);
  await page.locator('select[name="purpose"]').selectOption('holiday');
  await expect(page.locator('input[name="maxPrice"]')).toHaveValue('');
  await expect(page.locator('[data-price-basis]')).toContainText('nightly rate');
  await page.goto(`${base}#/properties?budget=150000`);
  await expect(page.locator('.notice')).toContainText('not comparable');
  await expect(page.locator('.property-card')).toHaveCount(0);
  await page.goto(`${base}#/home?site=harbour&theme=4`);
  return checkContrasts(page, [
    '.header nav a',
    '.search-fields label',
    '.property-card .price',
    '.property-card h3',
    '.person-card h3',
  ]);
}

export async function checkContrasts(page, selectors) {
  const contrasts = await page.evaluate((selectors) => {
    const rgb = (text) => (text.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (values) =>
      values
        .map((value) => {
          const s = value / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      const foreground = getComputedStyle(element).color;
      let surface = element;
      while (
        surface &&
        ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(surface).backgroundColor)
      )
        surface = surface.parentElement;
      const background = getComputedStyle(surface || document.body).backgroundColor;
      const a = luminance(rgb(foreground)),
        b = luminance(rgb(background));
      return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  }, selectors);
  for (const result of contrasts) expect(result.ratio, result.selector).toBeGreaterThanOrEqual(4.5);
  return contrasts;
}
