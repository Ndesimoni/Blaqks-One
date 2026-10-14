import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord, signInMember } from './assign-helpers.js';
import { changeAccountStatus, clickMemberAction } from './team-status-helpers.js';

const queue = 'Unassigned · needs owner';

test('an Admin filters by assignee and bulk reassigns to a member and to the queue', async ({
  browser,
}) => {
  const team = await assignTeam('bulk');
  const { admin, one, two } = team.people;
  const first = await held(team, 'Clients', { full_name: 'Bulk first' }, one.id);
  await held(team, 'Clients', { full_name: 'Bulk second' }, one.id);
  await held(team, 'Clients', { full_name: 'Bulk kept by Admin' });
  const { page, context } = await memberPage(browser, admin.email);
  try {
    await page.goto('/#/clients');
    const filter = page.getByRole('group', { name: 'Assignment' });
    const assignedTo = filter.getByLabel('Assigned to');
    await expect(assignedTo).toHaveValue('');
    await expect(filter.getByRole('button', { name: 'Reassign all' })).toHaveCount(0);
    await assignedTo.selectOption({ label: one.name });
    await expect(filter.getByRole('status')).toHaveText('2 records');
    await expect(page.getByText('Bulk kept by Admin', { exact: true })).toHaveCount(0);
    await filter.getByRole('button', { name: 'Reassign all' }).click();
    let dialog = page.getByRole('dialog', { name: 'Reassign 2 records' });
    await expect(dialog).toContainText(`Currently assigned to ${one.name}.`);
    await expect(dialog.getByRole('heading', { name: 'Reassign 2 records' })).toBeFocused();
    await dialog.getByLabel('New assignee').selectOption({ label: two.name });
    await dialog.getByLabel('Hand-off note (optional)').fill('Covering while away.');
    await dialog.getByRole('button', { name: 'Reassign 2', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('2 records reassigned');
    await expect(filter.getByRole('status')).toHaveText('0 records');
    await expect(filter.getByRole('button', { name: 'Reassign all' })).toBeDisabled();

    await assignedTo.selectOption({ label: two.name });
    await expect(filter.getByRole('status')).toHaveText('2 records');
    await filter.getByRole('button', { name: 'Reassign all' }).click();
    dialog = page.getByRole('dialog', { name: 'Reassign 2 records' });
    await dialog.getByLabel('New assignee').selectOption({ label: queue });
    await dialog.getByRole('button', { name: 'Reassign 2', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await assignedTo.selectOption({ label: queue });
    await expect(filter.getByRole('status')).toHaveText('2 records');
    const details = await openRecord(page, first.record.client_id);
    await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText(queue);
    await details.getByRole('button', { name: 'Show history' }).click();
    await expect(details.getByRole('group', { name: 'Assignment history' })).toContainText(
      'Bulk reassignment',
    );
    await expect(details.getByRole('group', { name: 'Assignment history' })).toContainText(
      'Covering while away.',
    );
    await page.keyboard.press('Escape');
    await assignedTo.selectOption({ label: 'Everyone' });
    await expect(filter.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Clients pages' })).toContainText('of 3');
  } finally {
    await context.close();
  }
});

test('suspending a staff member sends their records to the Admin queue', async ({ browser }) => {
  const team = await assignTeam('depart');
  const { admin, one } = team.people;
  const client = await held(team, 'Clients', { full_name: 'Departing client' }, one.id);
  const { page, context } = await memberPage(browser, admin.email);
  try {
    await page.goto('/#/team-access');
    await page.getByLabel('Search team').fill(one.name);
    await changeAccountStatus(page, one.name, 'Suspend');
    await page.goto('/#/clients');
    await page.reload();
    const details = await openRecord(page, client.record.client_id);
    await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText(queue);
    await details.getByRole('button', { name: 'Show history' }).click();
    await expect(details.getByRole('group', { name: 'Assignment history' })).toContainText(
      'Released when a member left',
    );
    await page.keyboard.press('Escape');
    await page.getByLabel('Assigned to').selectOption({ label: queue });
    await expect(page.getByRole('group', { name: 'Assignment' }).getByRole('status')).toHaveText(
      '1 record',
    );
  } finally {
    await context.close();
  }
});

test('whole-team visibility shows the team records but never ungranted sections', async ({
  browser,
}) => {
  const team = await assignTeam('fullteam');
  const { admin, one, two } = team.people;
  await held(team, 'Clients', { full_name: 'Team client by Admin' });
  await held(team, 'Clients', { full_name: 'Team client of two' }, two.id);
  const owner = await memberPage(browser, admin.email);
  const staff = await memberPage(browser, one.email);
  try {
    await staff.page.goto('/#/clients');
    await expect(staff.page.getByRole('navigation', { name: 'Clients pages' })).toContainText(
      'of 0',
    );
    const { page } = owner;
    await page.goto('/#/team-access');
    await page.getByLabel('Search team').fill(one.name);
    await clickMemberAction(page, one.name, `Edit ${one.name}`);
    const dialog = page.getByRole('dialog', { name: 'Edit teammate' });
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    const scope = dialog.getByRole('group', { name: 'Record visibility' });
    await expect(scope.getByLabel('Only records assigned to them')).toBeChecked();
    await scope.getByLabel("Whole team's records").check();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog).toContainText('Record visibility');
    await expect(dialog).toContainText("Whole team's records");
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await staff.page.reload();
    await expect(staff.page.getByLabel('Email address')).toBeVisible();
    await signInMember(staff.page, one.email);
    await staff.page.goto('/#/clients');
    await expect(staff.page.getByRole('navigation', { name: 'Clients pages' })).toContainText(
      'of 2',
    );
    await expect(staff.page.getByText('Team client of two', { exact: true })).toBeVisible();
    await expect(staff.page.getByRole('group', { name: 'Assignment' })).toBeVisible();
    // Property Agents hold own-view finance by default (owner Q12); whole-team record
    // visibility never adds "See team finance", messaging channels or team management.
    const session = await (await staff.page.request.get('/api/crm/auth/session')).json();
    expect(session.user.financeAccess).toMatchObject({ scope: 'own', teamView: false });
    for (const path of ['/#/messages', '/#/team-access']) {
      await staff.page.goto(path);
      await expect(staff.page.getByRole('heading', { name: 'Access is restricted' })).toBeVisible();
    }
  } finally {
    await owner.context.close();
    await staff.context.close();
  }
});
