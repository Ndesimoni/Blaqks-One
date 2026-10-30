import { expect } from '@playwright/test';
import { findMember, memberUpdate, teamPath } from '../api/team-helpers.mjs';
import { actions, MESSAGES } from '../api/permission-helpers.mjs';
import { assignTeam, held } from './assign-fixtures.js';
import { workspaceRecords } from './assign-helpers.js';

export { actions, assignTeam, held, MESSAGES };

/** The five connected record pages and their record ID keys (Leads are a view over Clients). */
export const PAGES = [
  ['clients', 'Clients', 'client_id'],
  ['leads', 'Clients', 'client_id'],
  ['contacts', 'Contacts', 'contact_id'],
  ['properties', 'Properties', 'property_id'],
  ['follow-ups', 'Follow-ups', 'activity_id'],
];

/**
 * Changes a staff member's grants through the real team PATCH API as their Admin. `changes`
 * may be a function of the current member (for module changes). Their sessions are revoked.
 */
export async function setGrants(team, who, changes) {
  const member = await findMember(team.admin, team[who].user.id);
  const body = memberUpdate(member, typeof changes === 'function' ? changes(member) : changes);
  const result = await team.admin.request(teamPath(team.admin, member.id), {
    method: 'PATCH',
    body,
  });
  expect(result.status, JSON.stringify(result.value)).toBe(200);
  return result.value.member || result.value;
}

/** Same-origin record API call as the signed-in page (the server is authoritative). */
export async function recordCall(page, method, collection, idKey, legacyId, record) {
  const { identity, path, body } = await workspaceRecords(page);
  const headers = { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken };
  if (method === 'POST')
    return page.request.post(`${path}/${collection}`, { headers, data: { record } });
  const entry = body.records[collection].find((row) => row.record[idKey] === legacyId);
  expect(entry, `${collection} ${legacyId} is visible`).toBeTruthy();
  const url = `${path}/${encodeURIComponent(collection)}/${entry.id}`;
  const data = {
    version: entry.version,
    ...(record ? { record: { ...entry.record, ...record } } : {}),
  };
  return page.request.fetch(url, { method, headers, data });
}

/** Expects an exact server refusal. */
export async function refused(response, message) {
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ code: 'forbidden', message });
}

/** The record details drawer's footer buttons. */
export const footer = (details) => details.locator('.drawer-footer').getByRole('button');

/** The access step of the Edit teammate form for `name`, opened from the Team page. */
export async function editTeammate(page, name) {
  await page.goto('/#/team-access');
  await page.getByLabel('Search team').fill(name);
  const card = page.locator('[data-member-id]').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
  await card.getByRole('button', { name: `More actions for ${name}` }).click();
  await page
    .getByRole('dialog', { name: `${name} account actions`, exact: true })
    .getByRole('button', { name: `Edit ${name}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Edit teammate' });
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[aria-current="step"]')).toContainText('Roles & access');
  return dialog;
}

/** The "What they can do" tick group under one module. */
export const ticks = (dialog, label) =>
  dialog.getByRole('group', { name: `${label}: What they can do`, exact: true });

export const moduleBox = (dialog, label) =>
  dialog.getByRole('group', { name: 'CRM access' }).getByRole('checkbox', {
    name: new RegExp(`^${label}`),
  });

export const LABELS = {
  rel: 'Clients, leads and contacts',
  prop: 'Properties',
  sched: 'Scheduling',
};
