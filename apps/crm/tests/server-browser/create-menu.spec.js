import { saveRecordForm, workspaceRecords } from './assign-helpers.js';
import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { openPage } from './product-nav.js';

test('the top bar names the page and Create opens the chosen editor, then returns focus', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'owner');
  const header = page.getByRole('banner');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText('Clients & requirements');
  await expect(header.locator('.header-crumb')).toHaveText('CRM /');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('.section-sidebar-company')).not.toBeEmpty();

  const create = header.getByRole('button', { name: 'Create', exact: true });
  const panel = page.locator('#create-panel');
  await create.click();
  await expect(create).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toContainText('Create in CRM');
  await expect(panel.getByRole('button')).toHaveText([
    'Lead',
    'Client',
    'Contact',
    'Property',
    'Follow-up',
    'Viewing',
  ]);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(create).toBeFocused();

  await openPage(page, 'Dashboard');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText('Overview');
  await create.click();
  await panel.getByRole('button', { name: 'Contact', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByLabel('Contact ID', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(create).toBeFocused();

  // A lead from the top bar is saved as a client at stage New, as Add lead on Leads saves it.
  await create.click();
  await panel.getByRole('button', { name: 'Lead', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New client' })).toBeVisible();
  await editor.getByLabel('Full name').fill('Top bar lead');
  await saveRecordForm(page);
  await expect(editor).toHaveCount(0);
  const { body } = await workspaceRecords(page);
  const lead = body.records.Clients.find((row) => row.record.full_name === 'Top bar lead');
  expect(lead.record.lead_stage).toBe('New');

  // Settings has nothing to create; the page still names itself once.
  await page.goto('/#/my-profile');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText('My profile');
  await expect(header.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/contacts');
  await expect(header.locator('.header-crumb')).toBeHidden();
  await expect(create).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
