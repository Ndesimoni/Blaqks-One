import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord, saveRecordForm, workspaceRecords } from './assign-helpers.js';

test('assigned-only staff see only their records in lists, totals, pickers and references', async ({
  browser,
}) => {
  const team = await assignTeam('visible');
  const { one, two } = team.people;
  const mine = await held(team, 'Clients', { full_name: 'Visible mine' }, one.id);
  await held(team, 'Clients', { full_name: 'Visible admin client' });
  await held(team, 'Clients', { full_name: 'Visible two client' }, two.id);
  const hidden = await held(team, 'Properties', { listing_title: 'Hidden tower' });
  await held(team, 'Properties', { listing_title: 'Other hidden tower' }, two.id);
  const viewing = await held(team, 'Viewings', {
    client_id: mine.record.client_id,
    property_id: hidden.record.property_id,
  });
  const staff = await memberPage(browser, one.email);
  const { page } = staff;
  try {
    await page.goto('/#/clients');
    await expect(page.getByRole('navigation', { name: 'Clients pages' })).toContainText(
      'Showing 1–1 of 1',
    );
    await expect(page.getByText('Visible mine', { exact: true })).toBeVisible();
    await expect(page.getByText(/Visible (admin|two) client/)).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Assignment' })).toHaveCount(0);
    await page.goto('/#/leads');
    await expect(page.locator('.large-count').first()).toHaveText('1');
    await expect(page.getByRole('button', { name: 'All sources 1' })).toBeVisible();
    await page.goto('/#/properties');
    await expect(page.getByText(/Hidden tower/)).toHaveCount(0);

    await page.goto('/#/viewings');
    const details = await openRecord(page, viewing.record.viewing_id);
    await details.getByRole('button', { name: 'Edit record', exact: true }).click();
    const form = page.getByRole('dialog');
    await expect(form.getByLabel('Property ID', { exact: true }).locator('option')).toHaveText([
      /^Select property id$/i,
      `${hidden.record.property_id} · Hidden tower (not assigned to you)`,
    ]);
    await expect(form.getByLabel('Client ID', { exact: true }).locator('option')).toHaveText([
      /^Select client id$/i,
      `${mine.record.client_id} · Visible mine`,
    ]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Add viewing', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByLabel('Client ID', { exact: true }).locator('option'),
    ).toHaveCount(2);
    await expect(
      page.getByRole('dialog').getByLabel('Property ID', { exact: true }).locator('option'),
    ).toHaveCount(1);
    const { body } = await workspaceRecords(page);
    expect(body.scope).toBe('assigned');
    expect(body.records.Clients.map((entry) => entry.record.full_name)).toEqual(['Visible mine']);
  } finally {
    await staff.context.close();
  }
});

test('staff get server-issued IDs and no Delete on parents; Admins may type IDs', async ({
  browser,
}) => {
  const team = await assignTeam('issued');
  const { admin, one } = team.people;
  const property = await held(team, 'Properties', { listing_title: 'Issued tower' }, one.id);
  const contact = await held(team, 'Contacts', { full_name: 'Issued landlord' }, one.id);
  const staff = await memberPage(browser, one.email);
  const owner = await memberPage(browser, admin.email);
  try {
    const { page } = staff;
    await page.goto('/#/clients');
    await page.getByRole('button', { name: 'Add client', exact: true }).click();
    const idField = page.getByRole('dialog').getByLabel('Client ID', { exact: true });
    await expect(idField).toHaveAttribute('readonly', '');
    await expect(page.getByRole('dialog').getByLabel('Full name')).toBeFocused();
    await expect(idField).toHaveAttribute('placeholder', 'Issued when saved');
    await expect(page.getByRole('dialog')).toContainText(
      'Issued when saved. Record IDs are assigned by the CRM server.',
    );
    await page.getByRole('dialog').getByLabel('Full name').fill('Issued client');
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const { body } = await workspaceRecords(page);
    const created = body.records.Clients.find((row) => row.record.full_name === 'Issued client');
    expect(created.record.client_id).toMatch(/^CL-\d{3,}$/);
    expect(created.assignee).toBe(one.id);
    const clientDetails = await openRecord(page, created.record.client_id);
    await expect(clientDetails.getByRole('button', { name: 'Edit record' })).toBeVisible();
    await expect(clientDetails.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/#/contacts');
    const contactDetails = await openRecord(page, contact.record.contact_id);
    await expect(contactDetails.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/#/properties');
    await page.getByRole('button', { name: /Issued tower/ }).click();
    await expect(page.getByRole('dialog', { name: 'Issued tower' })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/#/follow-ups');
    await page.getByRole('button', { name: 'Add follow-up', exact: true }).click();
    const taskClient = page.getByRole('dialog').getByLabel('Client ID', { exact: true });
    await expect(taskClient).toBeFocused();
    await taskClient.selectOption(created.record.client_id);
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const task = (await workspaceRecords(page)).body.records['Follow-ups'][0].record;
    expect(task.activity_id).toMatch(/^FU-\d{3,}$/);
    const taskDetails = await openRecord(page, task.activity_id);
    await expect(taskDetails.getByRole('button', { name: 'Delete' })).toBeVisible();
    expect(property.record.property_id).toMatch(/^PR-\d{3,}$/);

    await owner.page.goto('/#/clients');
    await owner.page.getByRole('button', { name: 'Add client', exact: true }).click();
    const ownerId = owner.page.getByRole('dialog').getByLabel('Client ID', { exact: true });
    await expect(ownerId).not.toHaveAttribute('readonly', '');
    await expect(ownerId).toBeFocused();
    await ownerId.fill('ADMIN-TYPED-1');
    await owner.page.getByRole('dialog').getByLabel('Full name').fill('Typed by Admin');
    await saveRecordForm(owner.page);
    await expect(owner.page.getByRole('dialog')).toHaveCount(0);
    const typed = await openRecord(owner.page, 'ADMIN-TYPED-1');
    await expect(typed.getByRole('button', { name: 'Delete' })).toBeVisible();
  } finally {
    await staff.context.close();
    await owner.context.close();
  }
});
