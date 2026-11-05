import { test, expect } from './fixtures.js';
import { staffLogin } from '../api/team-helpers.mjs';
import { FINANCE } from '../api/permission-helpers.mjs';
import {
  editTeammate,
  findMember,
  financeTicks,
  LABELS,
  memberPage,
} from './team-finance-fixtures.js';
import { SCOPE, teamFinance, ticks } from './team-finance-fixtures.js';

const box = (group, name) => group.getByRole('checkbox', { name, exact: true });

test('an Admin grants See team finance and Approve to whole-team staff; deletes follow', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await teamFinance('tfgrant');
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  try {
    const dialog = await editTeammate(page, team.people.agent.name);
    const { group, view, approve } = financeTicks(dialog);
    await expect(dialog.getByRole('group', { name: /: What they can do$/ })).toHaveCount(4);
    await expect(group.getByRole('checkbox')).toHaveCount(5);
    for (const name of ['Add', 'Edit', 'Hand on']) await expect(box(group, name)).toBeChecked();

    // Assigned visibility: both sensitive ticks are off, disabled and explained.
    for (const tick of [view, approve]) {
      await expect(tick).toBeDisabled();
      await expect(tick).not.toBeChecked();
    }
    await expect(view).toHaveAccessibleDescription('See team finance: Needs whole-team visibility');
    await expect(approve).toHaveAccessibleDescription(
      'Approve payments & expenses: Needs whole-team visibility',
    );
    await dialog.getByRole('radio', { name: SCOPE.team }).check();
    await expect(view).toBeEnabled();
    await expect(approve).toBeDisabled();
    await expect(approve).toHaveAccessibleDescription(
      'Approve payments & expenses: Needs See team finance',
    );

    // Deleting properties needs See team finance; clients & contacts explain the client part.
    const rel = ticks(dialog, LABELS.rel);
    const del = box(rel, 'Delete clients & contacts');
    const propDel = box(ticks(dialog, LABELS.prop), 'Delete properties');
    await expect(propDel).toBeDisabled();
    await expect(propDel).toHaveAccessibleDescription('Needs See team finance under Finance');
    await expect(del).toBeEnabled();
    await expect(del).toHaveAccessibleDescription(/deletes contacts only\.$/);

    await view.check();
    await expect(approve).toBeEnabled();
    await expect(view).toHaveAccessibleDescription(/^See team finance: Sensitive: shows every/);
    await expect(propDel).toBeEnabled();
    await expect(del).toHaveAccessibleDescription(
      'Sensitive: removes records for the whole team. Off by default.',
    );
    await approve.check();
    await del.check();

    // Unticking See team finance clears Approve and Delete properties; ticking again does not restore.
    await propDel.check();
    await view.uncheck();
    await expect(approve).not.toBeChecked();
    await expect(propDel).not.toBeChecked();
    await view.check();
    await expect(approve).not.toBeChecked();
    await approve.check();

    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    const review = dialog.locator('.team-action-review');
    await expect(review.locator('dt')).toHaveText([
      LABELS.rel,
      LABELS.prop,
      LABELS.sched,
      'Finance',
    ]);
    await expect(review.locator('dd').last()).toContainText(
      'Add, Edit, Hand on, See team finance, Approve payments & expenses',
    );
    await expect(review.locator('.team-action-flag')).toHaveText([
      'Sensitive: Delete clients & contacts',
      'Sensitive: See team finance, Approve payments & expenses',
    ]);
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const stored = await findMember(team.admin, team.agent.user.id);
    expect(stored.recordScope).toBe('team');
    expect(stored.actions.finance).toEqual(FINANCE.all);
    expect(stored.actions.relationships.deleteMain).toBe(true);
    expect(stored.actions.properties.deleteMain).toBe(false);
    const staff = await staffLogin(team.people.agent.email);
    expect(staff.user.financeAccess).toMatchObject({
      scope: 'team',
      teamView: true,
      approve: true,
    });
    // Delete clients is now effective (owner Q9): See team finance covers the deal links.
    expect(staff.user.recordActions.Clients.delete).toBe(true);
    expect(staff.user.recordActions.Contacts.delete).toBe(true);

    await page.reload();
    const again = financeTicks(await editTeammate(page, team.people.agent.name));
    await expect(again.view).toBeChecked();
    await expect(again.approve).toBeChecked();
    await page.getByRole('radio', { name: SCOPE.assigned }).check();
    await expect(again.view).not.toBeChecked();
    await expect(again.approve).toBeDisabled();
  } finally {
    await admin.context.close();
  }
});
