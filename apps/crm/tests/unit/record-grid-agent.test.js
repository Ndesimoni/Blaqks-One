import assert from 'node:assert/strict';
import test from 'node:test';
import { cellText, gridFields } from '../../src/features/records/grid/gridFields.js';
import { agentColumn } from '../../src/features/server/assignment/agentColumn.js';

// Clearly fictional team and clients.
const entries = {
  Clients: [
    { record: { client_id: 'CL-1' }, assignee: 'u-reem' },
    { record: { client_id: 'CL-2' }, assignee: null },
    { record: { client_id: 'CL-3' }, assignee: 'u-me' },
    { record: { client_id: 'CL-4' }, assignee: 'u-gone' },
  ],
};
const people = [{ id: 'u-reem', name: 'Reem Example' }];
const me = { id: 'u-me', name: 'Synthetic Admin' };

test("Agent names each client's holder; kept clients and unknown people show nothing", () => {
  const agent = agentColumn(entries, people, me, 'Unassigned');
  assert.equal(agent.name, 'Agent');
  assert.equal(agent.virtual, true);
  const value = (client_id) => agent.value({ client_id });
  assert.equal(value('CL-1'), 'Reem Example');
  assert.equal(value('CL-2'), 'Unassigned');
  assert.equal(value('CL-3'), 'Synthetic Admin', 'assigned-only scope loads no team list');
  assert.equal(value('CL-4'), '');
  assert.equal(value('CL-KEPT'), '', 'a client the caller only keeps is not theirs');
});

test('added columns follow the sheet and show a dash when empty', () => {
  const agent = agentColumn(entries, people, me, 'Unassigned');
  const fields = gridFields('Clients', [agent]);
  assert.equal(fields[0].name, 'Client ID');
  assert.equal(fields.at(-1), agent);
  assert.equal(cellText({}, 'Clients', { client_id: 'CL-1' }, agent), 'Reem Example');
  assert.equal(cellText({}, 'Clients', { client_id: 'CL-4' }, agent), '—');
  assert.equal(gridFields('Clients').length, fields.length - 1);
});
