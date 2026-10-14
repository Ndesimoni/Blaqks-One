import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, openRecord } from './assign-helpers.js';

async function startReassign(page, id) {
  const details = await openRecord(page, id);
  await details.getByRole('button', { name: 'Reassign', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Reassign ${id}`, exact: true });
  await expect(dialog).toBeVisible();
  return { details, dialog };
}

test('an Admin hands a client to staff with a note the new assignee reads in history', async ({
  browser,
}) => {
  const team = await assignTeam('handoff');
  const { admin, one } = team.people;
  const client = await held(team, 'Clients', { full_name: 'Handoff client' });
  const id = client.record.client_id;
  const owner = await memberPage(browser, admin.email);
  const staff = await memberPage(browser, one.email);
  try {
    await staff.page.goto('/#/clients');
    await expect(staff.page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);

    await owner.page.goto('/#/clients');
    const { details, dialog } = await startReassign(owner.page, id);
    const assigned = details.getByRole('region', { name: 'Assigned to' });
    await expect(assigned).toContainText('You');
    await expect(dialog.getByRole('heading', { name: `Reassign ${id}` })).toBeFocused();
    const select = dialog.getByLabel('New assignee');
    await expect(select.locator('option', { hasText: 'Unassigned · needs owner' })).toHaveCount(1);
    await select.selectOption({ label: one.name });
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    const note = 'Keys are with reception; call before noon.';
    await dialog.getByLabel('Hand-off note (optional)').fill(note);
    await expect(dialog).toContainText(`${note.length} / 1000 characters`);
    await dialog.getByRole('button', { name: 'Reassign', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(owner.page.locator('.toast')).toContainText('Assignment updated');
    await expect(assigned).toContainText(one.name);

    await staff.page.reload();
    const mine = await openRecord(staff.page, id);
    await expect(mine.getByRole('region', { name: 'Assigned to' })).toContainText('You');
    await mine.getByRole('button', { name: 'Show history', exact: true }).click();
    const history = mine.getByRole('group', { name: 'Assignment history' });
    await expect(history).toContainText('Reassigned');
    await expect(history).toContainText(`${admin.name} → ${one.name} · by ${admin.name}`);
    await expect(history).toContainText(note);
  } finally {
    await owner.context.close();
    await staff.context.close();
  }
});

test('staff are warned before a hand-off, lose the record and the teammate receives it', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('passon');
  const { one, two } = team.people;
  const client = await held(team, 'Clients', { full_name: 'Passed client' }, one.id);
  const id = client.record.client_id;
  const sender = await memberPage(browser, one.email);
  const receiver = await memberPage(browser, two.email);
  try {
    await sender.page.goto('/#/clients');
    const { dialog } = await startReassign(sender.page, id);
    const select = dialog.getByLabel('New assignee');
    await expect(select.locator('option', { hasText: 'Unassigned · needs owner' })).toHaveCount(0);
    await select.selectOption({ label: `${one.name} (you) · current` });
    await expect(dialog).toContainText('This is already the current assignee.');
    await expect(dialog.getByRole('button', { name: 'Reassign', exact: true })).toBeDisabled();
    await select.selectOption({ label: two.name });
    await expect(dialog.getByRole('alert')).toContainText('You will no longer see this record.');
    const handOff = dialog.getByRole('button', { name: 'Hand off record', exact: true });
    await dialog.getByLabel('Hand-off note (optional)').fill('Buyer prefers WhatsApp.');
    for (const theme of ['dark', 'light']) {
      await sender.page.evaluate(
        (value) => (document.documentElement.dataset.theme = value),
        theme,
      );
      await sender.page.screenshot({ path: testInfo.outputPath(`handoff-warning-${theme}.png`) });
    }
    await handOff.click();
    await expect(sender.page.getByRole('dialog')).toHaveCount(0);
    await expect(sender.page.locator('.toast')).toContainText(
      'Record handed off. You no longer see it.',
    );
    await expect(sender.page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);
    await expect(sender.page.getByRole('navigation', { name: 'Clients pages' })).toContainText(
      'Showing 0–0 of 0',
    );
    await sender.page.reload();
    await expect(sender.page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);

    await receiver.page.goto('/#/clients');
    await receiver.page.reload();
    const received = await openRecord(receiver.page, id);
    await expect(received.getByRole('region', { name: 'Assigned to' })).toContainText('You');
    await received.getByRole('button', { name: 'Show history', exact: true }).click();
    await expect(received.getByRole('group', { name: 'Assignment history' })).toContainText(
      'Buyer prefers WhatsApp.',
    );
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});
