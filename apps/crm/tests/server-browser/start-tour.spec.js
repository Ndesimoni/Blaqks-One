import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';

// The start page tour (owner, 2026-11-05): it opens once on arrival from sign-up
// (`?start=tour`), walks the sidebar with a ring around each part, and Take the tour runs it again.
test('the start page tour walks the sidebar and can be taken again', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/start?start=tour');
  const tour = page.getByRole('dialog', { name: 'Home' });
  await expect(tour).toContainText('Your start page');
  await expect(page).not.toHaveURL(/start=tour/);
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();
  await expect(page.locator('.tour-target')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'CRM' })).toContainText('Leads, clients');
  await expect(page.getByRole('dialog', { name: 'CRM' })).toContainText(/^CRM.*2 of \d+/s);
  await page.keyboard.press('Escape');
  await expect(page.locator('.start-tour')).toHaveCount(0);
  await expect(page.locator('.tour-target')).toHaveCount(0);
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Home' })).toBeVisible();
  const count = page.locator('.start-tour-row > span').first();
  const total = Number((await count.textContent()).split(' of ')[1]);
  for (let step = 2; step <= total; step += 1) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(count).toHaveText(`${step} of ${total}`);
  }
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.start-tour')).toHaveCount(0);
});
