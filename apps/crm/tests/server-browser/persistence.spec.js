import { test, expect } from './fixtures.js';
import { addClient, session, signIn, signOut } from './helpers.js';
import { openName } from './record-open.js';

test('a client survives reload and another browser but remains private to its admin', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await addClient(page, 'BROWSER-PERSIST', 'Persisted Client');
  await page.reload();
  await page.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(page.getByRole('button', { name: openName('BROWSER-PERSIST') })).toBeVisible();
  const identity = await session(page);
  const context = await browser.newContext();
  const other = await context.newPage();
  await signIn(other);
  await other.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(other.getByRole('button', { name: openName('BROWSER-PERSIST') })).toBeVisible();
  await signOut(other);
  await expect(other.getByLabel('Email', { exact: true })).toBeVisible();
  await signIn(other, 'admin-b');
  await other.getByLabel('Search Clients', { exact: true }).fill('BROWSER-PERSIST');
  await expect(other.getByRole('button', { name: openName('BROWSER-PERSIST') })).toHaveCount(0);
  // Another company's address is ignored: admin-b stays in their own company (BO1a).
  await other.goto(`/#/clients?workspace=${identity.user.id}`);
  await expect(
    other.getByRole('heading', { level: 1, name: 'Clients', exact: true }),
  ).toBeVisible();
  await expect(other.getByRole('button', { name: openName('BROWSER-PERSIST') })).toHaveCount(0);
  const forged = await other.request.get(`/api/crm/workspaces/${identity.user.id}/records`);
  expect(forged.status()).toBe(403);
  await context.close();
});

test('Blaqks One never switches into a company, even through the address (BO1a)', async ({
  page,
}) => {
  await signIn(page, 'admin-b');
  const { user } = await session(page);
  await signOut(page);
  await signIn(page, 'owner');
  await page.goto(`/#/clients?workspace=${encodeURIComponent(user.workspaceId)}`);
  await expect(page.getByRole('heading', { name: /^You don't have access to / })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toHaveCount(0);
  const response = await page.request.get(`/api/crm/workspaces/${user.workspaceId}/records`);
  expect(response.status()).toBe(403);
});

test('server unavailability never falls back to browser demo identity or records', async ({
  page,
}) => {
  await page.route('**/api/crm/auth/session', (route) => route.abort());
  await page.goto('/');
  // A cold development bundle can take longer than the default wait to load (see leads-contacts).
  await expect(page.getByRole('heading', { name: 'Unable to open the CRM' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByText('Demo password', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }),
  ).toHaveCount(0);
});
