import { expect } from '@playwright/test';

export async function expectRecordOverlay(page, { fullScreen = false } = {}) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveClass(/modal-centered/);
  const panel = dialog.locator('.drawer');
  const viewport = page.viewportSize();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
  if (fullScreen) {
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(box.height).toBe(viewport.height);
  } else {
    expect(box.x).toBeGreaterThanOrEqual(24);
    expect(box.y).toBeGreaterThanOrEqual(24);
    expect(viewport.width - box.x - box.width).toBeGreaterThanOrEqual(24);
    expect(viewport.height - box.y - box.height).toBeGreaterThanOrEqual(24);
  }
  await expect(dialog.locator('.drawer-top')).toBeInViewport();
  await expect(dialog.locator('.drawer-footer')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
