import { test, expect } from './fixtures.js';
import { memberPage, openRecord } from './assign-helpers.js';
import {
  actions,
  assignTeam,
  footer,
  held,
  MESSAGES,
  recordCall,
  refused,
  setGrants,
} from './permissions-fixtures.js';

test('a direct assignee without Hand on cannot delete a follow-up but can still return it', async ({
  browser,
}) => {
  const team = await assignTeam('pfollow');
  const { one, two } = team.people;
  await setGrants(team, 'one', {
    actions: actions(true, {
      relationships: { deleteMain: false },
      properties: { deleteMain: false },
      schedule: { assign: false },
    }),
  });
  const client = await held(team, 'Clients', { full_name: 'Held by two' }, two.id);
  const task = await held(
    team,
    'Follow-ups',
    { client_id: client.record.client_id, next_action: 'Send brochure' },
    one.id,
  );
  const id = task.record.activity_id;
  const staff = await memberPage(browser, one.email);
  const { page } = staff;
  try {
    const profile = await (await page.request.get('/api/crm/auth/session')).json();
    expect(profile.user.recordActions['Follow-ups']).toEqual({
      create: true,
      edit: true,
      delete: true,
      assign: false,
    });
    await page.goto('/#/follow-ups');
    await expect(page.locator('.view-only-chip')).toHaveCount(0);
    const details = await openRecord(page, id);
    await expect(footer(details)).toHaveText(['Edit record']);
    await expect(details.getByRole('button', { name: 'Reassign', exact: true })).toHaveCount(0);
    await refused(
      await recordCall(page, 'DELETE', 'Follow-ups', 'activity_id', id),
      MESSAGES.followUpDelete,
    );

    const opener = details.getByRole('button', { name: 'Return to holder', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: `Return ${id}`, exact: true });
    await expect(dialog.getByRole('heading', { name: `Return ${id}` })).toBeFocused();
    await dialog.getByRole('button', { name: "Return to client's holder", exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText(
      "Follow-up returned to the client's holder.",
    );
    await page.reload();
    await expect(page.getByRole('button', { name: `Open record ${id}` })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
