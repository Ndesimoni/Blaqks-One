import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { codeFor, resetSignup } from '../api/signup-helpers.mjs';

const password = 'Synth3tic!Signup';
const address = (kind) => `${kind}-${randomUUID()}@example.test`;

async function openSignup(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/#\/sign-up$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
}

async function enterDetails(page, email, name) {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number').fill('+971 50 123 4567');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
}

async function verify(page) {
  const started = page.waitForResponse(
    (response) => response.url().endsWith('/api/crm/signup/start') && response.status() === 202,
  );
  await page.getByRole('button', { name: 'Send code' }).click();
  const body = await (await started).json();
  await expect(page.getByRole('heading', { name: 'Enter your verification code' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('no email was sent');
  await page.getByLabel('Verification code').fill(codeFor(body.requestId));
  await page.getByRole('button', { name: 'Verify and create account' }).click();
}

async function expectSession(page, email) {
  await expect(page).toHaveURL(/#\/dashboard$/);
  const response = await page.request.get('/api/crm/auth/session');
  expect(response.status()).toBe(200);
  expect((await response.json()).user.email).toBe(email);
}

test.beforeEach(() => resetSignup());

test('an account creates its company and opens the three-seat Team page', async ({ page }) => {
  const email = address('browser-company');
  await openSignup(page);
  await enterDetails(page, email, 'Synthetic Company Owner');
  await verify(page);
  await expect(page.getByRole('heading', { name: 'Set up your company' })).toBeVisible();
  await page.getByLabel('Company name').fill('Synthetic Horizon Realty');
  await page.getByLabel('Emirate').selectOption('dubai');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expectSession(page, email);
  expect(
    query(
      `SELECT account_type||':'||display_name||':'||emirate||':'||member_limit ` +
        `FROM crm_company_profiles ` +
        `WHERE workspace_id=(SELECT id FROM crm_workspaces WHERE owner_id=` +
        `(SELECT id FROM crm_users WHERE email='${email}'))`,
    ),
  ).toBe('brokerage:Synthetic Horizon Realty:dubai:3');
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 3 seats used', { exact: true })).toBeVisible();
});
