import { test, expect } from './fixtures.js';
import { clickMemberAction } from './team-status-helpers.js';
import { signIn, session } from './helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';

test('owner edits staff access, invalidates the session and retains the new grants after sign-in', async ({
  page,
  browser,
}) => {
  await signIn(page);
  await openTeam(page);
  let dialog = await startInvitation(page, 'changed-access');
  await dialog.getByRole('checkbox', { name: 'Property Agent', exact: true }).check();
  const link = await finishInvitation(page, dialog);
  const staff = await activateInNewContext(browser, link, 'changed-access@browser-team.test');
  try {
    await expect(staff.page.getByRole('button', { name: 'Properties', exact: true })).toBeVisible();
    await closeInvitation(page);
    await page.reload();
    await page.getByLabel('Search team').fill('Browser changed-access');
    await clickMemberAction(page, 'Browser changed-access', 'Edit Browser changed-access');
    dialog = page.getByRole('dialog', { name: 'Edit teammate' });
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog
      .getByRole('group', { name: 'CRM access' })
      .getByRole('checkbox', { name: /^Properties/ })
      .uncheck();
    await dialog
      .getByRole('group', { name: 'Messaging permissions' })
      .getByRole('checkbox', { name: 'WhatsApp', exact: true })
      .check();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await staff.page.reload();
    await expect(staff.page.getByLabel('Email address')).toBeVisible();
    await staff.page.getByLabel('Email address').fill('changed-access@browser-team.test');
    await staff.page.getByLabel('Password', { exact: true }).fill('Team123!');
    await staff.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(staff.page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
    await expect(staff.page.getByRole('button', { name: 'Properties', exact: true })).toHaveCount(
      0,
    );
    const profile = await session(staff.page);
    expect(profile.user.channelAccess).toEqual({ email: false, whatsapp: true });
    await staff.page.goto('/#/properties');
    await expect(staff.page.getByRole('heading', { name: 'Access is restricted' })).toBeVisible();
  } finally {
    await staff.context.close();
  }
});

test('staff with only future finance access get a clear workspace state and no client data', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin-b');
  await openTeam(page);
  const dialog = await startInvitation(page, 'finance-only');
  await dialog.getByRole('checkbox', { name: 'Accountant', exact: true }).check();
  const link = await finishInvitation(page, dialog);
  const staff = await activateInNewContext(browser, link, 'finance-only@browser-team.test');
  try {
    await expect(
      staff.page.getByRole('heading', { name: 'Your workspace is ready' }),
    ).toBeVisible();
    for (const name of ['Clients', 'Contacts', 'Properties', 'Team']) {
      await expect(staff.page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(staff.page.getByRole('button', { name: 'Add client', exact: true })).toHaveCount(
      0,
    );
    const profile = await session(staff.page);
    expect(profile.user.permissions.finance).toBe(true);
    expect(profile.user.permissions.relationships).toBe(false);
    await staff.page.goto('/#/payments');
    await expect(
      staff.page.getByRole('region', { name: 'Payments connection status' }),
    ).toContainText('NOT CONNECTED YET');
    await expect(staff.page.locator('.data-table tbody tr')).toHaveCount(0);
    await expect(staff.page.getByRole('button', { name: 'Add client', exact: true })).toHaveCount(
      0,
    );
    for (const route of ['/workspaces', '/team-activity']) {
      await staff.page.goto(`/#${route}`);
      await expect(staff.page.getByRole('heading', { name: 'Access is restricted' })).toBeVisible();
    }
  } finally {
    await staff.context.close();
  }
  await closeInvitation(page);
});
