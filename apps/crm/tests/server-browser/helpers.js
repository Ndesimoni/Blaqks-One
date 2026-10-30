import { expect } from '@playwright/test';
import { saveRecordForm } from '../browser/helpers/record-form.js';

export { saveRecordForm };

export async function signIn(page, account = 'admin-a') {
  await page.goto('/');
  await page.getByLabel('Email address').fill(`${account}@crm-fixture.test`);
  await page.getByLabel('Password', { exact: true }).fill(process.env.CRM_FIXTURE_PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url().endsWith('/api/crm/auth/login')),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add client', exact: true })).toBeVisible();
}

export async function addClient(page, id, name) {
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.getByLabel('Client ID').fill(id);
  await page.getByLabel('Full name').fill(name);
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export async function openClientEditor(page, id) {
  await page.getByRole('button', { name: `Open record ${id}`, exact: true }).click();
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
