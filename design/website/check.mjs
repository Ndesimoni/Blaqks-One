import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { screens } from './screen-index.js';
import { url } from './helpers.js';
import { checkDesignRules } from './check-design-rules.mjs';

const base = 'http://127.0.0.1:4178/';
const root = fileURLToPath(new URL('.', import.meta.url));
await mkdir(`${root}screenshots`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const failures = [];
const routes = screens.flatMap(([, items]) =>
  items.map(([title, path, params]) => [title, url(path, params)]),
);
const pictures = {
  Homepage: 'general-home',
  'All properties': 'properties',
  'Companies directory': 'companies',
  'Company profile': 'company-profile',
  'Agents directory': 'agents',
  'Agent profile': 'agent-profile',
  'Property detail': 'property-detail',
  'Listing enquiry': 'enquiry',
  'Brand & design': 'website-editor',
  'Public review and diff': 'platform-review',
};
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    for (const [title, route] of routes) {
      await page.goto(base + route);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow) failures.push(`${width}px overflow: ${title}`);
      const duplicateMain = await page.locator('#main').count();
      if (duplicateMain !== 1) failures.push(`${title}: ${duplicateMain} main IDs`);
      if (pictures[title])
        await page.screenshot({
          path: `${root}screenshots/${pictures[title]}-${width}.png`,
          fullPage: true,
          style: '.review-bar { display: none; }',
        });
    }
    for (const theme of ['1', '2', '3', '4']) {
      for (const [path, params] of [
        ['home', {}],
        ['properties', {}],
        ['property', { id: '1' }],
        ['agent', { id: 'maya' }],
        ['contact', {}],
      ]) {
        await page.goto(base + url(path, { site: 'harbour', theme, ...params }));
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (overflow) failures.push(`${width}px overflow: theme ${theme} ${path}`);
      }
      await page.goto(base + url('home', { site: 'harbour', theme }));
      await page.screenshot({
        path: `${root}screenshots/company-theme-${theme}-${width}.png`,
        fullPage: true,
        style: '.review-bar { display: none; }',
      });
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator('select[name="area"]').selectOption('marina');
  await page.getByRole('button', { name: /Search properties/ }).click();
  await expect(page).toHaveURL(/area=marina/);
  await expect(page.locator('.property-card')).toHaveCount(2);
  await page.locator('.property-image').first().click();
  await expect(page.locator('.detail-title')).toBeVisible();
  await page.locator('[data-action="gallery"]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page
    .getByRole('link', { name: /Enquire about this property/ })
    .first()
    .click();
  await page.getByLabel('Your name').fill('Fictional Visitor');
  await page.getByLabel('Your message').fill('Synthetic design enquiry only.');
  await page.getByRole('button', { name: /Preview confirmation/ }).click();
  await expect(page.locator('.form-error')).toContainText('email or phone');
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.test');
  await page.getByRole('button', { name: /Preview confirmation/ }).click();
  await expect(
    page.getByText('Demonstration only — nothing was sent or saved to the CRM.'),
  ).toBeVisible();
  await page.goto(base + '#/editor?section=design');
  await page.getByLabel('Public site title').fill('Fictional updated website');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toContainText('Nothing published');
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByText('Submitted for review', { exact: true })).toBeVisible();
  await page.goto(base + '#/index');
  await expect(page.locator('.index-group')).toHaveCount(6);
  const contrasts = await checkDesignRules(page, base);
  await page.goto(`${base}dist/review.html#/companies`);
  await expect(page.getByRole('heading', { name: 'Find your property company.' })).toBeVisible();
  const remoteRequests = [];
  page.on('request', (req) => {
    if (/^https?:/.test(req.url())) remoteRequests.push(req.url());
  });
  await page
    .getByRole('link', { name: /View company/ })
    .first()
    .click();
  await expect(page.locator('h1')).toContainText('Harbour & Palm');
  expect(remoteRequests).toEqual([]);
  await page.close();
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  const report = {
    routes: routes.length,
    viewports: [1440, 390],
    themeRouteChecks: 40,
    errors,
    failures,
    interactions: 'passed',
    standalone: 'passed',
    darkThemeContrast: contrasts,
  };
  await writeFile(`${root}dist/check-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
