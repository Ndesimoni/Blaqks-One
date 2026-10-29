import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkContrasts } from '../../../design/website/check-design-rules.mjs';

const base = process.env.WEBSITE_TEST_ORIGIN || 'http://localhost:3001';
const root = new URL('../', import.meta.url);
await mkdir(new URL('screenshots/', root), { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [],
  errors = [];
let checks = 0;
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/www.openstreetmap.org/**', (route) => route.abort());
  const paths = [
    '/',
    '/properties',
    '/properties/1',
    '/companies',
    '/companies/harbour',
    '/agents',
    '/agents/maya',
    '/developers',
    '/developers/emaar',
    '/areas',
    '/areas/marina',
    '/about',
    '/contact',
    '/enquiry?listing=1',
    '/privacy',
    '/terms',
  ];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of paths) {
      const response = await page.goto(base + path);
      expect(response.status()).toBe(200);
      await expect(page.locator('main h1').first()).toBeVisible();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
        failures.push(`${width}px ${path}`);
      checks++;
    }
  }
  await page.goto(base + '/');
  await expect(page.getByLabel('Emirate', { exact: true }).locator('option')).toHaveCount(8);
  await page.getByLabel('Purpose', { exact: true }).selectOption('buy');
  await page.getByLabel('Emirate', { exact: true }).selectOption('dubai');
  await page.getByLabel('Min budget (AED)').fill('2000000');
  await page.getByLabel('Max budget (AED)').fill('3000000');
  await page.getByText('More filters', { exact: false }).click();
  await page.getByLabel('Bedrooms', { exact: true }).selectOption('studio');
  await page.getByRole('button', { name: 'Search properties →', exact: true }).last().click();
  await expect(page.locator('.property-card')).toHaveCount(1);
  await expect(page).toHaveURL(/bedrooms=studio/);
  await page.goto(base + '/properties?purpose=buy&minPrice=3000000&maxPrice=2000000');
  await expect(page.locator('.form-error[role="alert"]')).toContainText('Maximum budget');
  await expect(page.locator('.property-card')).toHaveCount(0);
  await page.goto(base + '/properties/1');
  await expect(page.locator('#location iframe')).toHaveCount(0);
  await page.locator('#location').scrollIntoViewIfNeeded();
  await expect(page.locator('#location')).toContainText('Approximate location.');
  await expect(page.locator('#location iframe')).toHaveCount(1);
  expect(
    new URL(await page.locator('#location iframe').getAttribute('src')).searchParams.has('marker'),
  ).toBe(false);
  const whatsapp = page.locator('a[href^="https://wa.me/"]').first();
  await expect(whatsapp).toHaveAttribute('href', /447700900001/);
  await page.getByRole('link', { name: /Ask agent for exact location/ }).click();
  await expect(page).toHaveURL(/listing=1/);
  await expect(page.locator('main')).toContainText('Maya Reed');
  for (const host of ['harbour', 'harbour-modern', 'harbour-editorial', 'harbour-nocturne']) {
    const companyBase = base.replace('localhost', `${host}.localhost`);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['/', '/properties', '/properties/1']) {
        await page.goto(companyBase + path);
        await expect(page.locator('main h1').first()).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        checks++;
      }
      await page.goto(companyBase + '/');
      if (width === 1280)
        await checkContrasts(page, [
          '.wordmark',
          '.property-card h3',
          '.price',
          '.property-card .muted',
        ]);
      if (width !== 320)
        await page.screenshot({
          path: new URL(`screenshots/${host}-${width}.png`, root).pathname,
          fullPage: true,
        });
    }
    const response = await page.goto(companyBase + '/properties/3');
    expect(response.status()).toBe(404);
    await expect(page.locator('main')).not.toContainText('Leila Brooks');
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(base + '/');
  const menu = page.locator('.mobile-menu summary');
  await menu.click();
  await expect(page.locator('.mobile-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  await expect(menu).toBeFocused();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  const response = await staticPage.goto(base + '/properties?purpose=buy');
  expect(response.status()).toBe(200);
  await expect(staticPage.locator('.property-card')).toHaveCount(6);
  await expect(staticPage.locator('main h1')).toBeVisible();
  await context.close();
  const unknown = await page.request.get(base + '/', { headers: { host: 'unknown.localhost' } });
  expect(unknown.status()).toBe(404);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  const report = {
    routeReflowChecks: checks,
    nativeSearch: 'passed',
    contactOwnership: 'passed',
    companyIsolation: 'passed',
    noJavaScriptSSR: 'passed',
    keyboardMenu: 'passed',
    errors,
    failures,
  };
  await writeFile(new URL('browser-report.json', root), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
