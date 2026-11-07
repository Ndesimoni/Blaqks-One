import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against `WEBSITE_DATA_MODE=sample npm start`; set WEBSITE_BROWSER_CHANNEL=chrome to use Chrome.
const base = process.env.WEBSITE_TEST_ORIGIN || 'http://localhost:3001';
const root = new URL('../', import.meta.url);
await mkdir(new URL('screenshots/', root), { recursive: true });
const channel = process.env.WEBSITE_BROWSER_CHANNEL || undefined;
const browser = await chromium.launch({ headless: true, channel });
const failures = [];
const errors = [];
const counts = { main: 0, company: 0, flows: 0 };
const check = async (label, run) => {
  try {
    await run();
  } catch (error) {
    failures.push(`${label}: ${error.message.split('\n')[0]}`);
  }
};
const hostBase = (host) => base.replace('//localhost', `//${host}.localhost`);
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const overlaps = (page, a, b) =>
  page.evaluate(
    ([x, y]) => {
      const one = document.querySelector(x)?.getBoundingClientRect();
      const two = document.querySelector(y)?.getBoundingClientRect();
      if (!one || !two || !one.width || !two.width) return false;
      return (
        one.left < two.right && two.left < one.right && one.top < two.bottom && two.top < one.bottom
      );
    },
    [a, b],
  );
const mainPaths = ['/', '/properties', '/properties/1', '/companies', '/companies/0', '/agents'];
mainPaths.push('/agents/0', '/areas', '/areas/1', '/developers', '/developers/emaar', '/deals');
mainPaths.push('/about', '/contact', '/privacy', '/terms');
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (m) => {
    // Foreign-listing checks deliberately load 404 pages.
    if (m.type() === 'error' && !page.url().endsWith('/properties/3'))
      errors.push(`${page.url()}: ${m.text()}`);
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const path of mainPaths)
      await check(`main ${width}px ${path}`, async () => {
        expect((await page.goto(base + path)).status()).toBe(200);
        await expect(page.locator('#app h1').first()).toBeVisible();
        await expect(page.locator('#app h1').first()).not.toHaveText(/Opening Blaqks One/);
        expect(await fits(page), 'no horizontal overflow').toBe(true);
        counts.main++;
      });
    await check(`main ${width}px home developers`, async () => {
      await page.goto(base + '/');
      await expect(page.locator('#home-developers .e-partner')).toHaveCount(6);
      const columns = await page
        .locator('.u-developer-tiles')
        .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(width === 390 ? 1 : 3);
      await page.screenshot({ path: new URL(`screenshots/main-${width}.png`, root).pathname });
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const hops = [
    ['/areas', 'a.u-card-link >> nth=0', /\/areas\/0(#|$)/, 'Palm Jumeirah'],
    ['/developers', 'a.u-card-link >> nth=0', /\/developers\/emaar(#|$)/, 'Emaar'],
    ['/companies', 'a.u-card-link >> nth=0', /\/companies\/0(#|$)/, 'Coastal & Co.'],
    ['/companies/0', 'a.u-card-link >> nth=0', /\/agents\/0(#|$)/, 'Alex Morgan'],
    ['/', 'footer >> text=Developers', /\/developers(#|$)/, 'The developers shaping the UAE.'],
  ];
  for (const [from, link, url, title] of hops)
    await check(`click ${from} -> ${title}`, async () => {
      await page.goto(base + from);
      await expect(page.locator('#app h1').first()).toBeVisible();
      await page.locator(link).click();
      await expect(page).toHaveURL(url, { timeout: 1000 });
      await expect(page.locator('#app h1').first()).toHaveText(title, { timeout: 1000 });
      counts.flows++;
    });
  await check('directories filter and paginate', async () => {
    await page.goto(base + '/developers');
    await expect(page.locator('.u-place-card')).toHaveCount(12);
    await expect(page.locator('.u-directory-toolbar')).toContainText('40 developers');
    await page.goto(base + '/areas/1');
    await expect(page.locator('.u-place-properties .e-card')).toHaveCount(2);
    await page.goto(base + '/developers/aldar');
    await expect(page.locator('.e-empty')).toContainText('No published properties here yet');
    counts.flows++;
  });
  await check('focus ring', async () => {
    await page.goto(base + '/');
    await page.locator('[data-purpose="Buy"]').focus();
    await page.keyboard.press('ArrowRight');
    const style = await page.evaluate(() => {
      const { outlineStyle, outlineWidth } = getComputedStyle(document.activeElement);
      return outlineStyle + ' ' + outlineWidth;
    });
    expect(style).toBe('solid 3px');
    counts.flows++;
  });
  for (const [width, path, other] of [
    [390, '/', '#property-search [type="submit"]'],
    [390, '/properties/1', '.p-mobile-contact'],
    [1280, '/companies', '#page-title'],
  ])
    await check(`preview pill ${width}px ${path}`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(base + path);
      await expect(page.locator('#app h1').first()).toBeVisible();
      expect(await overlaps(page, '.preview-control', other)).toBe(false);
      counts.flows++;
    });
  const companies = ['harbour', 'harbour-modern', 'harbour-editorial', 'harbour-nocturne'];
  companies.push('cedar', 'dune');
  for (const host of companies.filter((name) => name !== 'cedar'))
    await check(`company ${host} rejects a foreign listing`, async () => {
      expect((await page.goto(hostBase(host) + '/properties/3')).status()).toBe(404);
    });
  for (const host of companies)
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/properties', '/about', '/agents', '/contact'])
        await check(`company ${host} ${width}px ${path}`, async () => {
          expect((await page.goto(hostBase(host) + path)).status()).toBe(200);
          await expect(page.locator('main h1').first()).toBeVisible();
          expect(await fits(page), 'no horizontal overflow').toBe(true);
          counts.company++;
        });
    }
  await check('JavaScript-disabled SSR', async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await context.newPage();
    expect((await staticPage.goto(base + '/properties')).status()).toBe(200);
    await expect(staticPage.locator('main h1')).toBeVisible();
    await context.close();
  });
  await check('unknown host', async () => {
    const unknown = await page.request.get(base + '/', { headers: { host: 'unknown.localhost' } });
    expect(unknown.status()).toBe(404);
  });
  if (errors.length) failures.push(...errors.map((error) => `browser error: ${error}`));
  const report = { channel: channel || 'bundled', ...counts, failures };
  await writeFile(new URL('browser-report.json', root), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
