import test from 'node:test';
import assert from 'node:assert/strict';
import {
  performAssignment,
  performBulk,
} from '../../src/features/server/assignment/assignmentActions.js';

const entry = (id, assignee, version = 1) => ({
  id,
  version,
  record: { client_id: `CL-${id}`, full_name: id },
  assignee,
});

/** Mocked records context and view: records state is applied through functional updates. */
function harness(api) {
  const state = { entries: { Clients: [entry('a', 'me'), entry('b', 'me')] } };
  const calls = { refresh: 0, toasts: [], details: [] };
  const records = {
    get entries() {
      return state.entries;
    },
    setEntries: (update) => (state.entries = update(state.entries)),
    refresh: async () => {
      calls.refresh++;
    },
  };
  const view = {
    setToast: (message) => calls.toasts.push(message),
    setDetail: (detail) => calls.details.push(detail),
  };
  const context = { api, workspaceId: 'ws', records, view };
  return { state, calls, context };
}
const failure = (status, message, code) =>
  Object.assign(Error(message), { status, details: { code } });

test('a hand-off that hides the record removes it, closes details and re-fetches', async () => {
  const sent = [];
  const api = { assign: async (...args) => (sent.push(args), { entry: null }) };
  const { state, calls, context } = harness(api);
  const target = state.entries.Clients[0];
  const result = await performAssignment({
    ...context,
    module: 'Clients',
    entry: target,
    toId: 'b',
    note: 'Call Tuesday',
  });
  assert.deepEqual(result, { done: true });
  assert.deepEqual(sent[0], ['ws', 'Clients', target, 'b', 'Call Tuesday']);
  assert.deepEqual(
    state.entries.Clients.map((row) => row.id),
    ['b'],
  );
  assert.deepEqual(calls.details, [null]);
  assert.equal(calls.refresh, 1);
});

test('a visible result installs the new holder and version, and refreshes the detail', async () => {
  const api = { assign: async () => ({ entry: entry('a', 'other', 2) }) };
  const { state, calls, context } = harness(api);
  const target = state.entries.Clients[0];
  await performAssignment({ ...context, module: 'Clients', entry: target, toId: 'other' });
  assert.equal(state.entries.Clients[0].assignee, 'other');
  assert.equal(state.entries.Clients[0].version, 2);
  assert.equal(calls.details[0].record.client_id, 'CL-a');
  assert.equal(calls.refresh, 1);
});

test('404 removes the record with the L5 notice; other errors keep it and show the server message', async () => {
  const missing = harness({
    assign: async () => Promise.reject(failure(404, 'Record not found.')),
  });
  const target = missing.state.entries.Clients[0];
  const gone = await performAssignment({ ...missing.context, module: 'Clients', entry: target });
  assert.deepEqual(gone, { done: true });
  assert.equal(missing.state.entries.Clients.length, 1);
  assert.deepEqual(missing.calls.toasts, ['This record is no longer available to you.']);
  const message = 'Choose an active team member with access to this record type.';
  const denied = harness({ assign: async () => Promise.reject(failure(400, message)) });
  const kept = await performAssignment({ ...denied.context, module: 'Clients', entry: target });
  assert.deepEqual(kept, { message });
  assert.equal(denied.state.entries.Clients.length, 2);
  assert.equal(denied.calls.refresh, 0);
  const malformed = harness({ assign: async () => ({ entry: entry('z', 'b') }) });
  const bad = await performAssignment({ ...malformed.context, module: 'Clients', entry: target });
  assert.match(bad.message, /invalid record information/);
  assert.equal(malformed.state.entries.Clients[0].assignee, 'me');
});

test('bulk reassignment installs every entry or changes nothing and refreshes', async () => {
  const targets = [
    { collection: 'Clients', id: 'a', version: 1 },
    { collection: 'Clients', id: 'b', version: 1 },
  ];
  const sent = [];
  const ok = harness({
    bulkAssign: async (...args) => (
      sent.push(args),
      { entries: [entry('a', null, 2), entry('b', null, 2)] }
    ),
  });
  const done = await performBulk({ ...ok.context, collection: 'Clients', targets, toId: null });
  assert.deepEqual(done, { done: true });
  assert.deepEqual(sent[0].slice(0, 3), ['ws', null, targets]);
  assert.ok(ok.state.entries.Clients.every((row) => row.assignee === null && row.version === 2));
  const stale = harness({
    bulkAssign: async () => Promise.reject(failure(409, 'Stale', 'version_conflict')),
  });
  const result = await performBulk({ ...stale.context, collection: 'Clients', targets, toId: 'x' });
  assert.match(result.message, /^No records were changed\./);
  assert.ok(stale.state.entries.Clients.every((row) => row.assignee === 'me'));
  assert.equal(stale.calls.refresh, 1);
  const short = harness({ bulkAssign: async () => ({ entries: [entry('a', 'x', 2)] }) });
  const partial = await performBulk({
    ...short.context,
    collection: 'Clients',
    targets,
    toId: 'x',
  });
  assert.match(partial.message, /No records were changed/);
  assert.ok(short.state.entries.Clients.every((row) => row.assignee === 'me'));
});
