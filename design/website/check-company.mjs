import { expect } from '@playwright/test';
import { companies, properties, areas } from './data.js';

export async function checkCompanyDesign(page, base, root) {
  let routeChecks = 0;
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['1', '2', '3', '4']) {
      for (const company of companies) {
        await page.goto(`${base}#/home?site=${company.id}&theme=${theme}`);
        await expect(page.locator('body')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('body')).toHaveAttribute('data-site', company.id);
        await expect(page.locator('.company-header .company-wordmark')).toContainText(company.name);
        const locationIds = [
          ...new Set(properties.filter((p) => p.company === company.id).map((p) => p.area)),
        ];
        await expect(page.locator('.company-area-card')).toHaveCount(locationIds.length);
        const choices = await page.locator('select[name="area"] option').allTextContents();
        expect(choices.slice(1).sort()).toEqual(
          areas
            .filter((area) => locationIds.includes(area.id))
            .map((a) => a.name)
            .sort(),
        );
        if (width <= 760) {
          const hero = await page.locator('.company-hero').boundingBox();
          const search = await page.locator('.company-search-wrap').boundingBox();
          expect(search.y).toBeGreaterThanOrEqual(hero.y + hero.height - 1);
          const image = await page.locator('.company-area-card img').first().boundingBox();
          expect(image.height).toBeLessThan(image.width);
        }
        await checkReflow(page);
        routeChecks++;
      }
      for (const [path, params] of [
        ['properties', ''],
        ['property', '&id=1'],
        ['agents', ''],
        ['agent', '&id=maya'],
        ['about', ''],
        ['contact', ''],
        ['enquiry', '&company=harbour'],
      ]) {
        await page.goto(`${base}#/${path}?site=harbour&theme=${theme}${params}`);
        await expect(page.locator('body')).toHaveAttribute('data-page', path);
        await expect(page.locator('body')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('main h1').first()).toBeVisible();
        await checkReflow(page);
        if (
          ['1', '4'].includes(theme) &&
          [1440, 390].includes(width) &&
          ['about', 'contact', 'properties', 'agent'].includes(path)
        ) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `${root}screenshots/company-${path}-${theme}-${width}.png`,
            fullPage: true,
            style: '.review-bar { display: none; }',
          });
        }
        routeChecks++;
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}#/home?site=harbour&theme=1`);
  await page.getByRole('radio', { name: 'Rent', exact: true }).check();
  await page.locator('input[name="maxPrice"]').fill('150000');
  await page.getByRole('button', { name: /Search properties/ }).click();
  await expect(page).toHaveURL(/site=harbour/);
  await expect(page.locator('.property-card')).toHaveCount(1);
  await expect(page.locator('.price')).toContainText('/ year');
  await page.getByLabel('Company theme').selectOption('4');
  await expect(page).toHaveURL(/purpose=rent/);
  await expect(page).toHaveURL(/theme=4/);
  await expect(page.locator('.property-card')).toHaveCount(1);
  await page.locator('.property-image').click();
  await expect(page.locator('.company-header [aria-current="page"]')).toHaveText('Properties');
  await expect(page.locator('.enquiry-panel .contact-whatsapp')).toHaveAttribute(
    'href',
    /447700900001/,
  );
  await page.locator('.enquiry-panel').getByRole('link', { name: 'View agent profile' }).click();
  await expect(page.locator('h1')).toHaveText('Maya Reed');
  await expect(page.locator('.company-header [aria-current="page"]')).toHaveText('Our people');
  await page.goto(`${base}#/contact?site=harbour&theme=4`);
  await expect(page.locator('.company-contact-person')).toHaveCount(2);
  await page.getByRole('link', { name: 'Enquire with the company →' }).click();
  await expect(page.locator('input[name="company"]')).toHaveValue('harbour');
  await page.goto(`${base}#/property?id=3&site=harbour`);
  await expect(page.locator('.detail-title')).toHaveCount(0);
  await page.goto(`${base}#/home`);
  await expect(page.locator('body')).not.toHaveClass(/company-site/);
  await expect(page.locator('.hero h1')).toHaveText('A better placeto call home.');
  await page.goto(`${base}dist/company-preview.html`);
  await expect(page.locator('.company-header .company-wordmark')).toContainText('Harbour & Palm');
  return { routeChecks, companyScope: 'passed', enquiryJourney: 'passed', companyExport: 'passed' };
}

async function checkReflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
