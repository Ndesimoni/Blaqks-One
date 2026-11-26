// BO1b delegated areas (docs/blaqks-one-console.md §8): managing companies and inviting
// Admins work for the staff who hold them, re-checked live, and for no one else.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { ORGANISATION, TEAM, teamMember } from './platform-team-helpers.mjs';

let owner, admin, agent;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-delegation'));
  agent = await activate(await invite(admin, 'platform-delegation-agent'));
});

const organisation = `/workspaces/${ORGANISATION}/team`;

test('managing companies suspends and archives their people and changes seats', async () => {
  const controls = await teamMember(owner, 'platform-delegation-controls', 'custom', {
    companies: 'manage',
  });
  const path = `/platform/companies/${admin.user.workspaceId}/members`;
  const people = Object.fromEntries(
    (await controls.request(path)).value.members.map((row) => [row.id, row]),
  );
  const active = (id, version, value) =>
    controls.request(`${path}/${id}/active`, { method: 'PUT', body: { version, active: value } });
  const off = await active(agent.user.id, people[agent.user.id].version, false);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal((await agent.request('/auth/session')).status, 401);
  const on = await active(agent.user.id, off.value.member.version, true);
  assert.equal(on.status, 200, JSON.stringify(on.value));
  const company = (await controls.request('/platform/companies')).value.companies.find(
    (row) => row.id === admin.user.workspaceId,
  );
  const seats = await controls.request(`/workspaces/${admin.user.workspaceId}/company/seat-limit`, {
    method: 'PUT',
    body: { memberLimit: company.seatLimit + 1, version: company.version },
  });
  assert.equal(seats.status, 200, JSON.stringify(seats.value));
  const review = await archiveReview(controls, admin, { id: agent.user.id });
  assert.equal((await archive(controls, admin, review)).status, 200);
  assert.equal(
    (await controls.request(organisation)).status,
    403,
    'Admin invitations are another area',
  );
  const admins = await active(admin.user.id, people[admin.user.id].version, false);
  assert.equal(admins.status, 200, JSON.stringify(admins.value));
  assert.equal((await admin.request('/auth/session')).status, 401);
  const back = await active(admin.user.id, admins.value.member.version, true);
  assert.equal(back.status, 200, JSON.stringify(back.value));
});

test('Admin invitations: invite, renew and cancel, never suspend', async () => {
  const inviter = await teamMember(owner, 'platform-delegation-inviter', 'custom', {
    invite_admins: 'manage',
  });
  const listed = await inviter.request(organisation);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  const body = (suffix, accountRole) => ({
    name: `Synthetic ${suffix}`,
    email: `${suffix}@platform-team.test`,
    phone: '+971501234567',
    positions: [],
    accountRole,
  });
  const sent = await inviter.request(`${organisation}/invitations`, {
    method: 'POST',
    body: body('platform-delegation-new-admin', 'admin'),
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  const id = sent.value.member.id;
  assert.equal(
    query(`SELECT created_by FROM crm_team_invitations WHERE user_id='${id}'`),
    inviter.user.id,
    'the invitation names who sent it',
  );
  const staff = await inviter.request(`${organisation}/invitations`, {
    method: 'POST',
    body: body('platform-delegation-org-staff', 'staff'),
  });
  assert.equal(staff.status, 403, 'the organisation has no staff');
  const renewed = await inviter.request(`${organisation}/${id}/invitations`, {
    method: 'POST',
    body: { version: sent.value.member.version },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  const renamed = await inviter.request(`${organisation}/${id}`, {
    method: 'PATCH',
    body: { version: renewed.value.member.version, name: 'Synthetic Renamed' },
  });
  assert.equal(renamed.status, 403, 'only cancelling a pending invitation');
  const cancelled = await inviter.request(`${organisation}/${id}`, {
    method: 'PATCH',
    body: { version: renewed.value.member.version, active: false },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.value));
  const accepted = (await inviter.request(organisation)).value.members.find(
    (row) => row.id === admin.user.id,
  );
  const suspend = await inviter.request(`${organisation}/${admin.user.id}`, {
    method: 'PATCH',
    body: { version: accepted.version, active: false },
  });
  assert.equal(suspend.status, 403, 'suspending an Admin is a company control');
  assert.equal(query(`SELECT active FROM crm_users WHERE id='${admin.user.id}'`), 't');
});

test('a removed area is refused on the next request, mid-session', async () => {
  const member = await teamMember(owner, 'platform-delegation-removed', 'custom', {
    invite_admins: 'manage',
    dashboard: 'view',
  });
  assert.equal((await member.request(organisation)).status, 200);
  const row = (await owner.request(TEAM)).value.members.find((m) => m.id === member.user.id);
  const edit = await owner.request(`${TEAM}/${member.user.id}`, {
    method: 'PATCH',
    body: { version: row.version, preset: 'analyst', access: { dashboard: 'view' } },
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.value));
  assert.equal((await member.request(organisation)).status, 403);
  const sent = await member.request(`${organisation}/invitations`, {
    method: 'POST',
    body: {
      name: 'Synthetic Late Admin',
      email: 'platform-delegation-late@platform-team.test',
      phone: '+971501234567',
      positions: [],
      accountRole: 'admin',
    },
  });
  assert.equal(sent.status, 403);
});
