import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { codeFor, resetSignup } from '../api/signup-helpers.mjs';

const password = 'Synth3tic!Signup';
const address = (kind) => `${kind}-${randomUUID()}@example.test`;

async function openSignup(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create a company account' }).click();
  await expect(page).toHaveURL(/#\/sign-up$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
}

async function enterDetails(page, email, name) {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mobile', { exact: true }).fill('+971 50 123 4567');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
}

async function verify(page) {
  const started = page.waitForResponse(
    (response) => response.url().endsWith('/api/crm/signup/start') && response.status() === 202,
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  const body = await (await started).json();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page).toHaveURL(/#\/sign-up\/verify$/);
  await expect(page.getByRole('note')).toContainText('no email was sent');
  // Six digits verify at once, without pressing Verify and continue.
  await page.getByLabel('Code', { exact: true }).fill(codeFor(body.requestId));
}

async function expectSession(page, email) {
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
  await expect(page).toHaveURL(/#\/sign-up\/company$/);
  await page.getByLabel('Company name').fill('Synthetic Horizon Realty');
  await page.getByLabel('Emirate').selectOption('dubai');
  await page.getByRole('button', { name: 'Create my workspace' }).click();
  // The last step offers the team: Invite colleagues opens Team & access's invitation form.
  await expect(page.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await expect(page).toHaveURL(/#\/sign-up\/team$/);
  await expect(page.getByText('Step 4 of 4 · Your team')).toBeVisible();
  await page.getByRole('button', { name: 'Invite colleagues' }).click();
  await expect(page).toHaveURL(/#\/team-access$/);
  await expect(page.getByRole('dialog', { name: 'Invite teammate' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectSession(page, email);
  expect(
    query(
      `SELECT account_type||':'||display_name||':'||emirate||':'||member_limit ` +
        `FROM crm_company_profiles ` +
        `WHERE workspace_id=(SELECT id FROM crm_workspaces WHERE owner_id=` +
        `(SELECT id FROM crm_users WHERE email='${email}'))`,
    ),
  ).toBe('brokerage:Synthetic Horizon Realty:dubai:3');
  await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 3 seats used', { exact: true })).toBeVisible();
});
