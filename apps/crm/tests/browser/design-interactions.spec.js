import { expect, test } from './helpers/session.js';
import { textContrast } from './helpers/contrast.js';

test('shared colours remain readable, hover keeps controls still, and reduced motion is honoured', async ({
  page,
}) => {
  await page.goto('/');
  for (const theme of ['dark', 'light']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    for (const selector of [
      '.page-heading p',
      '.metric-foot',
      '.chart-total strong',
      '.btn-primary',
      '.workspace-banner strong',
      '.workspace-banner p',
    ])
      expect(await textContrast(page.locator(selector).first()), selector).toBeGreaterThanOrEqual(
        4.5,
      );
    const add = page.getByRole('button', { name: 'Add new lead', exact: true });
    await page.mouse.move(0, 0);
    const resting = await add.evaluate((node) => getComputedStyle(node).backgroundColor);
    const before = await add.boundingBox();
    await add.hover();
    await expect(add).not.toHaveCSS('background-color', resting);
    expect(await add.boundingBox()).toEqual(before);
    expect(before.height).toBeGreaterThanOrEqual(44);
    await add.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(add).toBeFocused();
    await expect(add).toHaveCSS('outline-style', 'solid');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  expect(
    await page
      .locator('.btn-primary')
      .evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration)),
  ).toBeLessThan(0.001);
  await page.getByRole('button', { name: 'Add new lead', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New client' });
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .locator('.drawer')
      .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration)),
  ).toBeLessThan(0.001);
});

test('mobile search and expandable property filters preserve input and remain keyboard accessible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/properties');
  const toggle = page.getByRole('button', { name: /^Filter properties/ });
  const maximum = page.getByRole('spinbutton', { name: 'Maximum price', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await maximum.fill('0');
  await expect(page.locator('.modern-property-card')).toHaveCount(0);
  await toggle.click();
  await expect(maximum).not.toBeVisible();
  await toggle.click();
  await expect(maximum).toHaveValue('0');
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await expect(page.locator('.modern-property-card')).toHaveCount(12);
  await toggle.click();
  const searchToggle = page.getByRole('button', { name: 'Search workspace', exact: true });
  await searchToggle.click();
  const search = page.getByRole('textbox', { name: 'Search CRM records', exact: true });
  await expect(search).toBeFocused();
  await search.press('Escape');
  await expect(searchToggle).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await search.fill('Olivia');
  await search.press('Enter');
  await expect(page.locator('.profile-head h2')).toHaveText('Olivia Carter');
  await expect(page.locator('.desk-client')).toHaveCount(1);
  await page.goto('/#/properties');
  await page.getByRole('button', { name: 'Add property', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New property' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('mobile-property-form.png'),
    animations: 'disabled',
  });
});

test('deep links scroll the active navigation item into view while settings stay reachable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/#/performance');
    if (width === 390)
      await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
    const active = page.locator('.nav-groups [aria-current="page"]');
    await expect(active).toHaveText('Performance');
    await expect
      .poll(async () => {
        const item = await active.boundingBox();
        const list = await page.locator('.nav-groups').boundingBox();
        return item.y >= list.y - 1 && item.y + item.height <= list.y + list.height + 1;
      })
      .toBe(true);
    await expect(page.getByRole('button', { name: 'My profile', exact: true })).toBeVisible();
    if (width === 390) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Toggle navigation', exact: true }),
      ).toBeFocused();
    }
  }
});
