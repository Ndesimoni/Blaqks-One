import { test, expect } from './fixtures.js';
import { addClient, externalUpdate, openClientEditor, saveRecordForm, signIn } from './helpers.js';

test('stale edits preserve the draft and reload only after an explicit choice', async ({
  page,
}) => {
  await signIn(page);
  await addClient(page, 'BROWSER-CONFLICT', 'Original client');
  await openClientEditor(page, 'BROWSER-CONFLICT');
  await page.getByLabel('Full name').fill('My unsaved draft');
  await externalUpdate(page, 'BROWSER-CONFLICT', 'Another browser update');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Your draft is still here');
  await page.getByRole('button', { name: 'Step 1: Contact details', exact: true }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('My unsaved draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reload latest record', exact: true }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Another browser update');
  await page.getByLabel('Full name').fill('Resolved client');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'BROWSER-CONFLICT' })).toContainText(
    'Resolved client',
  );
});

test('failed saves keep entered data and allow retry', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.getByLabel('Client ID').fill('BROWSER-RETRY');
  await page.getByLabel('Full name').fill('Retained draft');
  await page.route('**/api/crm/workspaces/*/records/Clients', (route) => route.abort());
  await saveRecordForm(page);
  await expect(page.getByRole('alert')).toContainText('could not be reached');
  await page.getByRole('button', { name: 'Step 1: Contact details', exact: true }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Retained draft');
  await page.unroute('**/api/crm/workspaces/*/records/Clients');
  await saveRecordForm(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open record BROWSER-RETRY' })).toBeVisible();
});

test('an authoritative expired session clears cached workspace data', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/crm/workspaces/*/records/Clients', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Sign in to continue.' }),
    }),
  );
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  await page.getByLabel('Client ID').fill('BROWSER-EXPIRED');
  await saveRecordForm(page);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
});
