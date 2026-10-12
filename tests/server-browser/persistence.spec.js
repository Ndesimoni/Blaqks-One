import { test, expect } from './fixtures.js';
import { addClient, session, signIn } from './helpers.js';
import { selectWorkspace } from './workspace-helpers.js';

test('a client survives reload and another browser but remains private to its admin', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await addClient(page, 'BROWSER-PERSIST', 'Persisted Client');
  await page.reload();
  await page.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(page.getByRole('button', { name: 'Open record BROWSER-PERSIST' })).toBeVisible();
  const identity = await session(page);
  const context = await browser.newContext();
  const other = await context.newPage();
  await signIn(other);
  await other.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(other.getByRole('button', { name: 'Open record BROWSER-PERSIST' })).toBeVisible();
  await other.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(other.getByLabel('Email address')).toBeVisible();
  await signIn(other, 'admin-b');
  await other.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(other.getByRole('button', { name: 'Open record BROWSER-PERSIST' })).toHaveCount(0);
  await other.goto(`/#/clients?workspace=${identity.user.id}`);
  await expect(
    other.getByRole('heading', { name: 'Workspace access is restricted' }),
  ).toBeVisible();
  const forged = await other.request.get(`/api/crm/workspaces/${identity.user.id}/records`);
  expect(forged.status()).toBe(403);
  await context.close();
});

test('Super Admin switches to a member workspace and saves there', async ({ page }) => {
  await signIn(page, 'owner');
  await selectWorkspace(page, 'Fixture Admin B');
  await expect(page.getByRole('region', { name: 'Active workspace' })).toContainText(
    'Fixture Admin B',
  );
  await addClient(page, 'BROWSER-SUPER', 'Created by Super Admin');
  const workspace = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('workspace');
  const response = await page.request.get(`/api/crm/workspaces/${workspace}/records`);
  expect(
    (await response.json()).records.Clients.some(
      (entry) => entry.record.client_id === 'BROWSER-SUPER',
    ),
  ).toBe(true);
  await selectWorkspace(page, 'Super Admin workspace');
  await expect(page.getByRole('button', { name: 'Open record BROWSER-SUPER' })).toHaveCount(0);
});

test('server unavailability never falls back to browser demo identity or records', async ({
  page,
}) => {
  await page.route('**/api/crm/auth/session', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Unable to open the CRM' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByText('Demo password', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add client', exact: true })).toHaveCount(0);
});
