import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_SESSION_KEY, demoAdmins } from '../../src/config/demoAccounts.js';
import { signIn } from './helpers/session.js';
import { saveRecordForm } from './helpers/record-form.js';

test('Aidah and Simoni enter separate workspaces, reload routes and sign out without clearing records', async ({
  page,
}) => {
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.side-footer strong')).toHaveText('Aidah');
  await expect(page.locator('.sidebar .nav-item')).toHaveCount(19);
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.locator('#client_id').fill('CL-ADMIN-SHARED');
  await page.locator('#full_name').fill('Shared admin test client');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.page-heading h1')).toHaveText('Clients & requirements');
  await expect(page.getByText('Shared admin test client', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account for Aidah' }).click();
  await expect(page.getByRole('link', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Account for Aidah' })).toBeFocused();
  await page.getByRole('button', { name: 'Account for Aidah' }).click();
  const before = await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'));
  const storedSession = await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'));
  expect(JSON.parse(storedSession)).toEqual({ version: 1, adminId: 'aidah' });
  expect(storedSession).not.toContain(DEMO_PASSWORD);
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).toBe(null);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(
    before,
  );
  await page.goBack();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await signIn(page, demoAdmins[1]);
  await expect(page.getByRole('button', { name: 'Account for Simoni' })).toBeVisible();
  await expect(page.locator('.side-footer strong')).toHaveText('Simoni');
  await expect(page.locator('.sidebar .nav-item')).toHaveCount(19);
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await expect(page.getByText('Shared admin test client', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Current workspace', exact: true })).toContainText(
    'Simoni',
  );
  await page.getByRole('button', { name: 'Account for Simoni' }).click();
  await expect(page.getByRole('region', { name: 'Admin account' })).toContainText(
    'Admin · Full access',
  );
});

test('invalid sessions require sign-in and blocked session writes report a recoverable error', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      sessionStorage.setItem(key, '{"version":1,"adminId":"unknown","role":"Admin"}');
    },
    { key: DEMO_SESSION_KEY },
  );
  await page.goto('/#/leads');
  await expect(page).toHaveURL(/#\/sign-in$/);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, name, value);
    };
  }, DEMO_SESSION_KEY);
  await page.getByLabel('Email address').fill(demoAdmins[0].email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your browser could not save the session');
  await expect(page.locator('.app-shell')).toHaveCount(0);
});
