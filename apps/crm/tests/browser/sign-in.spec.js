import { expect, test } from '@playwright/test';
import { DEMO_PASSWORD, demoAdmins } from '../../src/config/demoAccounts.js';
import { signIn } from './helpers/session.js';

test('signed-out deep links show sign-in before loading workspace records or calendar', async ({
  page,
}, testInfo) => {
  const calendarRequests = [];
  const errors = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/calendar/')) calendarRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/properties');
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.app-shell')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kws-crm-v1:workspace:aidah'))).toBe(null);
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).toBe(null);
  expect(calendarRequests).toHaveLength(0);
  expect(errors).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('sign-in-desktop-dark.png'), fullPage: true });
});

test('email/password validation, password visibility and rejected credentials stay on sign-in', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter your password.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await page.getByLabel('Email address').fill('not an email');
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await page.getByLabel('Email address').fill(demoAdmins[0].email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await expect(page).toHaveURL(/#\/sign-in$/);
  expect(await page.evaluate(() => sessionStorage.getItem('kws-crm-demo-session'))).toBe(null);
  await page.getByLabel('Email address').fill('unknown@example.com');
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
});

test('sign-in fits mobile in both themes and the selected theme reaches the dashboard', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const theme of ['dark', 'light']) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`sign-in-mobile-${theme}.png`),
      fullPage: true,
    });
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to light mode' }).click();
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await signIn(page, demoAdmins[1]);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Account for Simoni' }).click();
  await expect(page.getByRole('link', { name: 'Sign out' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
