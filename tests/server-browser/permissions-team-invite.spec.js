import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { session, signIn } from './helpers.js';
import { closeInvitation, openTeam, startInvitation } from './team-helpers.js';
import { findMember } from '../api/team-helpers.mjs';
import { FINANCE } from '../api/permission-helpers.mjs';
import { assignTeam, editTeammate, LABELS, ticks } from './permissions-fixtures.js';

const deleteMain = /^Delete (clients & contacts|properties)$/;

test('the invitation form offers action ticks but never the delete-main ticks', async ({
  browser,
}) => {
  const team = await assignTeam('pinvite');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  try {
    await openTeam(page);
    const dialog = await startInvitation(page, 'pinvite-new');
    await expect(dialog.getByRole('group', { name: /: What they can do$/ })).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: 'Use position defaults', exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'Property Agent', exact: true }).check();
    await expect(dialog.getByRole('group', { name: /: What they can do$/ })).toHaveCount(4);
    await expect(dialog.getByRole('checkbox', { name: deleteMain })).toHaveCount(0);
    await expect(dialog.getByRole('group', { name: 'Record visibility' })).toHaveCount(0);
    await expect(ticks(dialog, LABELS.rel)).toContainText(
      'Deleting clients and contacts can be granted later, with whole-team visibility.',
    );
    await expect(ticks(dialog, LABELS.prop)).toContainText(
      'Deleting properties can be granted later, with whole-team visibility.',
    );
    await ticks(dialog, LABELS.rel).getByRole('checkbox', { name: 'Hand on' }).uncheck();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog.locator('.team-action-review dd').first()).toHaveText('Add, Edit');
    await expect(dialog.locator('.team-action-flag')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Invitation ready' })).toBeVisible();
    const { user } = await session(page);
    const list = await page.request.get(`/api/crm/workspaces/${user.workspaceId || user.id}/team`);
    const invited = (await list.json()).members.find(
      (member) => member.email === 'pinvite-new@browser-team.test',
    );
    expect(invited.actions.relationships).toEqual({
      create: true,
      edit: true,
      assign: false,
      deleteMain: false,
    });
    expect(invited.actions.properties.deleteMain).toBe(false);
    // Invitations never grant See team finance or Approve (finance-design §5.1).
    expect(invited.actions.finance).toEqual(FINANCE.preset);
    await closeInvitation(page);
  } finally {
    await admin.context.close();
  }
});

test('editing an Admin shows no action ticks and keeps the Admin full access', async ({ page }) => {
  const team = await assignTeam('padmin');
  await signIn(page, 'owner');
  const dialog = await editTeammate(page, 'Synthetic padmin-admin');
  await expect(dialog.getByRole('heading', { name: 'Admin access' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: /What they can do$/ })).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: deleteMain })).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Use position defaults', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Record actions' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await findMember(team.owner, team.admin.user.id);
  expect(stored.roleId).toBe('admin');
  const profile = team.admin.user.recordActions;
  for (const collection of ['Clients', 'Contacts', 'Properties', 'Follow-ups'])
    expect(profile[collection]).toEqual({ create: true, edit: true, delete: true, assign: true });
});
