import test from 'node:test';
import assert from 'node:assert/strict';
import { returnsOnly } from '../../src/features/server/assignment/assignmentModel.js';
import { performAssignment } from '../../src/features/server/assignment/assignmentActions.js';
import { assignmentFailure } from '../../src/features/server/assignment/assignmentResponses.js';

const row = (id, record, assignee = null, version = 1) => ({ id, version, record, assignee });
const task = (assignee, clientId = 'CL-002') =>
  row('f1', { activity_id: 'FU-001', ...(clientId ? { client_id: clientId } : {}) }, assignee);
const entries = (followUp) => ({
  Clients: [row('c1', { client_id: 'CL-001' }, 'me')],
  'Follow-ups': [followUp],
});
const chain =
  "Only the client's holder, the Admin or a full-team member can pass this follow-up on. " +
  "You can return it to the client's holder.";

test("a direct assignee who does not hold the follow-up's client may only return it", () => {
  const followUp = task('me');
  assert.equal(returnsOnly(entries(followUp), 'Follow-ups', followUp, 'assigned', 'me'), true);
});

test("the client's holder, team scope and other cases keep the teammate picker", () => {
  const held = task('me', 'CL-001');
  assert.equal(returnsOnly(entries(held), 'Follow-ups', held, 'assigned', 'me'), false);
  const followUp = task('me');
  assert.equal(returnsOnly(entries(followUp), 'Follow-ups', followUp, 'team', 'me'), false);
  const unlinked = task('me', null);
  assert.equal(returnsOnly(entries(unlinked), 'Follow-ups', unlinked, 'assigned', 'me'), false);
  const inherited = task(null);
  assert.equal(returnsOnly(entries(inherited), 'Follow-ups', inherited, 'assigned', 'me'), false);
  const someoneElse = task('b');
  assert.equal(
    returnsOnly(entries(someoneElse), 'Follow-ups', someoneElse, 'assigned', 'me'),
    false,
  );
  const client = row('c2', { client_id: 'CL-002' }, 'me');
  assert.equal(returnsOnly(entries(task('me')), 'Clients', client, 'assigned', 'me'), false);
  assert.equal(returnsOnly(entries(followUp), 'Follow-ups', null, 'assigned', 'me'), false);
  assert.equal(
    returnsOnly(entries(followUp), 'Follow-ups', followUp, 'assigned', undefined),
    false,
  );
});

function harness(api) {
  const state = { entries: entries(task('me')) };
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
  const context = { api, workspaceId: 'ws', module: 'Follow-ups', records, view };
  return { state, calls, context, entry: state.entries['Follow-ups'][0] };
}

test("returning sends a null assignee and confirms the client's holder has it back", async () => {
  const sent = [];
  const api = { assign: async (...args) => (sent.push(args), { entry: null }) };
  const { state, calls, context, entry } = harness(api);
  const result = await performAssignment({
    ...context,
    entry,
    toId: null,
    note: 'Called twice, no answer.',
    returnOnly: true,
  });
  assert.deepEqual(result, { done: true });
  assert.deepEqual(sent, [['ws', 'Follow-ups', entry, null, 'Called twice, no answer.']]);
  assert.deepEqual(state.entries['Follow-ups'], []);
  assert.deepEqual(calls.details, [null]);
  assert.deepEqual(calls.toasts, ["Follow-up returned to the client's holder."]);
  assert.equal(calls.refresh, 1);
});

test('a forbidden pass-on keeps the dialog open with the server explanation', async () => {
  const api = {
    assign: async () => {
      throw Object.assign(Error(chain), { status: 403, details: { code: 'forbidden' } });
    },
  };
  const { state, calls, context, entry } = harness(api);
  const result = await performAssignment({ ...context, entry, toId: 'b', note: '' });
  assert.deepEqual(result, { message: chain });
  assert.equal(state.entries['Follow-ups'].length, 1);
  assert.deepEqual(calls.toasts, []);
  assert.equal(calls.refresh, 0);
  const forbidden = { status: 403, message: chain, details: { code: 'forbidden' } };
  assert.equal(assignmentFailure(forbidden), chain);
});
