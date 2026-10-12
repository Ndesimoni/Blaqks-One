import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, recordsPath } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const storedScope = (id) => query(`SELECT record_scope FROM crm_users WHERE id='${id}'`);

test('profiles and sessions report record scope, with team scope for Admins', async () => {
  for (const kind of ['owner', 'admin-a']) {
    const session = await login(kind);
    assert.equal(session.user.recordScope, 'team', kind);
    const current = await session.request('/auth/session');
    assert.equal(current.status, 200);
    assert.equal(current.value.user.recordScope, 'team');
  }
});

test('Admins grant and remove full-team access for staff only', async () => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'scope-staff');
  const staff = await activate(invited);
  assert.equal(staff.user.recordScope, 'assigned');
  const member = await findMember(admin, staff.user.id);
  assert.equal(member.recordScope, 'assigned');
  const path = teamPath(admin, member.id);
  const grant = memberUpdate(member, { recordScope: 'team' });
  const unprotected = await admin.request(path, { method: 'PATCH', body: grant, csrf: undefined });
  assert.equal(unprotected.status, 403);
  const self = await staff.request(path, { method: 'PATCH', body: grant });
  assert.equal(self.status, 403);
  assert.equal(self.value.code, 'forbidden');
  for (const recordScope of ['everyone', 'Team', true]) {
    const invalid = await admin.request(path, {
      method: 'PATCH',
      body: memberUpdate(member, { recordScope }),
    });
    assert.equal(invalid.status, 400, String(recordScope));
  }
  assert.equal(storedScope(member.id), 'assigned');
  const granted = await admin.request(path, { method: 'PATCH', body: grant });
  assert.equal(granted.status, 200, JSON.stringify(granted.value));
  assert.equal(granted.value.member.recordScope, 'team');
  const listed = await findMember(admin, member.id);
  assert.equal(listed.recordScope, 'team');
  assert.equal(storedScope(member.id), 'team');
  const refreshed = await staffLogin(invited.email);
  assert.equal(refreshed.user.recordScope, 'team');
  assert.equal((await refreshed.request('/auth/session')).value.user.recordScope, 'team');

  const repositioned = await admin.request(path, {
    method: 'PATCH',
    body: memberUpdate(listed, { positions: ['property-agent'], permissions: undefined }),
  });
  assert.equal(repositioned.status, 200, JSON.stringify(repositioned.value));
  assert.equal(repositioned.value.member.recordScope, 'team');
  assert.equal(repositioned.value.member.permissions.properties, true);
  assert.equal((await refreshed.request('/auth/session')).status, 401);

  const removed = await admin.request(path, {
    method: 'PATCH',
    body: memberUpdate(repositioned.value.member, { recordScope: 'assigned' }),
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.value.member.recordScope, 'assigned');
  assert.equal(storedScope(member.id), 'assigned');
});

test('full-team access cannot be set on Admins or through invitations', async () => {
  const owner = await login('owner');
  const invited = await invite(owner, 'scope-admin', { accountRole: 'admin', positions: [] });
  const scopedAdmin = await activate(invited);
  const member = await findMember(owner, scopedAdmin.user.id);
  assert.equal(member.recordScope, 'team');
  for (const recordScope of ['team', 'assigned']) {
    const result = await owner.request(teamPath(owner, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { recordScope }),
    });
    assert.equal(result.status, 400);
    assert.equal(result.value.message, 'Full-team access applies to staff only.');
  }
  assert.equal(storedScope(member.id), 'assigned');
  assert.equal((await scopedAdmin.request('/auth/session')).status, 200);
  const admin = await login('admin-a');
  const refused = await admin.request(`${teamPath(admin)}/invitations`, {
    method: 'POST',
    body: {
      name: 'Synthetic scoped invite',
      email: 'scope-invite@team-fixture.test',
      phone: '+971501234567',
      positions: ['receptionist'],
      recordScope: 'team',
    },
  });
  assert.equal(refused.status, 400);
  assert.equal(
    query(`SELECT count(*) FROM crm_users WHERE email='scope-invite@team-fixture.test'`),
    '0',
  );
});

test('record payloads cannot carry assignment, scope or projection keys', async () => {
  const admin = await login('admin-a');
  const existing = await create(admin, 'Clients', { client_id: 'SCOPE-RESERVED' });
  const reserved = ['assignee', 'assigneeId', 'assignee_id', 'record_scope', 'recordScope'];
  for (const key of [...reserved, 'references', 'taskClients', 'listingViewings']) {
    const record = { client_id: `SCOPE-${key}`, [key]: admin.user.id };
    const created = await admin.request(recordsPath(admin, 'Clients'), {
      method: 'POST',
      body: { record },
    });
    assert.equal(created.status, 400, key);
    assert.equal(created.value.message, 'Server ownership and publication fields cannot be set.');
    const updated = await admin.request(recordsPath(admin, 'Clients', existing.id), {
      method: 'PATCH',
      body: { version: 1, record: { ...existing.record, [key]: null } },
    });
    assert.equal(updated.status, 400, key);
  }
  assert.equal(query(`SELECT assignee_id IS NULL FROM crm_records WHERE id='${existing.id}'`), 't');
});
