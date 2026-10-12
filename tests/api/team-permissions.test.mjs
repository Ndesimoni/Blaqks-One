import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('permission updates affect live access and optimistic versions prevent lost changes', async () => {
  const owner = await login();
  const invited = await invite(owner, 'permission-staff');
  const staff = await activate(invited);
  const member = await findMember(owner, staff.user.id);
  const body = memberUpdate(member, {
    permissions: { ...member.permissions, relationships: false, properties: true },
    channelAccess: { email: true, whatsapp: false },
  });
  const updated = await owner.request(teamPath(owner, member.id), { method: 'PATCH', body });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body,
      })
    ).status,
    409,
  );
  const current = await staff.request('/auth/session');
  assert.ok([200, 401].includes(current.status));
  if (current.status === 200) assert.equal(current.value.user.permissions.relationships, false);
  const refreshed = await staffLogin(invited.email);
  assert.equal(refreshed.user.permissions.relationships, false);
  assert.equal(refreshed.user.permissions.properties, true);
  assert.deepEqual(refreshed.user.channelAccess, { email: true, whatsapp: false });
  const path = `/workspaces/${owner.user.id}/records`;
  const records = await refreshed.request(path);
  assert.deepEqual(records.value.records.Clients, []);
  assert.deepEqual(records.value.records.Contacts, []);
  assert.equal(
    (
      await refreshed.request(`${path}/Clients`, {
        method: 'POST',
        body: { record: { client_id: 'TEAM-REVOKED' } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await refreshed.request(`${path}/Properties`, {
        method: 'POST',
        body: { record: { property_id: 'TEAM-GRANTED' } },
      })
    ).status,
    201,
  );
  const latest = await findMember(owner, member.id);
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: { ...memberUpdate(latest), roleId: 'super-admin' },
      })
    ).status,
    400,
  );
  const another = await login('admin-b');
  assert.equal(
    (
      await another.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: memberUpdate(latest),
      })
    ).status,
    403,
  );
});

test('suspension blocks existing sessions and login, while restoring retains workspace records', async () => {
  const owner = await login();
  const invited = await invite(owner, 'suspension-staff');
  const staff = await activate(invited);
  let member = await findMember(owner, staff.user.id);
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: memberUpdate(member, { active: false }),
      })
    ).status,
    200,
  );
  assert.equal((await staff.request('/auth/session')).status, 401);
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: invited.email, password: 'Team123!' },
      })
    ).status,
    401,
  );
  member = await findMember(owner, staff.user.id);
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: memberUpdate(member, { active: true }),
      })
    ).status,
    200,
  );
  const restored = await staffLogin(invited.email);
  assert.equal(restored.user.workspaceId, owner.user.id);
});

test('an inactive owner disables subordinate login and existing staff sessions', async () => {
  const owner = await login('admin-b');
  const invited = await invite(owner, 'inactive-owner-staff');
  const staff = await activate(invited);
  try {
    query(`UPDATE crm_users SET active=false WHERE id='${owner.user.id}'`);
    assert.equal((await staff.request('/auth/session')).status, 401);
    assert.equal(
      (
        await request('/auth/login', {
          method: 'POST',
          body: { email: invited.email, password: 'Team123!' },
        })
      ).status,
      401,
    );
  } finally {
    query(`UPDATE crm_users SET active=true WHERE id='${owner.user.id}'`);
  }
});
