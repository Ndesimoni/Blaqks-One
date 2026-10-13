import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';
import { MESSAGES, actions, grant, preset } from './permission-helpers.mjs';

let owner, admin;
before(async () => {
  query('TRUNCATE crm_login_limits');
  owner = await login('owner');
  admin = await activate(
    await invite(owner, 'perm-team-admin', { accountRole: 'admin', positions: [] }),
  );
});

const inviteBody = (suffix, extra) => ({
  name: `Synthetic ${suffix}`,
  email: `${suffix}@team-fixture.test`,
  phone: '+971501234567',
  positions: ['property-agent'],
  ...extra,
});
const sendInvite = (session, body) =>
  session.request(`${teamPath(session)}/invitations`, { method: 'POST', body });
const stored = (id) => JSON.parse(query(`SELECT actions FROM crm_users WHERE id='${id}'`));

test('profiles and positions carry actions; Admins hold everything by role', async () => {
  assert.deepEqual(admin.user.actions, actions());
  assert.ok(Object.values(admin.user.recordActions).every((a) => a.create && a.delete));
  assert.deepEqual(stored(admin.user.id), {});
  const team = await admin.request(teamPath(admin));
  const agent = team.value.roles.find((role) => role.id === 'property-agent');
  assert.deepEqual(agent.actions, preset());
  const accountant = team.value.roles.find((role) => role.id === 'accountant');
  assert.deepEqual(accountant.actions, actions(false));
});

test('invitations default to presets, accept the omitted-deleteMain shape and refuse deleteMain', async () => {
  const defaulted = await invite(admin, 'perm-default', { positions: ['receptionist'] });
  const expected = actions(false, {
    relationships: { create: true, edit: true, assign: true },
    schedule: { create: true, edit: true, assign: true, deleteActivity: true },
  });
  assert.deepEqual(defaulted.member.actions, expected);
  assert.deepEqual(stored(defaulted.member.id), expected);
  const shaped = {
    relationships: { create: true, edit: false, assign: true },
    properties: { create: true, edit: true, assign: false, deleteActivity: true },
    schedule: { create: false, edit: false, assign: false, deleteActivity: false },
  };
  const custom = await sendInvite(admin, inviteBody('perm-shape', { actions: shaped }));
  assert.equal(custom.status, 201, JSON.stringify(custom.value));
  const want = structuredClone(shaped);
  want.relationships.deleteMain = false;
  want.properties.deleteMain = false;
  assert.deepEqual(stored(custom.value.member.id), want);
  const refusals = [
    [{ ...shaped, properties: { ...shaped.properties, deleteMain: true } }, MESSAGES.teamOnly],
    [{ ...shaped, schedule: { ...shaped.schedule, deleteMain: false } }, null],
    [{ ...shaped, finance: {} }, null],
    [{ ...shaped, schedule: { create: 'yes' } }, null],
  ];
  for (const [value, message] of refusals) {
    const result = await sendInvite(admin, inviteBody('perm-refused', { actions: value }));
    assert.equal(result.status, 400, JSON.stringify(value));
    assert.equal(result.value.message, message ?? 'Provide valid invitation details.');
  }
  const adminInvite = await sendInvite(
    owner,
    inviteBody('perm-admin-actions', { accountRole: 'admin', positions: [], actions: shaped }),
  );
  assert.equal(adminInvite.status, 400);
  assert.equal(adminInvite.value.message, MESSAGES.staffOnly);
});

test('member PATCH validates actions strictly and enforces the deleteMain scope rule', async () => {
  const staff = await activate(await invite(admin, 'perm-patch'));
  const member = await findMember(admin, staff.user.id);
  const patch = (changes, target = member, session = admin) =>
    session.request(teamPath(session, target.id), {
      method: 'PATCH',
      body: memberUpdate(target, changes),
    });
  const incomplete = { ...preset(), schedule: { create: true } };
  for (const value of [incomplete, { ...preset(), extra: {} }, 'all', [true]]) {
    const result = await patch({ actions: value });
    assert.equal(result.status, 400, JSON.stringify(value));
    assert.equal(result.value.message, 'Provide valid team member changes.');
  }
  const refused = await patch({ actions: actions() });
  assert.equal(refused.status, 400);
  assert.equal(refused.value.message, MESSAGES.teamOnly);
  const granted = await patch({ actions: actions(), recordScope: 'team' });
  assert.equal(granted.status, 200, JSON.stringify(granted.value));
  assert.equal(granted.value.member.actions.relationships.deleteMain, true);
  assert.equal((await patch({ actions: preset() })).status, 409);
  const adminMember = await findMember(owner, admin.user.id);
  const adminPatch = await patch({ actions: preset() }, adminMember, owner);
  assert.equal(adminPatch.status, 400);
  assert.equal(adminPatch.value.message, MESSAGES.staffOnly);
  const renamed = await patch({ name: 'Renamed admin' }, adminMember, owner);
  assert.equal(renamed.status, 200);
  assert.deepEqual(stored(admin.user.id), {});
  admin = await staffLogin(admin.user.email); // the Admin edit revoked their sessions
});

test('M-D: a view-only member stays view-only when positions change', async () => {
  const staff = await activate(await invite(admin, 'perm-viewer', { positions: ['receptionist'] }));
  const viewer = await grant(admin, staff, { actions: actions(false) });
  assert.equal(viewer.user.recordActions.Clients.create, false);
  const moved = await grant(admin, viewer, {
    positions: ['property-agent'],
    permissions: undefined,
  });
  const want = actions(false, {
    properties: { create: true, edit: true, assign: true, deleteActivity: true },
  });
  assert.deepEqual(moved.user.actions, want);
  const reset = await grant(admin, moved, { actions: preset() });
  assert.deepEqual(reset.user.actions, preset());
});
