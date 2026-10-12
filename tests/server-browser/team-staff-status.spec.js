import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';
import {
  changeAccountStatus,
  expectSuspended,
  signInActivatedMember,
  teamCard,
} from './team-status-helpers.js';

test('an Admin suspends and restores their staff with clear pending and activated controls', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin-b');
  await openTeam(page);
  const form = await startInvitation(page, 'status-staff');
  await form.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
  const link = await finishInvitation(page, form);
  await closeInvitation(page);
  await page.getByLabel('Search team').fill('Browser status-staff');
  const card = teamCard(page, 'Browser status-staff');
  await expect(card).toContainText('Invitation pending');
  await expect(card.getByRole('button', { name: /Cancel invitation/ })).toBeEnabled();
  await expect(card.getByRole('button', { name: /Suspend account|Restore account/ })).toHaveCount(
    0,
  );
  const staff = await activateInNewContext(browser, link, 'status-staff@browser-team.test');
  try {
    await page.reload();
    await page.getByLabel('Search team').fill('Browser status-staff');
    await changeAccountStatus(page, 'Browser status-staff', 'Suspend');
    await expectSuspended(staff.page, 'status-staff@browser-team.test');
    await changeAccountStatus(page, 'Browser status-staff', 'Restore');
    await signInActivatedMember(staff.page, 'status-staff@browser-team.test');
    await expect(staff.page.getByRole('button', { name: 'Team', exact: true })).toHaveCount(0);
    await expect(staff.page.getByLabel('Workspace', { exact: true })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
