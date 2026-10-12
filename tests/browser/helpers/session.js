import { expect, test as base } from '@playwright/test';
import { demoAdmins, DEMO_PASSWORD } from '../../../src/config/demoAccounts.js';

export async function signIn(page, admin = demoAdmins[0]) {
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toHaveText('Overview');
}

// Existing CRM regressions enter through the real demo sign-in controls.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/#/sign-in');
    await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
    const before = await page.evaluate(() => ({
      records: localStorage.getItem('kws-crm-v1:workspace:aidah'),
      preferences: localStorage.getItem('kws-crm-preferences'),
    }));
    await signIn(page);
    await page.evaluate((saved) => {
      for (const [key, value] of [
        ['kws-crm-v1:workspace:aidah', saved.records],
        ['kws-crm-preferences', saved.preferences],
      ]) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    }, before);
    // Install each test's data/mocks before its first workspace mount.
    await page.goto('about:blank');
    await use(page);
  },
});

export { expect };
