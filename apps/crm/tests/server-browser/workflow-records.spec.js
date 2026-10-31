import { test, expect } from './fixtures.js';
import { addClient, saveRecordForm, session, signIn } from './helpers.js';

test('a connected viewing links to a client, survives reload and protects that client', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await addClient(page, 'BROWSER-WF-CLIENT', 'Workflow Client');
  const sidebar = page.getByRole('navigation', { name: 'CRM sections', exact: true });
  await sidebar.getByRole('button', { name: 'Viewings', exact: true }).click();
  await page.getByRole('button', { name: 'Add viewing', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Viewing ID').fill('BROWSER-WF-VIEW');
  await dialog.getByLabel('Client ID', { exact: true }).selectOption('BROWSER-WF-CLIENT');
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open record BROWSER-WF-VIEW' })).toBeVisible();
  const identity = await session(page);
  const response = await page.request.get(`/api/crm/workspaces/${identity.user.id}/records`);
  const viewing = (await response.json()).records.Viewings.find(
    (entry) => entry.record.viewing_id === 'BROWSER-WF-VIEW',
  );
  expect(viewing.record.client_id).toBe('BROWSER-WF-CLIENT');

  await sidebar.getByRole('button', { name: 'Clients', exact: true }).click();
  await page.getByLabel('Search Clients', { exact: true }).fill('BROWSER-WF-CLIENT');
  await page.getByRole('button', { name: 'Open record BROWSER-WF-CLIENT', exact: true }).click();
  page.once('dialog', (prompt) => prompt.accept());
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Delete/ })
    .click();
  await expect(page.locator('.toast')).toContainText('A linked record prevents this change.');
  await page.reload();
  await page.getByLabel('Search Clients', { exact: true }).fill('BROWSER-WF-CLIENT');
  await expect(page.getByRole('button', { name: 'Open record BROWSER-WF-CLIENT' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a lead added from Leads is saved as a connected client with lead defaults', async ({
  page,
}) => {
  await signIn(page);
  const sidebar = page.getByRole('navigation', { name: 'CRM sections', exact: true });
  await sidebar.getByRole('button', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  await page.getByLabel('Client ID').fill('BROWSER-WF-LEAD');
  await page.getByLabel('Full name').fill('Workflow Lead');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const identity = await session(page);
  const response = await page.request.get(`/api/crm/workspaces/${identity.user.id}/records`);
  const lead = (await response.json()).records.Clients.find(
    (entry) => entry.record.client_id === 'BROWSER-WF-LEAD',
  );
  expect(lead.record.lead_stage).toBe('New');
  expect(lead.record.date_added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
