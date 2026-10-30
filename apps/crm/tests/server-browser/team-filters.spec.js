import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { openTeam } from './team-helpers.js';

function filterControls(page) {
  const panel = page.getByRole('region', { name: 'Filter accounts' });
  return {
    panel,
    search: panel.getByLabel('Search team'),
    status: panel.getByLabel('Account status'),
    role: panel.getByLabel('Role'),
    sort: panel.getByLabel('Sort by'),
    clear: panel.getByRole('button', { name: 'Clear filters', exact: true }),
  };
}

test('account status dropdown reports scoped counts and Clear filters restores defaults', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'owner');
  await openTeam(page);
  const { search, status, role, sort, clear } = filterControls(page);
  await expect(status).toHaveValue('current');
  await expect(status).toHaveAttribute('aria-describedby', 'team-status-note');
  await expect(page.locator('#team-status-note')).toHaveText(
    'Counts reflect your search and role. All current excludes archived accounts.',
  );
  await expect(status.locator('option:checked')).toHaveText(/^All current \(\d+\)$/);
  await expect(clear).toBeDisabled();

  await status.selectOption('suspended');
  await expect(clear).toBeEnabled();
  await search.fill('Fixture Admin');
  await expect(status).toHaveValue('suspended');
  await expect(status.locator('option')).toHaveText([
    'All current (2)',
    'Active (2)',
    'Suspended (0)',
    'Pending invite (0)',
    'Cancelled invite (0)',
    'Archived (0)',
  ]);
  await expect(page.getByRole('heading', { name: 'No matching teammates' })).toBeVisible();
  await search.fill('Fixture Admin A');
  await expect(status.locator('option').first()).toHaveText('All current (1)');
  await expect(status).toHaveValue('suspended');
  await role.selectOption('staff');
  await expect(status.locator('option').first()).toHaveText('All current (0)');
  await status.selectOption('active');
  await role.selectOption('all');
  await sort.selectOption('desc');
  await expect(page.getByRole('heading', { name: 'Fixture Admin A', exact: true })).toBeVisible();

  await clear.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(status).toHaveValue('current');
  await expect(role).toHaveValue('all');
  await expect(sort).toHaveValue('asc');
  await expect(clear).toBeDisabled();
  await sort.selectOption('desc');
  await expect(clear).toBeEnabled();
  await clear.click();
  await expect(clear).toBeDisabled();

  await search.focus();
  for (const control of [status, role, sort]) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('Admins cannot choose archived accounts in the status dropdown', async ({ page }) => {
  await signIn(page, 'admin-a');
  await openTeam(page);
  const { status } = filterControls(page);
  await expect(status).toBeEnabled();
  await expect(status.locator('option')).toHaveText([
    /^All current \(\d+\)$/,
    /^Active \(\d+\)$/,
    /^Suspended \(\d+\)$/,
    /^Pending invite \(\d+\)$/,
    /^Cancelled invite \(\d+\)$/,
  ]);
  await expect(status.locator('option[value="archived"]')).toHaveCount(0);
});

test('filter panel stays compact without page overflow on narrow screens', async ({ page }) => {
  await signIn(page, 'owner');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      }
      await openTeam(page);
      const { panel, search, status, clear } = filterControls(page);
      await status.selectOption('cancelled');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width === 390) expect(box.height).toBeLessThanOrEqual(400);
      for (const control of [search, status, clear]) {
        const area = await control.boundingBox();
        expect(area.x).toBeGreaterThanOrEqual(box.x);
        expect(area.x + area.width).toBeLessThanOrEqual(box.x + box.width);
        expect(area.height).toBeGreaterThanOrEqual(24);
      }
      const searchBox = await search.boundingBox();
      const statusBox = await status.boundingBox();
      expect(statusBox.width).toBeGreaterThanOrEqual(190);
      if (width <= 1200) expect(statusBox.y).toBeGreaterThan(searchBox.y);
      else expect(Math.abs(statusBox.y - searchBox.y)).toBeLessThanOrEqual(2);
      await clear.click();
    }
  }
});
