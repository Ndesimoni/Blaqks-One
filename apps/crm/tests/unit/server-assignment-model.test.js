import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assigneeLabel,
  bulkTargets,
  canReassign,
  effectiveHolder,
  filterAssignedEntries,
  inheritedVisibility,
  losesVisibility,
  noteError,
} from '../../src/features/server/assignment/assignmentModel.js';
import {
  assignmentFailure,
  readAssignees,
  readAssignmentHistory,
  viewingTime,
} from '../../src/features/server/assignment/assignmentResponses.js';

const row = (id, record, assignee = null, version = 1) => ({ id, version, record, assignee });
const entries = () => ({
  Clients: [row('c1', { client_id: 'CL-001' }, 'me'), row('c2', { client_id: 'CL-002' }, 'b')],
  Properties: [row('p1', { property_id: 'PR-001', contact_id: 'CT-001' }, 'me')],
  Contacts: [row('k1', { contact_id: 'CT-001' }, 'b'), row('k2', { contact_id: 'CT-002' })],
  'Follow-ups': [
    row('f1', { follow_up_id: 'FU-001', client_id: 'CL-001' }),
    row('f2', { follow_up_id: 'FU-002', client_id: 'CL-002' }, 'me'),
    row('f3', { follow_up_id: 'FU-003' }),
  ],
});

test('holders, reassignment rights and the loss-of-visibility warning follow §5 and §8', () => {
  const all = entries();
  const [inheriting, direct, orphan] = all['Follow-ups'];
  assert.equal(effectiveHolder(all, 'Follow-ups', inheriting), 'me');
  assert.equal(effectiveHolder(all, 'Follow-ups', direct), 'me');
  assert.equal(effectiveHolder(all, 'Follow-ups', orphan), null);
  assert.equal(canReassign('assigned', 'me', 'me'), true);
  assert.equal(canReassign('assigned', 'b', 'me'), false);
  assert.equal(canReassign('assigned', null, undefined), false);
  assert.equal(canReassign('team', 'b', 'me'), true);
  assert.equal(losesVisibility({ scope: 'assigned', me: 'me', toId: 'b' }), true);
  assert.equal(losesVisibility({ scope: 'assigned', me: 'me', toId: 'me' }), false);
  assert.equal(losesVisibility({ scope: 'team', me: 'me', toId: 'b' }), false);
  const keptByClient = inheritedVisibility(all, 'Follow-ups', inheriting.record, 'me');
  assert.equal(keptByClient, true);
  assert.equal(losesVisibility({ scope: 'assigned', me: 'me', toId: 'b', inherited: true }), false);
  assert.equal(inheritedVisibility(all, 'Contacts', { contact_id: 'CT-001' }, 'me'), true);
  assert.equal(inheritedVisibility(all, 'Clients', { client_id: 'CL-001' }, 'me'), false);
});

test('labels distinguish the Admin queue from follow-ups without a direct assignee', () => {
  const people = [{ id: 'b', name: 'Agent B' }];
  assert.equal(assigneeLabel('Clients', null, people, 'me'), 'Unassigned · needs owner');
  assert.equal(assigneeLabel('Follow-ups', null, people, 'me'), 'No direct assignee');
  assert.equal(assigneeLabel('Properties', 'b', people, 'me'), 'Agent B');
  assert.equal(assigneeLabel('Contacts', 'me', people, 'me'), 'You');
  assert.equal(assigneeLabel('Contacts', 'gone', people, 'me'), 'Team member');
  assert.equal(noteError('x'.repeat(1000)), '');
  assert.match(noteError('x'.repeat(1001)), /1000 characters/);
});

test('the Assigned-to filter and bulk targets use visible entries, versions and the 500 cap', () => {
  const all = entries();
  assert.deepEqual(
    filterAssignedEntries(all, 'Contacts', 'queue').map((entry) => entry.id),
    ['k2'],
  );
  assert.deepEqual(
    filterAssignedEntries(all, 'Follow-ups', 'me').map((entry) => entry.id),
    ['f1', 'f2'],
  );
  assert.equal(filterAssignedEntries(all, 'Clients', '').length, 2);
  assert.deepEqual(bulkTargets(all, 'Clients', 'b'), {
    records: [{ collection: 'Clients', id: 'c2', version: 1 }],
    tooMany: false,
  });
  const many = { Clients: Array.from({ length: 501 }, (_, i) => row(`c${i}`, { client_id: i })) };
  assert.equal(bulkTargets(many, 'Clients', 'queue').tooMany, true);
});

test('assignee and history responses are validated and reduced to the contract fields', () => {
  assert.deepEqual(readAssignees({ assignees: [{ id: 'b', name: 'B', email: 'x@y.z' }] }), [
    { id: 'b', name: 'B' },
  ]);
  for (const bad of [{}, { assignees: {} }, { assignees: [{ name: 'No id' }] }])
    assert.throws(() => readAssignees(bad), /invalid assignment/);
  assert.throws(() => readAssignees({ assignees: [{ id: 'b' }, { id: 'b' }] }), /invalid/);
  const history = readAssignmentHistory({
    history: [
      {
        at: '2026-10-12T08:00:00Z',
        reason: 'admin_reassigned',
        from: null,
        to: { id: 'b', name: 'B' },
        actor: null,
        note: null,
      },
      {
        at: '2026-10-12T09:00:00Z',
        reason: 'reassigned',
        from: { id: 'b', name: 'B' },
        to: null,
        actor: { id: 'a', name: 'Admin' },
        note: 'Over to you',
      },
    ],
  });
  assert.equal(history[0].actor, null);
  assert.equal(history[1].note, 'Over to you');
  for (const reason of ['deleted', undefined])
    assert.throws(() => readAssignmentHistory({ history: [{ at: 'x', reason }] }), /invalid/);
  const long = { at: 'x', reason: 'bulk', note: 'n'.repeat(1001) };
  assert.throws(() => readAssignmentHistory({ history: [long] }), /invalid/);
  assert.throws(
    () => readAssignmentHistory({ history: [{ ...long, note: null, to: 'b' }] }),
    /invalid/,
  );
});

test('viewing times and failures read plainly; bulk failures say nothing changed', () => {
  assert.equal(viewingTime(null), 'Time not set');
  assert.match(viewingTime('2026-10-14T10:30'), /14 Oct 2026 · 10:30/);
  assert.equal(viewingTime('next week'), 'next week');
  const stale = { status: 409, details: { code: 'version_conflict' }, message: 'Stale' };
  assert.match(assignmentFailure(stale), /changed since it was loaded/);
  assert.match(assignmentFailure(stale, true), /^No records were changed\./);
  assert.match(
    assignmentFailure({ status: 404, message: 'Record not found.' }, true),
    /no longer available/,
  );
  const forbidden = { status: 403, message: 'Only your Admin can move records to the queue.' };
  assert.equal(assignmentFailure(forbidden), forbidden.message);
});
