import { expect, test } from '@playwright/test';
import { DEMO_SESSION_KEY } from '../../src/config/demoAccounts.js';
import { signIn } from './helpers/session.js';
import { saveRecordForm } from './helpers/record-form.js';

test('a failed sign-out does not claim success and can be retried', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.removeItem;
    window.blockDemoSignOut = true;
    Storage.prototype.removeItem = function (name) {
      if (name === key && window.blockDemoSignOut)
        throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, name);
    };
  }, DEMO_SESSION_KEY);
  await page.getByRole('button', { name: 'Account for Aidah' }).click();
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign out could not be completed' }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).not.toBe(null);
  await page.evaluate(() => {
    window.blockDemoSignOut = false;
  });
  await page.getByRole('button', { name: 'Try signing out again' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).toBe(null);
});

test('navigation to sign-out respects the record editor unsaved-changes guard', async ({
  page,
}) => {
  await page.goto('/');
  await signIn(page);
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#full_name').fill('Unsaved admin draft');
  // Trigger the same router link while the native modal keeps the header inert.
  await page.evaluate(() => document.querySelector('.user-button').click());
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() => document.querySelector('.account-sign-out').click());
  await expect(page.getByRole('dialog', { name: 'New client' })).toBeVisible();
  await expect(page.locator('#full_name')).toHaveValue('Unsaved admin draft');
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).not.toBe(null);
  await expect(page.locator('.account-panel')).toHaveCount(0);
  await page.evaluate(() => document.querySelector('.user-button').click());
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate(() => document.querySelector('.account-sign-out').click());
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.locator('.app-shell')).toHaveCount(0);
});

test('sign-out warns about unsaved storage changes and retry preserves them', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreRecordWrites = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'kws-crm-v1:workspace:aidah')
        throw new DOMException('Simulated quota error', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#client_id').fill('CL-MEMORY-ADMIN');
  await page.locator('#full_name').fill('Admin in-memory client');
  page.once('dialog', (dialog) => dialog.accept());
  await saveRecordForm(page);
  await expect(page.locator('.storage-banner')).toContainText('Changes could not be saved');
  await page
    .getByRole('textbox', { name: 'Search Clients', exact: true })
    .fill('Admin in-memory client');
  await page.getByRole('button', { name: 'Account for Aidah' }).click();
  let warning = '';
  page.once('dialog', async (dialog) => {
    warning = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect.poll(() => warning).toContain('Export a full backup');
  await expect(page.getByText('Admin in-memory client', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    before,
  );
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).not.toBe(null);
  await page.evaluate(() => window.restoreRecordWrites());
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.locator('.storage-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Account for Aidah' }).click();
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
  const records = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients,
  );
  expect(records.some((record) => record.client_id === 'CL-MEMORY-ADMIN')).toBe(true);
});
