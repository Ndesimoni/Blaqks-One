import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord, validateRecord } from '../../src/features/records/validation.js';
import { canDeleteRecord, serverIdPolicy } from '../../src/features/server/access.js';
import { blankMember, memberPayload } from '../../src/features/server-team/model.js';
import { createCrmClient } from '../../src/services/crm/client.js';

const recordingClient = (calls) =>
  createCrmClient(async (url, options) => {
    calls.push({ url, options, body: options.body && JSON.parse(options.body) });
    return {
      status: 200,
      ok: true,
      json: async () =>
        url.endsWith('/auth/session') ? { user: { id: 'owner' }, csrfToken: 'csrf' } : {},
    };
  });

test('connected creates may leave the ID blank, while the demo still requires one', async () => {
  assert.ok(validateRecord('Clients', { client_id: '' }).client_id);
  assert.ok(validateRecord('Clients', { client_id: ' ' }, [], null, undefined, {}).client_id);
  assert.deepEqual(
    validateRecord('Clients', { client_id: '' }, [], null, undefined, { idOptional: true }),
    {},
  );
  const typed = validateRecord(
    'Clients',
    { client_id: 'CL-1' },
    [{ client_id: 'CL-1' }],
    null,
    {},
    {
      idOptional: true,
    },
  );
  assert.ok(typed.client_id, 'a typed team-scope ID is still checked for duplicates');
  const calls = [];
  const api = recordingClient(calls);
  await api.session();
  await api.save('own', 'Clients', normalizeRecord('Clients', { client_id: '', full_name: 'A' }));
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(calls[1].body, { record: { client_id: '', full_name: 'A' } });
});

test('ID policy and delete visibility follow the server scope', () => {
  assert.deepEqual(serverIdPolicy('assigned', null), { issued: true, readOnly: true });
  assert.deepEqual(serverIdPolicy('team', null), { issued: true, readOnly: false });
  assert.deepEqual(serverIdPolicy('assigned', { client_id: 'CL-1' }), {
    issued: false,
    readOnly: true,
  });
  assert.deepEqual(serverIdPolicy('team', { client_id: 'CL-1' }), {
    issued: false,
    readOnly: false,
  });
  for (const module of ['Clients', 'Properties', 'Contacts']) {
    assert.equal(canDeleteRecord('assigned', module), false);
    assert.equal(canDeleteRecord(null, module), false);
    assert.equal(canDeleteRecord('team', module), true);
  }
  assert.equal(canDeleteRecord('assigned', 'Follow-ups'), true);
  assert.equal(canDeleteRecord('assigned', 'Viewings'), true);
});

test('assignment routes are scoped, carry CSRF and trim optional notes', async () => {
  const calls = [];
  const api = recordingClient(calls);
  await api.session();
  await api.assignees('owner/a', 'Follow-ups');
  await api.assign('owner/a', 'Clients', { id: 'uuid/1', version: 4 }, 'member-b', '  call  ');
  await api.assign('owner/a', 'Clients', { id: 'uuid-1', version: 5 }, null, '   ');
  await api.bulkAssign('owner/a', 'member-c', [
    { collection: 'Clients', id: 'uuid-1', version: 6, record: { secret: true } },
  ]);
  await api.assignmentHistory('owner/a', 'Properties', 'uuid-p');
  const [, assignees, assign, queue, bulk, history] = calls;
  assert.equal(assignees.url, '/api/crm/workspaces/owner%2Fa/assignees?collection=Follow-ups');
  assert.equal(assignees.options.headers['X-CSRF-Token'], undefined);
  assert.equal(assign.url, '/api/crm/workspaces/owner%2Fa/records/Clients/uuid%2F1/assignee');
  assert.equal(assign.options.method, 'PUT');
  assert.equal(assign.options.headers['X-CSRF-Token'], 'csrf');
  assert.deepEqual(assign.body, { version: 4, assigneeId: 'member-b', note: 'call' });
  assert.deepEqual(queue.body, { version: 5, assigneeId: null });
  assert.equal(bulk.url, '/api/crm/workspaces/owner%2Fa/assignments/bulk');
  assert.equal(bulk.options.headers['X-CSRF-Token'], 'csrf');
  assert.deepEqual(bulk.body, {
    toId: 'member-c',
    records: [{ collection: 'Clients', id: 'uuid-1', version: 6 }],
  });
  assert.equal(history.url, '/api/crm/workspaces/owner%2Fa/records/Properties/uuid-p/assignments');
});

test('record visibility is sent only on staff member updates, never on invitations', () => {
  const staff = { name: 'Agent', email: 'a@fixture.test', phone: '+971501234567', version: 2 };
  const form = blankMember({ ...staff, roleId: 'staff', recordScope: 'team' });
  assert.equal(form.recordScope, 'team');
  assert.equal(blankMember().recordScope, 'assigned');
  assert.equal(memberPayload(form, { ...staff, roleId: 'staff' }).recordScope, 'team');
  const reduced = memberPayload(
    { ...form, recordScope: 'assigned' },
    { ...staff, roleId: 'staff' },
  );
  assert.equal(reduced.recordScope, 'assigned');
  assert.equal('recordScope' in memberPayload(form), false);
  assert.equal('recordScope' in memberPayload({ ...form, accountRole: 'admin' }), false);
  const admin = blankMember({ ...staff, roleId: 'admin', recordScope: 'team' });
  assert.equal('recordScope' in memberPayload(admin, { ...staff, roleId: 'admin' }), false);
});
