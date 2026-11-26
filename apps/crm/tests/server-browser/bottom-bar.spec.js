import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { noPageOverflow } from './assign-helpers.js';

test('phones get a bottom bar that opens products, their sections and can be hidden', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  const bar = page.getByRole('navigation', { name: 'Products bar', exact: true });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('button', { name: 'CRM', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await bar.getByRole('button', { name: 'Marketplace', exact: true }).click();
  await expect(page).toHaveURL(/#\/marketplace/);
  // The current product's button opens its sections.
  await bar.getByRole('button', { name: 'Marketplace', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'CRM navigation' });
  await expect(drawer.getByRole('navigation', { name: 'Marketplace sections' })).toBeVisible();
  await page.keyboard.press('Escape');
  await bar.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/#\/start$/);
  await noPageOverflow(page);

  await bar.getByRole('button', { name: 'Hide the bottom bar', exact: true }).click();
  await expect(bar).toHaveCount(0);
  const back = page.getByRole('button', { name: 'Show the bottom bar', exact: true });
  await expect(back).toBeVisible();
  await page.reload();
  await expect(back).toBeVisible();
  await back.click();
  await expect(bar).toBeVisible();

  // Wide screens use the rail instead.
  await page.setViewportSize({ width: 1280, height: 860 });
  await expect(bar).toBeHidden();
});
