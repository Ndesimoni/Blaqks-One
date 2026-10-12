import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import {
  migrationData,
  savedSource,
  openImport,
  reviewImport,
  committed,
  serverRecords,
} from './import-helpers.js';

test('a lost commit response retries the same completed import without duplication', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await savedSource(page, migrationData('RETRY'));
  await openImport(page);
  await page.getByLabel('Add demo photos where a property has no uploaded photos').uncheck();
  const preview = await reviewImport(page);
  let intercepted;
  await page.route('**/imports/commit', async (route) => {
    intercepted = route.request().postDataJSON().token;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Import records', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(intercepted).toBe(preview.token);
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
  await page.unroute('**/imports/commit');
  const responsePromise = page.waitForResponse((reply) => reply.url().endsWith('/imports/commit'));
  await committed(page);
  expect((await (await responsePromise).json()).replayed).toBe(true);
  expect(
    (await serverRecords(page)).Clients.filter(({ record }) => record.client_id === 'RETRY-CL'),
  ).toHaveLength(1);
});

test('mobile import remains usable in both themes and changing options requires a fresh preview', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'owner');
  await savedSource(page, migrationData('MOBILE'));
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await openImport(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Preview import' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await reviewImport(page);
    await page.screenshot({ path: testInfo.outputPath(`mobile-import-${theme}.png`) });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByLabel('Add demo photos where a property has no uploaded photos').uncheck();
    await expect(page.getByRole('button', { name: 'Import records', exact: true })).toHaveCount(0);
    page.once('dialog', (prompt) => prompt.accept());
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Import saved records', exact: true }),
    ).toBeFocused();
  }
});
