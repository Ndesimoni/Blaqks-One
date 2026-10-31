import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAssigneeResult,
  connectedCollections,
  installServerRecord,
  readServerRecords,
  recordUnavailableMessage,
  removeServerRecord,
  serverWorkspaceData,
} from '../../src/features/server/records.js';
import { linkReference } from '../../src/features/server/projections.js';

const entry = (id, clientId, assignee = 'member-a') => ({
  id,
  version: 1,
  record: { client_id: clientId, full_name: `Client ${clientId}` },
  assignee,
});
const payload = () => ({
  scope: 'assigned',
  records: {
    ...Object.fromEntries(connectedCollections.map((name) => [name, []])),
    Clients: [entry('uuid-a', 'CL-001')],
  },
  references: {
    Clients: [{ client_id: 'CL-009', full_name: 'Referrer', phone: '+971500000000' }],
    Properties: [{ property_id: 'PR-004', listing_title: 'Marina view' }],
    Contacts: [],
  },
  taskClients: [
    { client_id: 'CL-007', full_name: 'Task client', phone: '+971501111111', email: null },
  ],
  listingViewings: [
    {
      property_id: 'PR-001',
      appointment_date_time: '2026-10-14T10:00',
      agent: { id: 'member-b', name: 'Agent B', email: 'hidden@fixture.test' },
      client_id: 'CL-099',
    },
    { property_id: 'PR-001', appointment_date_time: null, agent: null },
  ],
  dealLinks: [],
});

test('the scoped list keeps scope and projections, limited to the allowed fields', () => {
  const parsed = readServerRecords(payload());
  assert.equal(parsed.scope, 'assigned');
  assert.equal(parsed.entries.Clients[0].assignee, 'member-a');
  assert.deepEqual(parsed.references.Clients, [{ client_id: 'CL-009', full_name: 'Referrer' }]);
  assert.deepEqual(parsed.references.Contacts, []);
  assert.deepEqual(parsed.taskClients[0], {
    client_id: 'CL-007',
    full_name: 'Task client',
    phone: '+971501111111',
    email: null,
  });
  assert.deepEqual(parsed.listingViewings[0], {
    property_id: 'PR-001',
    appointment_date_time: '2026-10-14T10:00',
    agent: { id: 'member-b', name: 'Agent B' },
  });
  assert.equal(parsed.listingViewings[1].agent, null);
});

test('malformed scope, entries and projections are rejected with the existing errors', () => {
  const broken = [
    [(p) => delete p.scope, /incomplete/],
    [(p) => delete p.listingViewings, /incomplete/],
    [(p) => (p.scope = 'everyone'), /invalid/],
    [(p) => delete p.records.Clients[0].assignee, /invalid/],
    [(p) => (p.records.Clients[0].assignee = 7), /invalid/],
    [
      (p) => p.records.Viewings.push({ ...entry('v', 'x'), record: { viewing_id: 'VW-1' } }),
      /invalid/,
    ],
    [(p) => (p.references = []), /invalid/],
    [(p) => (p.references.Properties = {}), /invalid/],
    [(p) => (p.references.Clients[0].client_id = ''), /invalid/],
    [(p) => (p.taskClients = {}), /invalid/],
    [(p) => (p.taskClients[0].phone = 5), /invalid/],
    [(p) => (p.listingViewings[0].appointment_date_time = 'x'.repeat(65)), /invalid/],
    [(p) => (p.listingViewings[0].agent = { name: 'No id' }), /invalid/],
  ];
  for (const [change, error] of broken) {
    const value = payload();
    change(value);
    assert.throws(() => readServerRecords(value), error);
  }
});

test('the assignee stays entry metadata and never reaches the workbook record payload', () => {
  const value = payload();
  value.records.Clients[0].record.assignee_id = 'forged';
  value.records.Clients[0].record.recordScope = 'team';
  const { entries } = readServerRecords(value);
  const data = serverWorkspaceData(entries);
  assert.deepEqual(Object.keys(data.Clients[0]).sort(), ['client_id', 'full_name']);
  const saved = installServerRecord(entries, 'Clients', {
    ...entry('uuid-b', 'CL-002', null),
    record: { client_id: 'CL-002', assignee: 'forged' },
  });
  assert.equal(saved.Clients[0].assignee, null);
  assert.equal(saved.Clients[0].record.assignee, undefined);
  assert.equal(saved.Clients[1].assignee, 'member-a');
  assert.throws(
    () =>
      installServerRecord(entries, 'Viewings', {
        ...entry('v', 'x'),
        record: { viewing_id: 'VW-1' },
      }),
    /invalid/,
  );
});

test('hidden records are removed locally and entry:null hand-offs remove the record (L5)', () => {
  const { entries } = readServerRecords(payload());
  assert.equal(recordUnavailableMessage, 'This record is no longer available to you.');
  assert.deepEqual(removeServerRecord(entries, 'Clients', 'uuid-a').Clients, []);
  assert.equal(removeServerRecord(entries, 'Clients', 'unknown'), entries);
  assert.deepEqual(applyAssigneeResult(entries, 'Clients', 'uuid-a', { entry: null }).Clients, []);
  const moved = applyAssigneeResult(entries, 'Clients', 'uuid-a', {
    entry: { ...entry('uuid-a', 'CL-001', 'member-b'), version: 2 },
  });
  assert.equal(moved.Clients[0].assignee, 'member-b');
  assert.throws(() => applyAssigneeResult(entries, 'Clients', 'uuid-a', {}), /invalid/);
  assert.throws(
    () => applyAssigneeResult(entries, 'Clients', 'uuid-a', { entry: entry('uuid-z', 'CL-1') }),
    /invalid/,
  );
});

test('references and task clients are labelled as not assigned; unknown IDs are not', () => {
  const projections = readServerRecords(payload());
  assert.deepEqual(linkReference(projections, 'Clients', 'CL-009'), {
    label: 'CL-009 · Referrer (not assigned to you)',
    taskClient: false,
  });
  assert.deepEqual(linkReference(projections, 'Clients', 'CL-007'), {
    label: 'CL-007 · Task client (not assigned to you)',
    taskClient: true,
  });
  assert.equal(
    linkReference(projections, 'Properties', 'PR-004').label,
    'PR-004 · Marina view (not assigned to you)',
  );
  assert.equal(linkReference(projections, 'Clients', 'CL-404'), null);
  assert.equal(linkReference(projections, 'Contacts', 'CL-009'), null);
  assert.equal(linkReference(projections, 'Deals', 'DL-1'), null);
});
