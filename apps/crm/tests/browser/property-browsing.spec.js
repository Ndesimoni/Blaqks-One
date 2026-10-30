import { expect, test } from './helpers/session.js';

test('property pages stay clean in both themes on desktop and mobile, and recover after the last page is emptied', async ({
  page,
}, testInfo) => {
  await page.goto('/#/properties');
  const cards = page.getByRole('list', { name: 'Property listings', exact: true });
  const pages = page.getByRole('navigation', { name: 'Property pages', exact: true });
  await expect(cards.getByRole('listitem')).toHaveCount(12);
  await expect(page.getByRole('button', { name: /^More property listings/ })).toHaveCount(0);
  await pages.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(cards.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Property results', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await expect(cards.getByRole('listitem')).toHaveCount(1);
  await pages.getByRole('button', { name: 'Previous', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
      await page.locator('.inventory-collection').scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(await cards.evaluate((node) => getComputedStyle(node).overflowY)).toBe('visible');
      await expect(page.locator('.modern-property-card')).toHaveCount(12);
      await page.screenshot({
        path: testInfo.outputPath(`properties-${width}-${theme}.png`),
        animations: 'disabled',
      });
    }
  }
  await pages.getByRole('button', { name: 'Next', exact: true }).click();
  await cards.getByRole('button').click();
  const dialog = page.getByRole('dialog');
  page.once('dialog', (confirmation) => confirmation.accept());
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cards.getByRole('listitem')).toHaveCount(12);
  await expect(pages).toContainText('Showing 1–12 of 12 properties');
  await expect(pages.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
});
