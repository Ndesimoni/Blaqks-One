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
import { FINANCE, withFinance } from '../api/permission-helpers.mjs';

/** Record actions plus "See team finance", which Client deletes also need (owner Q9, L-F2). */
const teamFinance = (base) => withFinance(base, { ...FINANCE.preset, teamView: true });

/** Signs the member in afresh (a grant change revokes their sessions) and reads their grants. */
async function signedIn(browser, email) {
  const staff = await memberPage(browser, email);
  const profile = await (await staff.page.request.get('/api/crm/auth/session')).json();
  return { ...staff, grants: profile.user.recordActions };
}

test('whole-team Delete clients & contacts follows the tick and the linked-module rule (M-C)', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const team = await assignTeam('pdelete');
  const { one } = team.people;
  const gone = (await held(team, 'Clients', { full_name: 'Delete me' })).record.client_id;
  const kept = (await held(team, 'Clients', { full_name: 'Keep me' })).record.client_id;
  const owner = (await held(team, 'Contacts', { full_name: 'Linked owner' })).record.contact_id;

  await setGrants(team, 'one', { recordScope: 'team', actions: teamFinance(actions()) });
  let staff = await signedIn(browser, one.email);
  try {
    const { page } = staff;
    expect(staff.grants.Clients.delete).toBe(true);
    await page.goto('/#/clients');
    let details = await openRecord(page, gone);
    await expect(footer(details)).toHaveText(['Delete', 'Edit record']);
    page.once('dialog', (confirmation) => confirmation.accept());
    await details.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Open record ${gone}` })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: `Open record ${kept}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Open record ${gone}` })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }

  // Without the tick: Delete is hidden and the server refuses.
  await setGrants(team, 'one', {
    recordScope: 'team',
    actions: teamFinance(actions(true, { relationships: { deleteMain: false } })),
  });
  staff = await signedIn(browser, one.email);
  try {
    const { page } = staff;
    expect(staff.grants.Clients).toEqual({ create: true, edit: true, delete: false, assign: true });
    await page.goto('/#/clients');
    const details = await openRecord(page, kept);
    await expect(footer(details)).toHaveText(['Edit record']);
    await page.keyboard.press('Escape');
    await refused(await recordCall(page, 'DELETE', 'Clients', 'client_id', kept), MESSAGES.delete);
  } finally {
    await staff.context.close();
  }

  // Tick kept without "See team finance": Clients lose Delete (a deal may link them, L-F2);
  // Contacts are not linked by finance and keep it.
  await setGrants(team, 'one', {
    recordScope: 'team',
    actions: withFinance(actions(), FINANCE.preset),
  });
  staff = await signedIn(browser, one.email);
  try {
    const { page } = staff;
    expect(staff.grants.Clients).toEqual({ create: true, edit: true, delete: false, assign: true });
    expect(staff.grants.Contacts.delete).toBe(true);
    await page.goto('/#/clients');
    const details = await openRecord(page, kept);
    await expect(footer(details)).toHaveText(['Edit record']);
    await page.keyboard.press('Escape');
    await refused(await recordCall(page, 'DELETE', 'Clients', 'client_id', kept), MESSAGES.delete);
    await page.goto('/#/contacts');
    await expect(footer(await openRecord(page, owner))).toHaveText(['Delete', 'Edit record']);
  } finally {
    await staff.context.close();
  }

  // Tick and team finance kept but Scheduling off: Clients lose Delete (M-C); Contacts only need Properties.
  const member = await setGrants(team, 'one', (current) => ({
    recordScope: 'team',
    permissions: { ...current.permissions, schedule: false },
    actions: teamFinance(actions()),
  }));
  expect(member.actions.relationships.deleteMain).toBe(true);
  expect(member.actions.finance.teamView).toBe(true);
  expect(member.actions.schedule).toEqual({
    create: false,
    edit: false,
    assign: false,
    deleteActivity: false,
  });
  staff = await signedIn(browser, one.email);
  try {
    const { page } = staff;
    expect(staff.grants.Clients.delete).toBe(false);
    expect(staff.grants.Contacts.delete).toBe(true);
    await page.goto('/#/clients');
    let details = await openRecord(page, kept);
    await expect(footer(details)).toHaveText(['Edit record']);
    await page.keyboard.press('Escape');
    await refused(await recordCall(page, 'DELETE', 'Clients', 'client_id', kept), MESSAGES.delete);
    await page.goto('/#/contacts');
    details = await openRecord(page, owner);
    await expect(footer(details)).toHaveText(['Delete', 'Edit record']);
  } finally {
    await staff.context.close();
  }
});
