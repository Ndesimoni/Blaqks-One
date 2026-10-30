import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import {
  memberPage,
  noPageOverflow,
  openRecord,
  setTheme,
  workspaceRecords,
} from './assign-helpers.js';

const chain =
  "Only the client's holder, the Admin or a full-team member can pass this follow-up on. " +
  "You can return it to the client's holder.";

/** Tries to pass the follow-up to `assigneeId` through the API the dialog uses. */
async function passOn(page, activityId, assigneeId) {
  const { identity, path, body } = await workspaceRecords(page);
  const entry = body.records['Follow-ups'].find((row) => row.record.activity_id === activityId);
  return page.request.put(`${path}/Follow-ups/${entry.id}/assignee`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { version: entry.version, assigneeId },
  });
}

test("a direct assignee who does not hold the client returns the follow-up to the client's holder", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const team = await assignTeam('return');
  const { admin, one, two } = team.people;
  const client = await held(team, 'Clients', { full_name: 'Returned client' }, two.id);
  const task = await held(
    team,
    'Follow-ups',
    { client_id: client.record.client_id, next_action: 'Confirm viewing time' },
    one.id,
  );
  const id = task.record.activity_id;
  const returner = await memberPage(browser, one.email);
  const holder = await memberPage(browser, two.email);
  try {
    const { page } = returner;
    const refused = await passOn(page, id, admin.id);
    expect(refused.status()).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'forbidden', message: chain });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await page.goto('/#/follow-ups');
      const details = await openRecord(page, id);
      await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText('You');
      await expect(details.getByRole('button', { name: 'Reassign', exact: true })).toHaveCount(0);
      const opener = details.getByRole('button', { name: 'Return to holder', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: `Return ${id}`, exact: true });
      await expect(dialog.getByRole('heading', { name: `Return ${id}` })).toBeFocused();
      await expect(dialog).toContainText(
        "The client's holder will get this follow-up back, and it will leave your list.",
      );
      await expect(dialog.getByLabel('New assignee')).toHaveCount(0);
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await dialog.getByLabel('Hand-off note (optional)').fill('Client asked for Arabic.');
      const panel = await dialog.locator('.drawer').boundingBox();
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(390);
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`return-390-${theme}.png`) });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(details).toHaveCount(0);
    }

    const details = await openRecord(page, id);
    await details.getByRole('button', { name: 'Return to holder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Return ${id}`, exact: true });
    await dialog.getByLabel('Hand-off note (optional)').fill('Client asked for Arabic.');
    await dialog.getByRole('button', { name: "Return to client's holder", exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText(
      "Follow-up returned to the client's holder.",
    );
    await expect(page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);

    await holder.page.goto('/#/follow-ups');
    await holder.page.reload();
    const received = await openRecord(holder.page, id);
    const assigned = received.getByRole('region', { name: 'Assigned to' });
    await expect(assigned).toContainText('No direct assignee');
    await expect(assigned).toContainText("Follows the client's assignee: You");
    await received.getByRole('button', { name: 'Show history', exact: true }).click();
    await expect(received.getByRole('group', { name: 'Assignment history' })).toContainText(
      'Client asked for Arabic.',
    );
    await received.getByRole('button', { name: 'Reassign', exact: true }).click();
    const picker = holder.page.getByRole('dialog', { name: `Reassign ${id}`, exact: true });
    await expect(picker.getByLabel('New assignee')).toBeVisible();
  } finally {
    await returner.context.close();
    await holder.context.close();
  }
});
