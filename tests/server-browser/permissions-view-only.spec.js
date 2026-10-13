import { test, expect } from './fixtures.js';
import { memberPage, openRecord, saveRecordForm } from './assign-helpers.js';
import {
  actions,
  assignTeam,
  footer,
  held,
  MESSAGES,
  PAGES,
  recordCall,
  refused,
  setGrants,
} from './permissions-fixtures.js';

test('view-only staff see their assigned records with a View only chip and no change controls', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await assignTeam('pview');
  const { one } = team.people;
  await setGrants(team, 'one', { actions: actions(false) });
  const client = await held(team, 'Clients', { full_name: 'View-only client' }, one.id);
  const ids = {
    Clients: client.record.client_id,
    Contacts: (await held(team, 'Contacts', { full_name: 'View-only owner' }, one.id)).record
      .contact_id,
    Properties: (await held(team, 'Properties', { listing_title: 'View-only villa' }, one.id))
      .record.property_id,
    'Follow-ups': (await held(team, 'Follow-ups', { client_id: client.record.client_id }, one.id))
      .record.activity_id,
  };
  const staff = await memberPage(browser, one.email);
  const { page } = staff;
  try {
    const profile = await (await page.request.get('/api/crm/auth/session')).json();
    for (const collection of ['Clients', 'Contacts', 'Properties', 'Follow-ups'])
      expect(profile.user.recordActions[collection]).toEqual({
        create: false,
        edit: false,
        delete: false,
        assign: false,
      });
    for (const [route, collection] of PAGES) {
      await page.goto(`/#/${route}`);
      const chip = page.locator('.view-only-chip');
      await expect(chip, route).toBeVisible();
      await expect(chip).toContainText(/view only/i);
      await expect(page.getByRole('button', { name: /^Add\b/ }), route).toHaveCount(0);
      if (route === 'properties')
        await page.getByRole('button', { name: 'Table view', exact: true }).click();
      const details = await openRecord(page, ids[collection]);
      await expect(footer(details), route).toHaveText(['Close']);
      const change = /^(Edit|Delete|Upload|Add property photos|Reassign|Return to holder)/;
      await expect(details.getByRole('button', { name: change }), route).toHaveCount(0);
      await expect(details.getByRole('region', { name: 'Assigned to' })).toContainText('You');
      await page.keyboard.press('Escape');
      await expect(details).toHaveCount(0);
    }
    // The server is authoritative, whatever the interface shows.
    await refused(
      await recordCall(page, 'POST', 'Clients', 'client_id', null, { full_name: 'Forged' }),
      MESSAGES.create,
    );
    await refused(
      await recordCall(page, 'PATCH', 'Clients', 'client_id', ids.Clients, { full_name: 'X' }),
      MESSAGES.edit,
    );
    await refused(
      await recordCall(page, 'DELETE', 'Follow-ups', 'activity_id', ids['Follow-ups']),
      MESSAGES.delete,
    );
    await page.goto('/#/clients');
    await page.reload();
    await expect(page.locator('.view-only-chip')).toBeVisible();
    await expect(page.getByText('View-only client', { exact: true })).toBeVisible();
  } finally {
    await staff.context.close();
  }
});

test('a create-only member adds a client, then cannot edit or delete it', async ({ browser }) => {
  const team = await assignTeam('pcreate');
  const { one } = team.people;
  await setGrants(team, 'one', { actions: actions(false, { relationships: { create: true } }) });
  const staff = await memberPage(browser, one.email);
  const { page } = staff;
  try {
    await page.goto('/#/clients');
    await expect(page.locator('.view-only-chip')).toHaveCount(0);
    await page.getByRole('button', { name: 'Add client', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Full name').fill('Created by create-only');
    await saveRecordForm(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Created by create-only', { exact: true })).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'Created by create-only' });
    const button = row.getByRole('button', { name: /^Open record / });
    const id = (await button.getAttribute('aria-label')).replace('Open record ', '');
    await page.reload();
    const details = await openRecord(page, id);
    await expect(footer(details)).toHaveText(['Close']);
    await page.keyboard.press('Escape');
    await refused(
      await recordCall(page, 'PATCH', 'Clients', 'client_id', id, { full_name: 'Edited' }),
      MESSAGES.edit,
    );
    await page.goto('/#/properties');
    await expect(page.locator('.view-only-chip')).toBeVisible();
  } finally {
    await staff.context.close();
  }
});
