import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { findMember, staffLogin } from '../api/team-helpers.mjs';
import { assignTeam, editTeammate, LABELS, moduleBox, ticks } from './permissions-fixtures.js';

const box = (group, name) => group.getByRole('checkbox', { name, exact: true });

test('an Admin sets per-action ticks with delete guards, M-D, defaults, review and save', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await assignTeam('pform');
  const name = 'Synthetic pform-one';
  const admin = await memberPage(browser, team.people.admin.email);
  const { page } = admin;
  try {
    const dialog = await editTeammate(page, name);
    await expect(dialog.getByRole('group', { name: /: What they can do$/ })).toHaveCount(3);
    const [rel, prop] = [ticks(dialog, LABELS.rel), ticks(dialog, LABELS.prop)];
    const schedule = ticks(dialog, LABELS.sched);
    await expect(rel.getByRole('checkbox')).toHaveCount(4);
    await expect(prop.getByRole('checkbox')).toHaveCount(5);
    await expect(schedule.getByRole('checkbox')).toHaveCount(4);
    const del = box(rel, 'Delete clients & contacts');
    const propDel = box(prop, 'Delete properties');
    for (const key of ['Add', 'Edit', 'Hand on']) await expect(box(rel, key)).toBeChecked();
    await expect(box(schedule, 'Delete activity')).toBeChecked();
    await expect(del).toBeDisabled();
    await expect(del).not.toBeChecked();
    await expect(del).toHaveAccessibleDescription('Needs whole-team visibility');
    await expect(propDel).toHaveAccessibleDescription('Needs whole-team visibility');

    // Ticks follow the module: off removes them, on again restores the preset.
    await moduleBox(dialog, LABELS.prop).uncheck();
    await expect(prop).toHaveCount(0);
    await moduleBox(dialog, LABELS.prop).check();
    await expect(box(prop, 'Delete activity')).toBeChecked();

    await dialog.getByRole('radio', { name: "Whole team's records" }).check();
    await expect(del).toBeEnabled();
    await expect(del).toHaveAccessibleDescription(/^Sensitive: removes records/);
    await moduleBox(dialog, LABELS.sched).uncheck();
    await expect(del).toBeDisabled();
    await expect(del).toHaveAccessibleDescription('Needs Scheduling and Properties access');
    await expect(propDel).toHaveAccessibleDescription('Needs Scheduling access');
    await moduleBox(dialog, LABELS.sched).check();
    await del.check();
    await propDel.check();
    await dialog.getByRole('radio', { name: 'Only records assigned to them' }).check();
    for (const tick of [del, propDel]) {
      await expect(tick).toBeDisabled();
      await expect(tick).not.toBeChecked();
    }
    await dialog.getByRole('radio', { name: "Whole team's records" }).check();
    await expect(del).toBeEnabled();
    await expect(del).not.toBeChecked();

    // M-D: a position change never re-ticks an action the Admin removed.
    await del.check();
    await box(rel, 'Edit').uncheck();
    await dialog.getByRole('checkbox', { name: 'Lead Manager', exact: true }).check();
    await expect(box(rel, 'Edit')).not.toBeChecked();
    await expect(del).toBeChecked();
    await dialog.getByRole('button', { name: 'Use position defaults', exact: true }).click();
    await expect(box(rel, 'Edit')).toBeChecked();
    await expect(del).not.toBeChecked();

    await box(rel, 'Edit').uncheck();
    await del.check();
    await box(schedule, 'Hand on').uncheck();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Record actions' })).toBeVisible();
    const review = dialog.locator('.team-action-review');
    await expect(review.locator('dt')).toHaveText([LABELS.rel, LABELS.prop, LABELS.sched]);
    await expect(review.locator('dd')).toHaveText([
      'Add, Hand on, Delete clients & contactsSensitive: Delete clients & contacts',
      'Add, Edit, Hand on, Delete activity',
      'Add, Edit, Delete activity',
    ]);
    await expect(review.locator('.team-action-flag')).toHaveText([
      'Sensitive: Delete clients & contacts',
    ]);
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const stored = await findMember(team.admin, team.one.user.id);
    expect(stored.recordScope).toBe('team');
    // Finance grants are checked in the finance specs; this form edits record actions.
    const { finance: _finance, ...recordActions } = stored.actions;
    expect(recordActions).toEqual({
      relationships: { create: true, edit: false, assign: true, deleteMain: true },
      properties: {
        create: true,
        edit: true,
        assign: true,
        deleteActivity: true,
        deleteMain: false,
      },
      schedule: { create: true, edit: true, assign: false, deleteActivity: true },
    });
    const staff = await staffLogin(team.people.one.email);
    expect(staff.user.recordActions.Clients).toEqual({
      create: true,
      edit: false,
      delete: true,
      assign: true,
    });

    await page.reload();
    const again = await editTeammate(page, name);
    const relAgain = ticks(again, LABELS.rel);
    await expect(box(relAgain, 'Edit')).not.toBeChecked();
    await expect(box(relAgain, 'Delete clients & contacts')).toBeChecked();
    await expect(box(ticks(again, LABELS.sched), 'Hand on')).not.toBeChecked();
    await expect(again.getByRole('checkbox', { name: 'Lead Manager', exact: true })).toBeChecked();
    await again.getByRole('button', { name: 'Close team form' }).click();
    await expect(again).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});
