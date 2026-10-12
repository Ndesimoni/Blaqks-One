import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageTeam, canOpenSection } from '../../src/features/server/access.js';
import { blankMember, memberPayload } from '../../src/features/server-team/model.js';
import { createCrmClient } from '../../src/services/crm/client.js';

test('team authority uses account roles and CRM sections require explicit grants', () => {
  assert.equal(canManageTeam({ roleId: 'admin', managesTeam: true }), true);
  assert.equal(canManageTeam({ roleId: 'staff', managesTeam: true }), false);
  assert.equal(canManageTeam({ role: 'Super Admin' }), false);
  const staff = { roleId: 'staff', permissions: { properties: true } };
  assert.equal(canOpenSection(staff, 'Clients'), false);
  assert.equal(canOpenSection(staff, 'Properties'), true);
  assert.equal(canOpenSection(staff, 'Team & access'), false);
  assert.equal(canOpenSection(staff, 'Finance'), false);
});

test('team form payloads exclude privileged profile and password fields, and email is immutable on edits', () => {
  const member = {
    name: ' Colleague ',
    email: 'colleague@fixture.test',
    phone: '+971501234567',
    roleId: 'staff',
    positions: ['receptionist'],
    version: 3,
  };
  const form = {
    ...blankMember(member),
    password: 'never-send',
    roleId: 'super-admin',
    ownerId: 'forged',
  };
  const body = memberPayload(form, member);
  assert.equal(body.name, 'Colleague');
  assert.equal(body.version, 3);
  for (const key of ['password', 'roleId', 'ownerId', 'email', 'accountRole']) {
    assert.equal(body[key], undefined);
  }
  assert.equal(memberPayload(form).accountRole, 'staff');
});

test('team mutations use scoped paths and session CSRF while invitation secrets stay in POST bodies', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    return {
      status: 200,
      ok: true,
      json: async () =>
        url.endsWith('/auth/session') ? { user: { id: 'owner' }, csrfToken: 'csrf' } : {},
    };
  });
  await api.session();
  await api.team('owner/a');
  await api.invite('owner/a', { positions: ['receptionist'] });
  await api.updateMember('owner/a', 'staff/b', { version: 1 });
  await api.renewInvitation('owner/a', 'staff/b', 2);
  await api.inspectInvitation('private-token');
  await api.acceptInvitation('private-token', 'Team123!');
  assert.equal(calls[1].url, '/api/crm/workspaces/owner%2Fa/team');
  assert.equal(calls[3].url, '/api/crm/workspaces/owner%2Fa/team/staff%2Fb');
  assert.equal(calls[3].options.method, 'PATCH');
  assert.equal(calls[4].url, '/api/crm/workspaces/owner%2Fa/team/staff%2Fb/invitations');
  for (const call of calls.slice(2)) {
    assert.equal(call.options.headers['X-CSRF-Token'], 'csrf');
    assert.equal(call.options.credentials, 'include');
  }
  for (const call of calls.slice(5)) {
    assert.ok(!call.url.includes('private-token'));
    assert.equal(JSON.parse(call.options.body).token, 'private-token');
    assert.equal(call.options.method, 'POST');
  }
});
