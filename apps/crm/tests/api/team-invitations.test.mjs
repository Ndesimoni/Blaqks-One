import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, origin, query, request } from './helpers.mjs';
import { activate, invite, teamPath } from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('invitation activation requires a valid one-use token, trusted origin and eight-character password', async () => {
  const owner = await login();
  const invited = await invite(owner, 'activation-boundary');
  const token = invited.invitation.token;
  const inspect = await request('/auth/invitations/inspect', {
    method: 'POST',
    body: { token },
  });
  assert.equal(inspect.status, 200);
  assert.equal(inspect.value.invitation.email, invited.email);
  assert.equal(inspect.value.invitation.roleId, 'staff');
  assert.equal(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token, password: '1234567' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token, password: 'Team123!' },
        headers: { Origin: `${origin}/invalid` },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token, password: 'Team123!', role: 'super-admin' },
      })
    ).status,
    400,
  );
  const staff = await activate(invited);
  assert.equal(staff.user.roleId, 'staff');
  const replay = await request('/auth/invitations/accept', {
    method: 'POST',
    body: { token, password: 'Another8' },
  });
  assert.ok([400, 404, 409, 410].includes(replay.status));
  const used = await request('/auth/invitations/inspect', { method: 'POST', body: { token } });
  assert.ok([400, 404, 409, 410].includes(used.status));
  const bad = await request('/auth/invitations/inspect', {
    method: 'POST',
    body: { token: 'x'.repeat(43) },
  });
  assert.ok([400, 404, 409, 410].includes(bad.status));
});

test('concurrent activation creates one active account and cannot replace its chosen password', async () => {
  const owner = await login();
  const invited = await invite(owner, 'concurrent-activation');
  const body = { token: invited.invitation.token, password: 'Team123!' };
  const results = await Promise.all([
    request('/auth/invitations/accept', { method: 'POST', body }),
    request('/auth/invitations/accept', { method: 'POST', body }),
  ]);
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(results.filter((result) => [400, 404, 409, 410].includes(result.status)).length, 1);
  const members = await owner.request(teamPath(owner));
  assert.equal(members.value.members.filter((member) => member.id === invited.member.id).length, 1);
});

test('Super Admin can invite an Admin with a separate workspace and that Admin can invite only staff', async () => {
  const superAdmin = await login('owner');
  const invited = await invite(superAdmin, 'new-team-admin', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invited);
  assert.equal(admin.user.roleId, 'admin');
  assert.equal(admin.user.managesTeam, true);
  assert.equal(admin.user.workspaceId, admin.user.id);
  const colleague = await invite(admin, 'new-admin-colleague', {
    positions: ['listing-coordinator'],
  });
  const staff = await activate(colleague);
  assert.equal(staff.user.workspaceId, admin.user.id);
  assert.equal(staff.user.permissions.properties, true);
  const catalog = await superAdmin.request(`/workspaces/${admin.user.id}/team`);
  assert.equal(catalog.status, 200);
  assert.ok(catalog.value.members.some((member) => member.id === staff.user.id));
  const all = await superAdmin.request('/workspaces');
  assert.ok(all.value.workspaces.some((workspace) => workspace.id === admin.user.id));
  assert.ok(!all.value.workspaces.some((workspace) => workspace.id === staff.user.id));
});
