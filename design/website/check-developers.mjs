import { expect } from '@playwright/test';
import { developers } from './developer-data.js';
import { developerStock, matchingDevelopers } from './developer-model.js';

export async function checkDevelopers(page, base, root) {
  expect(developers).toHaveLength(40);
  expect(new Set(developers.map((d) => d.id)).size).toBe(40);
  expect(developers.every((d) => !d.website || new URL(d.website).protocol === 'https:')).toBe(
    true,
  );
  expect(developerStock('azizi')).toHaveLength(3);
  expect(developerStock('azizi', { site: 'harbour' })).toHaveLength(0);
  expect(
    matchingDevelopers(new URLSearchParams('availability=listed'), { site: 'harbour' }),
  ).toHaveLength(2);
  let profiles = 0;
  for (const site of ['', 'harbour']) {
    for (const developer of developers) {
      await page.goto(`${base}#/developer?id=${developer.id}&site=${site}`);
      await expect(page.locator('h1')).toHaveText(developer.name);
      await expect(page.locator('.property-card')).toHaveCount(
        developerStock(developer.id, { site }).length,
      );
      if (site) await expect(page.locator('body')).toHaveAttribute('data-site', site);
      profiles++;
    }
  }
  const ids = [];
  for (let index = 1; index <= 4; index++) {
    await page.goto(`${base}#/developers?page=${index}`);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'developers');
    await expect(page.locator('.developer-card')).toHaveCount(index < 4 ? 12 : 4);
    ids.push(
      ...(await page
        .locator('.developer-card h3 a')
        .evaluateAll((items) => items.map((item) => item.getAttribute('href')))),
    );
  }
  expect(new Set(ids).size).toBe(40);
  await page.goto(`${base}#/developers?site=harbour`);
  await page.getByLabel('Developer name').fill('  SoBhA  ');
  await page.getByRole('button', { name: 'Search developers →' }).click();
  await expect(page.locator('.developer-card')).toHaveCount(1);
  await expect(page.locator('.developer-card h3')).toHaveText('Sobha Realty');
  await page.locator('.developer-card h3 a').click();
  await expect(page.locator('h1')).toHaveText('Sobha Realty');
  await page.getByRole('link', { name: 'Browse developer properties →' }).click();
  await expect(page.locator('select[name="developer"]')).toHaveValue('sobha');
  await expect(page.locator('.chip')).toContainText('Developer: Sobha Realty');
  await expect(page.locator('.property-card')).toHaveCount(3);
  await page.getByLabel('Company theme').selectOption('4');
  await expect(page).toHaveURL(/developer=sobha/);
  await expect(page.locator('.property-card')).toHaveCount(3);
  await page.locator('select[name="developer"]').selectOption('azizi');
  await page.getByRole('button', { name: 'Apply filters →' }).click();
  await expect(page.locator('.property-card')).toHaveCount(0);
  await expect(page.locator('.chip')).toContainText('Azizi Developments');
  await page.goto(`${base}#/developer?id=not-a-developer&site=harbour`);
  await expect(page.locator('.developer-profile')).toHaveCount(0);
  let reflowChecks = 0;
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const site of ['', 'harbour']) {
      for (const theme of site ? ['1', '4'] : ['1']) {
        for (const [path, extra] of [
          ['home', ''],
          ['developers', ''],
          ['developer', '&id=emaar'],
          ['developer', '&id=azizi'],
        ]) {
          await page.goto(
            `${base}?developer-check=${reflowChecks}#/${path}?site=${site}&theme=${theme}${extra}`,
          );
          await expect(page.locator('body')).toHaveAttribute('data-page', path);
          if (path === 'home')
            await expect(page.locator('.developer-section .developer-card')).toHaveCount(6);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          if ([1440, 390].includes(width) && ['home', 'developers'].includes(path)) {
            await page.evaluate(() => document.activeElement?.blur());
            const capture =
              path === 'home' ? page.locator('.developer-section') : page.locator('main');
            await capture.screenshot({
              path: `${root}screenshots/developers-${path}-${site || 'general'}-${theme}-${width}.png`,
              style: '.review-bar { display: none; }',
            });
          }
          reflowChecks++;
        }
      }
    }
  }
  await page.goto(`${base}#/home?site=harbour&theme=4`);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#nav').getByRole('link', { name: 'Developers', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Explore UAE developers.');
  await expect(page.locator('.company-header [aria-current="page"]')).toHaveText('Developers');
  await page.goto(`${base}dist/developers-preview.html`);
  await expect(page.locator('h1')).toHaveText('Explore UAE developers.');
  return {
    developers: developers.length,
    profiles,
    reflowChecks,
    directoryAndFilters: 'passed',
    companyScope: 'passed',
  };
}
