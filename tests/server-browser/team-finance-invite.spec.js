import { test, expect } from './fixtures.js';
import { teamPath } from '../api/team-helpers.mjs';
import { FINANCE } from '../api/permission-helpers.mjs';
import { closeInvitation, finishInvitation, startInvitation } from './team-helpers.js';
import { editTeammate, memberPage, teamFinance, ticks } from './team-finance-fixtures.js';

const box = (group, name) => group.getByRole('checkbox', { name, exact: true });

test('turning the Finance module off removes the row; invitations never offer the sensitive ticks', async ({
  browser,
}) => {
  const team = await teamFinance('tfinvite');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  try {
    const dialog = await editTeammate(page, team.people.agent.name);
    const crm = dialog.getByRole('group', { name: 'CRM access' });
    await crm.getByRole('checkbox', { name: /^Finance/ }).uncheck();
    await expect(ticks(dialog, 'Finance')).toHaveCount(0);
    await crm.getByRole('checkbox', { name: /^Finance/ }).check();
    await expect(box(ticks(dialog, 'Finance'), 'Add')).toBeChecked();
    // Back at the preset, nothing is unsaved, so the form closes without a prompt.
    await dialog.getByRole('button', { name: 'Close team form' }).click();
    await expect(dialog).toHaveCount(0);

    const invite = await startInvitation(page, 'tfinvite-new');
    await invite.getByRole('checkbox', { name: 'Accountant', exact: true }).check();
    const finance = ticks(invite, 'Finance');
    await expect(finance.getByRole('checkbox')).toHaveCount(3);
    await expect(finance).toContainText(
      'Seeing team finance and approving can be granted later, with whole-team visibility.',
    );
    await finishInvitation(page, invite);
    await closeInvitation(page);
    const list = await team.admin.request(teamPath(team.admin));
    const invited = list.value.members.find((m) => m.email === 'tfinvite-new@browser-team.test');
    expect(invited.actions.finance).toEqual(FINANCE.preset);
  } finally {
    await admin.context.close();
  }
});
