// BO1b controls (docs/blaqks-one-console.md §8): the Owner suspends, reactivates, renews and
// archives platform staff; nobody edits the Owner; company forms never offer the role.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, staffLogin, teamPath } from './team-helpers.mjs';
import { ORGANISATION, TEAM, inviteTeam, teamMember } from './platform-team-helpers.mjs';

let owner, admin;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-controls'));
});

const row = async (id) => (await owner.request(TEAM)).value.members.find((m) => m.id === id);
const setActive = (id, version, active) =>
  owner.request(`${TEAM}/${id}/active`, { method: 'PUT', body: { version, active } });

test('suspending a member signs them out until the Owner reactivates them', async () => {
  const member = await teamMember(owner, 'platform-controls-suspend', 'analyst');
  const before = await row(member.user.id);
  const off = await setActive(member.user.id, before.version, false);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(off.value.member.status, 'suspended');
  assert.equal((await member.request('/auth/session')).status, 401);
  const signIn = await request('/auth/login', {
    method: 'POST',
    body: { email: member.user.email, password: 'Team123!' },
  });
  assert.equal(signIn.status, 401);
  assert.equal((await setActive(member.user.id, before.version, true)).status, 409, 'stale');
  const on = await setActive(member.user.id, off.value.member.version, true);
  assert.equal(on.status, 200, JSON.stringify(on.value));
  assert.equal(on.value.member.status, 'active');
  assert.equal(
    (await (await staffLogin(member.user.email)).request('/platform/metrics')).status,
    200,
  );
});

test('a pending invitation is cancelled, then sent again with a new link', async () => {
  const invited = await inviteTeam(owner, 'platform-controls-pending', 'analyst');
  const { id, version } = invited.member;
  assert.equal((await setActive(id, version, true)).status, 409, 'activation needs the link');
  const cancelled = await setActive(id, version, false);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.value));
  const inspect = (token) =>
    request('/auth/invitations/inspect', { method: 'POST', body: { token } });
  assert.equal((await inspect(invited.invitation.token)).status, 400);
  const renewed = await owner.request(`${TEAM}/${id}/invitation`, {
    method: 'POST',
    body: { version: cancelled.value.member.version },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.member.status, 'pending');
  const member = await activate({ ...renewed.value, email: invited.email });
  assert.deepEqual(member.user.platformAccess, { dashboard: 'view' });
  const again = await owner.request(`${TEAM}/${id}/invitation`, {
    method: 'POST',
    body: { version: (await row(id)).version },
  });
  assert.equal(again.status, 409, 'an activated account uses account recovery');
});

test('archiving a member needs their email and ends their sessions for good', async () => {
  const member = await teamMember(owner, 'platform-controls-archive', 'support');
  const { version } = await row(member.user.id);
  const archive = (confirmationEmail, at = version) =>
    owner.request(`${TEAM}/${member.user.id}`, {
      method: 'DELETE',
      body: { version: at, confirmationEmail },
    });
  assert.equal((await archive('someone@platform-team.test')).status, 400);
  const done = await archive(member.user.email);
  assert.equal(done.status, 200, JSON.stringify(done.value));
  assert.equal(done.value.member.status, 'archived');
  assert.equal((await member.request('/auth/session')).status, 401);
  const edit = await owner.request(`${TEAM}/${member.user.id}`, {
    method: 'PATCH',
    body: { version: done.value.member.version, preset: 'analyst', access: { dashboard: 'view' } },
  });
  assert.equal(edit.status, 403, 'an archive is never edited or restored');
  assert.equal((await setActive(member.user.id, done.value.member.version, true)).status, 403);
});

test('nobody edits, suspends or archives the Owner', async () => {
  const id = owner.user.id;
  for (const [method, path, body] of [
    ['PATCH', `${TEAM}/${id}`, { version: 1, preset: 'analyst', access: { dashboard: 'view' } }],
    ['PUT', `${TEAM}/${id}/active`, { version: 1, active: false }],
    ['DELETE', `${TEAM}/${id}`, { version: 1, confirmationEmail: owner.user.email }],
  ]) {
    assert.equal((await owner.request(path, { method, body })).status, 403, `${method} ${path}`);
  }
  assert.equal(query(`SELECT active FROM crm_users WHERE id='${id}'`), 't');
});

test('company invitation forms never create a platform account', async () => {
  const body = (suffix) => ({
    name: 'Synthetic Forged Platform',
    email: `platform-controls-${suffix}@platform-team.test`,
    phone: '+971501234567',
    positions: [],
    accountRole: 'platform',
  });
  const company = await admin.request(`${teamPath(admin)}/invitations`, {
    method: 'POST',
    body: body('company'),
  });
  assert.equal(company.status, 403);
  const organisation = await owner.request(`/workspaces/${ORGANISATION}/team/invitations`, {
    method: 'POST',
    body: body('organisation'),
  });
  assert.equal(organisation.status, 403, 'only the Blaqks One team page invites platform staff');
  assert.equal(
    query(`SELECT count(*) FROM crm_users WHERE email LIKE 'platform-controls-%company%'
      OR email LIKE 'platform-controls-organisation%'`),
    '0',
  );
});
