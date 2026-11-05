import { randomUUID } from 'node:crypto';
import { codeFor, resetSignup } from '../api/signup-helpers.mjs';
import { WEBSITE, test, expect } from './fixtures.js';

const signInHeading = (page) => page.getByRole('heading', { name: 'Sign in', exact: true });

// Owner, 2026-11-05: signing out goes to the website home, and Back works on every account
// page: it never bounces back to sign-in or shows the signed-in pages again.
test('sign-out goes home and Back from sign-in passes over signed-in pages', async ({ page }) => {
  await page.goto(WEBSITE);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(signInHeading(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Back to the website' })).toHaveAttribute(
    'href',
    WEBSITE,
  );
  await page.goBack();
  await expect(page).toHaveURL(WEBSITE);
  await page.goForward();
  await page.getByLabel('Email', { exact: true }).fill('admin-a@crm-fixture.test');
  await page.getByLabel('Password', { exact: true }).fill(process.env.CRM_FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Good / })).toBeVisible();
  await page.getByRole('button', { name: 'Open CRM' }).click();
  await expect(page).not.toHaveURL(/start/);
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(WEBSITE);
  // Back shows the sign-in page, never the records; Back again leaves the CRM.
  await page.goBack();
  await expect(signInHeading(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('banner')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(WEBSITE);
});

test('Back works on every sign-up step', async ({ page }) => {
  resetSignup();
  const email = `back-${randomUUID()}@example.test`;
  await page.goto('/#/sign-in');
  await page.getByRole('link', { name: 'Create a company account' }).click();
  await page.getByLabel('Full name').fill('Synthetic Back Owner');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mobile', { exact: true }).fill('+971 50 123 4567');
  await page.getByLabel('Password', { exact: true }).fill('Synth3tic!Signup');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/#\/sign-up\/verify$/);
  await page.goBack();
  await expect(page.getByLabel('Full name')).toHaveValue('Synthetic Back Owner');
  const started = page.waitForResponse((reply) => reply.url().endsWith('/signup/start'));
  await page.getByRole('button', { name: 'Continue' }).click();
  const { requestId } = await (await started).json();
  await page.getByLabel('Code', { exact: true }).fill(codeFor(requestId));
  await expect(page).toHaveURL(/#\/sign-up\/company$/);
  // The code is used up, so Back from the company opens the new workspace.
  await page.goBack();
  await expect(page).toHaveURL(/#\/start$/);
  await expect(page.getByRole('heading', { level: 1, name: /^Good / })).toBeVisible();
});
