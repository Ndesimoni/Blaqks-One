import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionCollection,
  actionDeniedMessages,
  canAct,
  deleteRefusal,
  followUpDeleteMessage,
  isViewOnly,
  saveRefusal,
} from '../../src/features/server/access.js';
import { allowAll } from '../../src/features/records/useRecordAccess.js';

const collections = [
  'Clients',
  'Contacts',
  'Properties',
  'Follow-ups',
  'Viewings',
  'Shortlist',
  'Interaction log',
  'Client care',
];
const grant = (create, edit, remove, assign) => ({ create, edit, delete: remove, assign });
const full = Object.fromEntries(collections.map((name) => [name, grant(true, true, true, true)]));
const member = (recordActions, id = 'me') => ({ id, roleId: 'staff', recordActions });

test('canAct reads the session recordActions for every connected collection', () => {
  const user = member(full);
  for (const collection of collections)
    for (const action of ['create', 'edit', 'delete', 'assign'])
      assert.equal(canAct(user, collection, action), true, `${collection} ${action}`);
  const limited = member({ ...full, Viewings: grant(true, false, false, false) });
  assert.equal(canAct(limited, 'Viewings', 'create'), true);
  assert.equal(canAct(limited, 'Viewings', 'edit'), false);
  assert.equal(canAct(limited, 'Viewings', 'delete'), false);
  assert.equal(canAct(limited, 'Viewings', 'assign'), false);
});

test('canAct denies when the session, collection, flag or value is missing or malformed', () => {
  assert.equal(canAct(null, 'Clients', 'create'), false);
  assert.equal(canAct(undefined, 'Clients', 'edit'), false);
  assert.equal(canAct({ id: 'me', roleId: 'admin' }, 'Clients', 'create'), false);
  assert.equal(canAct(member({}), 'Clients', 'create'), false);
  assert.equal(canAct(member(null), 'Clients', 'create'), false);
  assert.equal(canAct(member({ Clients: true }), 'Clients', 'create'), false);
  assert.equal(canAct(member({ Clients: { create: 'true' } }), 'Clients', 'create'), false);
  assert.equal(canAct(member({ Clients: { create: 1 } }), 'Clients', 'create'), false);
  assert.equal(canAct(member({ Clients: { create: true } }), 'Clients', 'edit'), false);
  assert.equal(canAct(member(full), 'Deals', 'create'), false, 'demo-only modules stay closed');
  assert.equal(canAct(member(full), 'Clients', 'publish'), false, 'unknown actions deny');
});

test('Leads map to the Clients grants', () => {
  assert.equal(actionCollection('Leads'), 'Clients');
  assert.equal(actionCollection('Viewings'), 'Viewings');
  const user = member({ Clients: grant(false, true, false, true) });
  assert.equal(canAct(user, 'Leads', 'create'), false);
  assert.equal(canAct(user, 'Leads', 'edit'), true);
  assert.equal(canAct(user, 'Leads', 'assign'), true);
});

test('View only applies when a module grants neither Add nor Edit', () => {
  const user = member({
    Clients: grant(false, false, false, true),
    Properties: grant(true, false, false, false),
    Contacts: grant(false, true, false, false),
  });
  assert.equal(isViewOnly(user, 'Clients'), true);
  assert.equal(isViewOnly(user, 'Leads'), true);
  assert.equal(isViewOnly(user, 'Properties'), false);
  assert.equal(isViewOnly(user, 'Contacts'), false);
  assert.equal(isViewOnly(user, 'Viewings'), true, 'a missing entry is view only');
  assert.equal(isViewOnly(null, 'Clients'), true);
});

test('saves need Add for new records and Edit for existing ones, with server messages', () => {
  const user = member({ Clients: grant(true, false, false, false) });
  assert.equal(saveRefusal(user, 'Clients', null), '');
  assert.equal(saveRefusal(user, 'Clients', { client_id: 'CL-1' }), actionDeniedMessages.edit);
  assert.equal(saveRefusal(user, 'Contacts', null), actionDeniedMessages.create);
  assert.equal(actionDeniedMessages.create, "Your access doesn't include adding these records.");
  assert.equal(actionDeniedMessages.edit, "Your access doesn't include editing these records.");
  assert.equal(actionDeniedMessages.delete, 'Ask your Admin to delete this record.');
  assert.equal(
    actionDeniedMessages.assign,
    "Your access doesn't include handing on these records.",
  );
});

const row = (id, record, assignee = null) => ({ id, version: 1, record, assignee });
const records = (followUpAssignee, clientHolder, scope = 'assigned') => ({
  scope,
  entries: {
    Clients: [row('c1', { client_id: 'CL-001' }, clientHolder)],
    'Follow-ups': [row('f1', { activity_id: 'FU-001', client_id: 'CL-001' }, followUpAssignee)],
  },
});
const followUp = { activity_id: 'FU-001', client_id: 'CL-001' };

test('delete follows recordActions and the direct-assignee follow-up rule', () => {
  const user = member(full);
  assert.equal(deleteRefusal(user, records('me', 'me'), 'Follow-ups', followUp), '');
  assert.equal(
    deleteRefusal(user, records('me', 'other'), 'Follow-ups', followUp),
    followUpDeleteMessage,
    'a non-holding direct assignee may return but not delete',
  );
  assert.equal(deleteRefusal(user, records('me', 'other', 'team'), 'Follow-ups', followUp), '');
  assert.equal(deleteRefusal(user, records(null, 'me'), 'Follow-ups', followUp), '');
  const unlinked = { activity_id: 'FU-002' };
  const extra = records('me', 'other');
  extra.entries['Follow-ups'].push(row('f2', unlinked, 'me'));
  assert.equal(deleteRefusal(user, extra, 'Follow-ups', unlinked), '');
  const noDelete = member({ ...full, 'Follow-ups': grant(true, true, false, true) });
  assert.equal(
    deleteRefusal(noDelete, records('me', 'me'), 'Follow-ups', followUp),
    actionDeniedMessages.delete,
  );
  assert.equal(
    deleteRefusal(null, records('me', 'me'), 'Clients', {}),
    actionDeniedMessages.delete,
  );
  assert.equal(deleteRefusal(user, undefined, 'Clients', { client_id: 'CL-001' }), '');
});

test('the demo keeps every action available', () => {
  for (const action of ['create', 'edit', 'delete', 'assign'])
    assert.equal(allowAll('Clients', action), true);
});
