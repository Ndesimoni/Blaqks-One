import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, request } from './helpers.mjs';
import { activate, invite, teamPath } from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('staff share their owner workspace without exposing other Admin teams or collections', async () => {
  const adminA = await login();
  const adminB = await login('admin-b');
  const owner = await login('owner');
  const catalogue = await adminA.request(teamPath(adminA));
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.value.roles.length, 8);
  assert.ok(!catalogue.value.roles.some((role) => ['admin', 'super-admin'].includes(role.id)));
  const invited = await invite(adminA, 'workspace-staff', {
    positions: ['receptionist', 'lead-manager'],
  });
  const staff = await activate(invited);
  assert.equal(staff.user.roleId, 'staff');
  assert.equal(staff.user.managesTeam, false);
  assert.equal(staff.user.workspaceId, adminA.user.id);
  assert.equal(staff.user.ownerId, adminA.user.id);
  assert.deepEqual(staff.user.positions, ['receptionist', 'lead-manager']);
  const directory = await staff.request('/workspaces');
  assert.deepEqual(
    directory.value.workspaces.map((item) => item.id),
    [adminA.user.id],
  );
  assert.equal(query(`SELECT COUNT(*) FROM crm_workspaces WHERE id='${staff.user.id}'`), '0');
  const client = await create(adminA, 'Clients', { client_id: 'TEAM-SHARED-CLIENT' });
  const property = await create(adminA, 'Properties', { property_id: 'TEAM-HIDDEN-PROPERTY' });
  // Assigned-only staff see the clients they hold (assignments contract §3).
  query(`UPDATE crm_records SET assignee_id='${staff.user.id}' WHERE id='${client.id}'`);
  const records = await staff.request(`/workspaces/${staff.user.workspaceId}/records`);
  assert.equal(records.status, 200);
  assert.ok(records.value.records.Clients.some((item) => item.id === client.id));
  assert.deepEqual(records.value.records.Properties, []);
  assert.equal((await owner.request(`/workspaces/${adminA.user.id}/records`)).status, 200);
  assert.equal((await adminB.request(teamPath(adminA))).status, 403);
  assert.equal((await staff.request(teamPath(adminA))).status, 403);
  assert.equal((await staff.request(`/workspaces/${adminB.user.id}/records`)).status, 403);
  assert.equal((await staff.request(`/workspaces/${adminA.user.id}/activity`)).status, 403);
  assert.equal(
    (
      await staff.request(`/workspaces/${adminA.user.id}/records/Properties/${property.id}`, {
        method: 'DELETE',
        body: { version: property.version },
      })
    ).status,
    403,
  );
  const created = await staff.request(`/workspaces/${adminA.user.id}/records/Clients`, {
    method: 'POST',
    body: { record: { full_name: 'TEAM-STAFF-AUTHOR' } },
  });
  assert.equal(created.status, 201);
  assert.equal(created.value.assignee, staff.user.id);
  const activity = query(
    `SELECT actor_id::text || ':' || workspace_id FROM crm_activity WHERE record_id='${created.value.id}'`,
  );
  assert.equal(activity, `${staff.user.id}:${adminA.user.id}`);
});

test('team mutations reject cross-owner access, staff invitations and role escalation', async () => {
  const adminA = await login();
  const adminB = await login('admin-b');
  const invited = await invite(adminA, 'escalation-staff');
  const staff = await activate(invited);
  const body = {
    name: 'Forbidden member',
    email: 'forbidden@team-fixture.test',
    phone: '+971501234567',
    positions: ['receptionist'],
  };
  for (const actor of [adminB, staff]) {
    assert.equal(
      (
        await actor.request(`${teamPath(adminA)}/invitations`, {
          method: 'POST',
          body,
        })
      ).status,
      403,
    );
  }
  for (const extra of [
    { role: 'super-admin' },
    { ownerId: adminB.user.id },
    { roleId: 'super-admin' },
    { positions: ['super-admin'] },
  ]) {
    const result = await adminA.request(`${teamPath(adminA)}/invitations`, {
      method: 'POST',
      body: { ...body, ...extra },
    });
    assert.ok([400, 403].includes(result.status), JSON.stringify(result.value));
  }
  assert.equal(
    (
      await adminA.request(`${teamPath(adminA)}/invitations`, {
        method: 'POST',
        body: { ...body, accountRole: 'admin', positions: [] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await adminA.request(`${teamPath(adminA)}/invitations`, {
        method: 'POST',
        body,
        csrf: undefined,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await staff.request(`/workspaces/${adminA.user.id}/imports/preview`, {
        method: 'POST',
        body: { sourceWorkspaceId: 'source', records: {} },
      })
    ).status,
    403,
  );
  assert.equal((await request(teamPath(adminA))).status, 401);
});
