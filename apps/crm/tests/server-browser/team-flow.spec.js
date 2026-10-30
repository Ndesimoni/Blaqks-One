import { test, expect } from './fixtures.js';
import { signIn, addClient, session } from './helpers.js';
import { teamCard } from './team-status-helpers.js';
import { assignInBrowser } from './assign-helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';

test('Admin invites a colleague with multiple positions who signs in to the shared workspace', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await addClient(page, 'BROWSER-TEAM-CLIENT', 'Shared team client');
  const owner = await session(page);
  await openTeam(page);
  const dialog = await startInvitation(page, 'shared-staff');
  await expect(dialog.getByLabel('Account type')).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Lead Manager', exact: true }).check();
  await dialog
    .getByRole('group', { name: 'Messaging permissions' })
    .getByRole('checkbox', { name: 'Email', exact: true })
    .check();
  const link = await finishInvitation(page, dialog);
  await expect(page.getByRole('dialog', { name: 'Invitation ready' })).toContainText(
    'No email has been sent',
  );
  const staff = await activateInNewContext(browser, link, 'shared-staff@browser-team.test');
  try {
    await expect(staff.page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
    // Staff see assigned records only, so the Admin hands this client to the new colleague.
    const staffId = (await session(staff.page)).user.id;
    await assignInBrowser(page, 'Clients', 'client_id', 'BROWSER-TEAM-CLIENT', staffId);
    await staff.page.reload();
    await expect(staff.page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
    await staff.page.getByLabel('Search Clients', { exact: true }).fill('BROWSER-TEAM-CLIENT');
    await expect(staff.page.getByText('Shared team client', { exact: true })).toBeVisible();
    await expect(staff.page.getByRole('button', { name: 'Team', exact: true })).toHaveCount(0);
    await expect(staff.page.getByRole('button', { name: 'Properties', exact: true })).toHaveCount(
      0,
    );
    await expect(staff.page.getByLabel('Workspace', { exact: true })).toHaveCount(0);
    const identity = await session(staff.page);
    expect(identity.user.workspaceId).toBe(owner.user.id);
    expect(identity.user.channelAccess).toEqual({ email: true, whatsapp: false });
    await staff.page.goto('/#/team-access');
    await expect(staff.page.getByRole('heading', { name: 'Access is restricted' })).toBeVisible();
    await expect(staff.page.getByRole('button', { name: 'Invite teammate' })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
  await closeInvitation(page);
  await page.reload();
  await page.getByLabel('Search team').fill('Browser shared-staff');
  await expect(teamCard(page, 'Browser shared-staff')).toContainText('Active');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await signIn(page, 'admin-b');
  await openTeam(page);
  await expect(page.getByText('Browser shared-staff', { exact: true })).toHaveCount(0);
});

test('Super Admin invites an Admin with a separate workspace and Admin creation stays unavailable to staff owners', async ({
  page,
  browser,
}) => {
  await signIn(page, 'owner');
  await openTeam(page);
  const dialog = await startInvitation(page, 'separate-admin', true);
  await expect(dialog.getByRole('heading', { name: 'Admin access' })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Receptionist' })).toHaveCount(0);
  const link = await finishInvitation(page, dialog);
  const admin = await activateInNewContext(browser, link, 'separate-admin@browser-team.test');
  try {
    await expect(admin.page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
    const identity = await session(admin.page);
    expect(identity.user.roleId).toBe('admin');
    expect(identity.user.workspaceId).toBe(identity.user.id);
    await openTeam(admin.page);
    const form = await startInvitation(admin.page, 'admin-child');
    await expect(form.getByLabel('Account type')).toHaveCount(0);
    admin.page.once('dialog', (alert) => alert.accept());
    await form.getByRole('button', { name: 'Close team form' }).click();
  } finally {
    await admin.context.close();
  }
  await closeInvitation(page);
});
