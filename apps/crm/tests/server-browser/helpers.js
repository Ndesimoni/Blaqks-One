import { expect } from '@playwright/test';
import { saveRecordForm } from '../browser/helpers/record-form.js';
import { WEBSITE, answerWebsite } from './fixtures.js';
import { openName } from './record-open.js';

export { saveRecordForm };

export async function signIn(page, account = 'admin-a') {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(`${account}@crm-fixture.test`);
  await page.getByLabel('Password', { exact: true }).fill(process.env.CRM_FIXTURE_PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url().endsWith('/api/crm/auth/login')),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  // Everyone lands on the start page (NAV1b); these tests then work in Clients.
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  // Blaqks One has no CRM (BO1a): its tests start from the start page.
  if (account === 'owner') return;
  await page.goto('/#/clients');
  await expect(page.getByRole('heading', { level: 1, name: 'Clients', exact: true })).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }),
  ).toBeVisible();
}

/**
 * Members land on the start page (NAV1b); the member tests always began on their first list,
 * so this continues there: Clients, else Properties, else the workspace.
 */
export async function landWhereTestsBegin(page) {
  await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible();
  const { user } = await session(page);
  const first = user.permissions?.relationships
    ? '/clients'
    : user.permissions?.properties
      ? '/properties'
      : '/workspace';
  await page.goto(`/#${first}`);
}

/**
 * Signs out through the account menu on the person's initials (NAV1b). Signing out leaves for
 * the website home; the scenario then continues on the CRM's sign-in page.
 */
export async function signOut(page) {
  await answerWebsite(page.context());
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(WEBSITE);
  await page.goto('/#/sign-in');
}

/** Opens a record's editor from the top bar's + Create; CRM lists have no Add buttons. */
export async function createRecord(page, item) {
  await page.getByRole('banner').getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('#create-panel').getByRole('button', { name: item, exact: true }).click();
}

export async function addClient(page, id, name) {
  await createRecord(page, 'Client');
  await page.getByLabel('Client ID').fill(id);
  await page.getByLabel('Full name').fill(name);
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function openClientEditor(page, id) {
  await page.getByRole('button', { name: openName(id) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit record' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
}

export async function session(page) {
  const response = await page.request.get('/api/crm/auth/session');
  expect(response.status()).toBe(200);
  return response.json();
}

export async function externalUpdate(page, legacyId, name) {
  const identity = await session(page);
  const path = `/api/crm/workspaces/${identity.user.id}/records`;
  const payload = await (await page.request.get(path)).json();
  const entry = payload.records.Clients.find((row) => row.record.client_id === legacyId);
  const response = await page.request.patch(`${path}/Clients/${entry.id}`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { version: entry.version, record: { ...entry.record, full_name: name } },
  });
  expect(response.status()).toBe(200);
}
