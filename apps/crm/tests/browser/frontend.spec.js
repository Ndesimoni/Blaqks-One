import { expect, test } from './helpers/session.js';

test('section URLs survive reload, support browser history, and recover from unknown routes', async ({
  page,
}) => {
  await page.goto('/#/properties');
  await expect(page.locator('.page-heading h1')).toHaveText('Property portfolio');
  await page.reload();
  await expect(page.locator('.modern-property-card')).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Property pages', exact: true })).toContainText(
    'Page 1 of 2',
  );
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await expect(page).toHaveURL(/#\/clients$/);
  await page.goBack();
  await expect(page.locator('.page-heading h1')).toHaveText('Property portfolio');
  await page.goForward();
  await expect(page.locator('.page-heading h1')).toHaveText('Clients & requirements');
  await page.goto('/#/unknown');
  await expect(
    page.getByRole('heading', { name: 'Page not found', exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to overview' }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
});

test('keyboard drawers contain focus, restore the opener, validate fields and guard unsaved edits', async ({
  page,
}) => {
  await page.goto('/#/clients');
  const add = page.getByRole('button', { name: 'Add client', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New client' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#client_id')).toBeFocused();
  await page.locator('#client_id').fill('CL-001');
  await page.locator('#email').fill('invalid');
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('#client_id')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#client_id')).toBeFocused();
  await page.locator('#client_id').fill('CL-KEYBOARD');
  await page.locator('#email').fill('valid@example.com');
  await dialog.getByRole('button', { name: 'Next', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true);
  page.once('dialog', (event) => event.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  page.once('dialog', (event) => event.accept());
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients.some(
          (row) => row.client_id === 'CL-KEYBOARD',
        ),
      ),
    )
    .toBe(false);
});

test('global search opens the matching client profile and retains its query on reload', async ({
  page,
}) => {
  await page.goto('/#/properties');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('kws-crm-v1:workspace:aidah'))))
    .toBe(true);
  const names = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients.map(
      (row) => row.full_name,
    ),
  );
  const name = names[1];
  await page.getByRole('textbox', { name: 'Search CRM records' }).fill(name);
  await page.keyboard.press('Enter');
  await expect(page.locator('.profile-head h2')).toHaveText(name);
  await expect(page.locator('.desk-client')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.profile-head h2')).toHaveText(name);
  await page
    .getByRole('textbox', { name: 'Search clients in client desk' })
    .fill('No matching profile');
  await expect(page.locator('.profile-head')).toHaveCount(0);
});

test('mobile navigation and record dialogs remain keyboard accessible without page overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/properties');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'CRM navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Add property' }).click();
  await expect(page.getByRole('dialog', { name: 'New property' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New property' })).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('mobile-editor.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: testInfo.outputPath('mobile-properties-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
});
