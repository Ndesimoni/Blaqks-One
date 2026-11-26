// BO1b Blaqks One team (docs/blaqks-one-console.md §8): the Owner invites a Support member
// through the invitation flow; Support reaches its areas and never company data.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, staffLogin } from './team-helpers.mjs';
import {
  AREA_LEVELS,
  EVERYTHING,
  ORGANISATION,
  PRESETS,
  TEAM,
  expectNoTeam,
  inviteTeam,
  teamRow,
} from './platform-team-helpers.mjs';
import { expectAccess } from './platform-team-routes.mjs';

let owner, admin, support, invited;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-team'));
});

test('the Owner invites a Support member who activates by the link and signs in', async () => {
  invited = await inviteTeam(owner, 'platform-team-support');
  assert.deepEqual(Object.keys(invited.member).sort(), [
    'access',
    'email',
    'id',
    'lastActiveAt',
    'name',
    'phone',
    'preset',
    'status',
    'version',
  ]);
  assert.equal(invited.member.status, 'pending');
  assert.equal(invited.member.preset, 'support');
  assert.deepEqual(invited.member.access, PRESETS.support);
  assert.equal(invited.invitation.token.length, 43);
  assert.match(invited.invitation.expiresAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  const stored = `SELECT role||'|'||workspace_id||'|'||active FROM crm_users WHERE id='${invited.member.id}'`;
  assert.equal(query(stored), `platform|${ORGANISATION}|false`);
  const inspected = await request('/auth/invitations/inspect', {
    method: 'POST',
    body: { token: invited.invitation.token },
  });
  assert.equal(inspected.status, 200, JSON.stringify(inspected.value));
  assert.equal(inspected.value.invitation.roleId, 'platform');
  support = await activate(invited);
  const { user } = support;
  assert.equal(user.role, 'Blaqks One · Support');
  assert.equal(user.roleId, 'platform');
  assert.equal(user.workspaceId, ORGANISATION);
  assert.equal(user.managesTeam, false);
  assert.deepEqual(user.platformAccess, PRESETS.support);
  assert.equal(user.financeAccess.scope, 'none');
  assert.ok(Object.values(user.permissions).every((grant) => grant === false));
  assert.deepEqual((await staffLogin(invited.email)).user.platformAccess, PRESETS.support);
  const session = await support.request('/auth/session');
  assert.deepEqual(session.value.user.platformAccess, PRESETS.support);
});

test('the profile carries everything for the Owner and nothing for company members', async () => {
  assert.deepEqual(owner.user.platformAccess, EVERYTHING);
  assert.equal(owner.user.role, 'Blaqks One');
  assert.deepEqual(admin.user.platformAccess, {});
  const account = await support.request('/auth/account');
  assert.equal(account.status, 200, JSON.stringify(account.value));
  assert.deepEqual(account.value.user.platformAccess, PRESETS.support);
});

test('the Owner lists the team with the area table and positions', async () => {
  const listed = await owner.request(TEAM);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  assert.deepEqual(listed.value.areas, AREA_LEVELS);
  assert.deepEqual(listed.value.presets, PRESETS);
  const row = await teamRow(owner, invited.member.id);
  assert.equal(row.status, 'active');
  assert.match(row.lastActiveAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(
    listed.value.members.some((member) => member.id === owner.user.id),
    false,
    'the Owner is not a team member to edit',
  );
  assert.doesNotMatch(JSON.stringify(listed.value), /password|csrf|token|device/i);
  const organisation = await owner.request(`/workspaces/${ORGANISATION}/team`);
  assert.equal(
    organisation.value.members.some((member) => member.id === invited.member.id),
    false,
    'platform staff are not company Admins',
  );
});

test('Support views the companies and their people, and nothing else', async () => {
  await expectAccess(support, admin, PRESETS.support);
  const members = await support.request(`/platform/companies/${admin.user.workspaceId}/members`);
  assert.equal(members.status, 200);
  assert.ok(members.value.members.some((member) => member.id === admin.user.id));
  const invite = await support.request(`/workspaces/${ORGANISATION}/team/invitations`, {
    method: 'POST',
    body: {
      name: 'Synthetic Forged Admin',
      email: 'platform-team-forged-admin@platform-team.test',
      phone: '+971501234567',
      accountRole: 'admin',
      positions: [],
    },
  });
  assert.equal(invite.status, 403, 'no Admin invitations without the area');
});

test('platform staff never manage the Blaqks One team, themselves included', async () => {
  await expectNoTeam(support, support.user.id);
  await expectNoTeam(admin, support.user.id);
});
