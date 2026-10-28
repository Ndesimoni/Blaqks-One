import { chromium, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { checkContrasts } from './check-design-rules.mjs';

export async function checkPropertyLocation(page, base, root) {
  const requests = [];
  const provider = '**/www.openstreetmap.org/**';
  await page.route(provider, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<title>Mock map provider</title>' });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${base}?map-lazy#/property?id=1`);
  await expect(page.locator('.detail-title')).toBeVisible();
  await expect(page.locator('[data-area-map] iframe')).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.locator('[data-anchor="location"]').click();
  await expect(page.locator('[data-area-map] iframe')).toHaveCount(1);
  await expect.poll(() => requests.length).toBe(1);
  expect(new URL(requests[0]).searchParams.has('marker')).toBe(false);
  await expect(page.locator('[data-map-status]')).toContainText('If the map does not appear');
  await expect(page.locator('[data-area-map] iframe')).toHaveAttribute(
    'referrerpolicy',
    'no-referrer',
  );
  await expect(page.locator('[data-community-map]')).toHaveAttribute('rel', 'noopener noreferrer');
  await page.locator('[data-map-load]').click();
  await expect.poll(() => requests.length).toBe(2);
  let reflowChecks = 0;
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ['general', '1', '2', '3', '4']) {
      const scope = theme === 'general' ? '' : `&site=harbour&theme=${theme}`;
      await page.goto(`${base}?map-review=${reflowChecks}#/property?id=1${scope}`);
      const section = page.getByRole('region', { name: 'Location & neighbourhood' });
      await section.scrollIntoViewIfNeeded();
      await expect(section).toContainText('Dubai Marina');
      await expect(section).toContainText('Exact address available from the listing agent.');
      if (width === 1280)
        await checkContrasts(page, [
          '.location-privacy',
          '[data-map-status]',
          '.location-actions .button',
        ]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      const enquiry = section.getByRole('link', { name: /Ask agent for exact location/ });
      expect((await enquiry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      if (theme !== 'general')
        await expect(enquiry).toHaveAttribute(
          'href',
          new RegExp(`site=harbour.*theme=${theme}.*listing=1`),
        );
      reflowChecks++;
    }
  }
  await page
    .locator('#location')
    .getByRole('link', { name: /Ask agent for exact location/ })
    .click();
  await expect(page).toHaveURL(/listing=1/);
  await expect(page.locator('form[data-form="enquiry"]')).toBeVisible();
  await page.goto(`${base}#/property?id=3`);
  await expect(page.locator('.location-community')).toContainText('Saadiyat Island');
  await expect(page.locator('.location-community')).toContainText('Abu Dhabi');
  await page.goto(`${base}#/property?id=3&site=harbour`);
  await expect(page.locator('[data-area-map]')).toHaveCount(0);
  await page.unroute(provider);
  await page.route(provider, (route) => route.abort('internetdisconnected'));
  await page.goto(`${base}?map-offline#/property?id=1&site=harbour&theme=4`);
  await page.locator('#location').scrollIntoViewIfNeeded();
  await page.locator('[data-area-map] iframe').dispatchEvent('error');
  await expect(page.locator('[data-map-status]')).toContainText('could not load');
  await expect(page.locator('[data-map-load]')).toHaveText('Retry map');
  await expect(page.locator('[data-community-map]')).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .locator('#location')
      .screenshot({ path: `${root}screenshots/location-fallback-${width}.png` });
  }
  await page.unroute(provider);
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
  });
  await page.route(provider, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Mock map provider</title>' }),
  );
  await page.goto(`${base}dist/maps-preview.html`);
  await expect(page.locator('[data-area-map] iframe')).toHaveCount(0);
  await page.locator('[data-map-load]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-area-map] iframe')).toHaveCount(1);
  await expect(page.locator('[data-map-load]')).toBeFocused();
  await page.goto(`${base}#/home`);
  await expect(page.locator('[data-area-map]')).toHaveCount(0);
  await page.unroute(provider);
  return {
    reflowChecks,
    lazyLoad: 'passed',
    manualLoad: 'passed',
    offlineFallback: 'passed',
    enquiryScope: 'passed',
    liveProvider: 'not verified; environment CONNECT 403',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('.', import.meta.url));
  await mkdir(`${root}screenshots`, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    console.log(JSON.stringify(await checkPropertyLocation(page, 'http://127.0.0.1:4178/', root)));
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
}
