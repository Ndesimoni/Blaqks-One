import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import {
  assignInBrowser,
  memberPage,
  openRecord,
  saveRecordForm,
  workspaceRecords,
} from './assign-helpers.js';

const location = { 'Building / project': 'Marina Gate 2', Community: 'Dubai Marina' };

async function showTab(page, name) {
  const group = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  await group.getByRole('button', { name, exact: true }).click();
  await expect(group.getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

test('an Admin files a security guard by location, finds it, recategorises it and staff see it', async ({
  browser,
}) => {
  const team = await assignTeam('ctloc');
  await held(team, 'Contacts', {
    contact_id: 'CT-LOC-OWN',
    full_name: 'Loc owner',
    contact_type: 'Owner',
  });
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const rows = page.locator('.data-table tbody tr');
  const search = page.getByRole('textbox', { name: 'Search Contacts', exact: true });
  try {
    await page.goto('/#/contacts');
    await page.getByRole('button', { name: 'Add contact', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Contact ID', { exact: true }).fill('CT-LOC-1');
    await form.getByLabel('Full name', { exact: true }).fill('Loc guard');
    await form.getByLabel('Contact type', { exact: true }).selectOption('Security guard');
    await form.getByLabel('Company', { exact: true }).fill('Guard Co');
    for (const [label, value] of Object.entries(location))
      await form.getByLabel(label, { exact: true }).fill(value);
    await form.getByLabel('Emirate', { exact: true }).selectOption('Dubai');
    await saveRecordForm(page);
    await expect(form).toHaveCount(0);
    const saved = (await workspaceRecords(page)).body.records.Contacts.find(
      (row) => row.record.contact_id === 'CT-LOC-1',
    ).record;
    expect(saved).toMatchObject({
      contact_type: 'Security guard',
      building_project: 'Marina Gate 2',
      community: 'Dubai Marina',
      emirate: 'Dubai',
    });

    await page.reload();
    await expect(page.locator('.data-table thead')).toContainText('Building / project');
    await expect(rows.filter({ hasText: 'CT-LOC-1' })).toContainText('Marina Gate 2');
    await showTab(page, 'Security guards');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Loc guard');
    await showTab(page, 'Other contacts');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Loc owner');
    await showTab(page, 'All');
    for (const query of ['marina gate 2', 'DUBAI MARINA']) {
      await search.fill(query);
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('CT-LOC-1');
    }
    await search.fill('');

    const details = await openRecord(page, 'CT-LOC-1');
    const labels = await details.locator('.detail-field > span').allTextContents();
    const at = labels.indexOf('Company');
    expect(labels.slice(at, at + 4)).toEqual([
      'Company',
      'Building / project',
      'Community',
      'Emirate',
    ]);
    for (const value of ['Marina Gate 2', 'Dubai Marina', 'Dubai'])
      await expect(
        details.locator('.detail-field strong', { hasText: value }).first(),
      ).toBeVisible();
    await details.getByRole('button', { name: 'Edit record', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Contact type', { exact: true })
      .selectOption('Building manager');
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await showTab(page, 'Security guards');
    await expect(rows).toHaveCount(0);
    await showTab(page, 'Building managers');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Marina Gate 2');
    await assignInBrowser(page, 'Contacts', 'contact_id', 'CT-LOC-1', team.people.one.id);
    expect(errors).toEqual([]);
  } finally {
    await admin.context.close();
  }
  const staff = await memberPage(browser, team.people.one.email);
  try {
    await staff.page.goto('/#/contacts');
    await showTab(staff.page, 'Building managers');
    await expect(staff.page.locator('.data-table tbody tr')).toContainText('Marina Gate 2');
    const view = await openRecord(staff.page, 'CT-LOC-1');
    for (const value of ['Building manager', 'Marina Gate 2', 'Dubai Marina', 'Dubai'])
      await expect(view.locator('.detail-field strong', { hasText: value }).first()).toBeVisible();
  } finally {
    await staff.context.close();
  }
});
