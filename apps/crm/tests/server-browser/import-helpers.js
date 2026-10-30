import { expect } from '@playwright/test';
import { blank } from '../../src/lib/schema.js';
import { connectedCollections } from '../../src/features/server/records.js';

export const organisation = 'super-admin-workspace';
export const storageKey = 'kws-crm-v1';
export const counts = (values = {}) =>
  Object.fromEntries(connectedCollections.map((name) => [name, values[name] || 0]));

export function migrationData(prefix) {
  return {
    ...blank(),
    Clients: [{ client_id: `${prefix}-CL`, full_name: `${prefix} Client`, custom_code: 42 }],
    Contacts: [{ contact_id: `${prefix}-CT`, full_name: `${prefix} Landlord` }],
    Properties: [
      {
        property_id: `${prefix}-PR`,
        listing_title: `${prefix} Villa`,
        property_type: 'Villa',
        contact_id: `${prefix}-CT`,
      },
    ],
    'Follow-ups': [{ activity_id: `${prefix}-FU`, client_id: `${prefix}-CL` }],
    Deals: [{ deal_id: `${prefix}-DL`, notes: 'Keep for later migration' }],
  };
}

export async function savedSource(page, data, key = storageKey) {
  const raw = JSON.stringify({ data, activity: [], demo: false });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  return raw;
}

export async function openImport(page, key = storageKey) {
  await page.getByRole('button', { name: 'Import saved records', exact: true }).click();
  await page.getByLabel('Saved browser workspace', { exact: true }).selectOption(key);
  await expect(page.getByRole('button', { name: 'Download source backup' })).toBeVisible();
}

export async function reviewImport(page) {
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url().endsWith('/imports/preview')),
    page.getByRole('button', { name: 'Preview import', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
  return response.json();
}

export async function committed(page) {
  await page.getByRole('button', { name: 'Import records', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Import saved records', exact: true }),
  ).toBeVisible();
}

export async function serverRecords(page, workspace = organisation) {
  const response = await page.request.get(`/api/crm/workspaces/${workspace}/records`);
  expect(response.status()).toBe(200);
  return (await response.json()).records;
}
