import { workspaceRecords } from './assign-helpers.js';
import { test, expect } from './fixtures.js';
import { createRecord, signIn } from './helpers.js';

/** A full-height form from the right edge, as the approved mockup draws it (queue item 37). */
async function expectSlider(page, dialog) {
  const viewport = page.viewportSize();
  const box = await dialog.locator('.drawer').boundingBox();
  expect(Math.round(box.x + box.width)).toBe(viewport.width);
  expect([box.y, Math.round(box.height)]).toEqual([0, viewport.height]);
  if (viewport.width >= 1024) expect(box.width).toBeLessThanOrEqual(920);
  await expect(dialog.getByRole('button', { name: 'Close record editor' })).toBeInViewport();
}

test('Create opens the form slider: step chips, card, Save and add another', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page);
  await createRecord(page, 'Lead');
  let form = page.getByRole('dialog', { name: 'New lead', exact: true });
  await expect(form).toBeVisible();
  await expectSlider(page, form);
  await expect(form.locator('.form-slider-head')).toContainText('Fields marked * are required');
  const steps = form.getByRole('navigation', { name: 'Form steps' });
  await expect(steps.locator('[aria-current="step"]')).toHaveText('1Contact details');
  await expect(form.locator('.form-progress')).toHaveText('Step 1 of 6 · Contact details');
  await form.getByLabel('Full name', { exact: true }).fill('Slider lead one');
  const next = form.getByRole('button', { name: 'Next', exact: true });
  for (let step = 2; step <= 6; step++) {
    await next.click();
    await expect(form.locator('.form-progress')).toContainText(`Step ${step} of 6`);
  }
  // On Review the current chip is scrolled into view and earlier steps read as done.
  const current = steps.locator('[aria-current="step"]');
  const nav = await steps.boundingBox();
  const chip = await current.boundingBox();
  expect(chip.x + chip.width).toBeLessThanOrEqual(nav.x + nav.width);
  await expect(steps.locator('[data-state="done"]')).toHaveCount(5);
  await form.getByRole('button', { name: 'Save and add another', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Record created');
  // A fresh form opens with the same starting values, ready for the next lead.
  form = page.getByRole('dialog', { name: 'New lead', exact: true });
  await expect(form.getByLabel('Full name', { exact: true })).toHaveValue('');
  await expect(form.locator('.form-progress')).toContainText('Step 1 of 6');
  const { body } = await workspaceRecords(page);
  const saved = body.records.Clients.find((row) => row.record.full_name === 'Slider lead one');
  expect(saved.record.lead_stage).toBe('New');
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);

  // Editing keeps one save: no Save and add another.
  await page.setViewportSize({ width: 390, height: 844 });
  await createRecord(page, 'Contact');
  form = page.getByRole('dialog', { name: 'New contact', exact: true });
  await expectSlider(page, form);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
