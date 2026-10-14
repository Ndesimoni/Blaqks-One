import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardWidgets,
  filterWorkload,
  linkedName,
  selectConnectedDashboard,
  workloadCount,
  workloadModule,
} from '../../src/features/server/dashboard/dashboardModel.js';
import { serverWorkspaceData } from '../../src/features/server/records.js';
import { today } from '../../src/lib/dates.js';

const row = (id, record, assignee = null) => ({ id, version: 1, record, assignee });
const entries = () => ({
  Clients: [
    row(
      'c1',
      { client_id: 'CL-1', full_name: 'Amal', lead_stage: 'New', lead_source: 'Bayut' },
      'a',
    ),
    row('c2', { client_id: 'CL-2', lead_stage: 'Lost', lead_source: 'Flyer' }, 'b'),
    row('c3', { client_id: 'CL-3', lead_stage: 'New' }),
  ],
  Properties: [
    row('p1', { property_id: 'PR-1', listing_title: 'Marina flat', listing_status: 'Available' }),
    row('p2', { property_id: 'PR-2', listing_status: 'Sold' }, 'b'),
  ],
  Contacts: [],
  'Follow-ups': [
    row('f1', { activity_id: 'FU-1', client_id: 'CL-1', due_date: '2000-01-01' }),
    row('f2', { activity_id: 'FU-2', client_id: 'CL-2', due_date: '2999-01-01' }, 'a'),
  ],
  Viewings: [
    row('v1', { viewing_id: 'VW-1', client_id: 'CL-1', appointment_date_time: `${today()} 10:00` }),
    row('v2', { viewing_id: 'VW-2', property_id: 'PR-2', appointment_date_time: '2000-01-01' }),
  ],
  Shortlist: [],
  'Interaction log': [],
  'Client care': [],
});

test('dashboard figures come only from the scoped records the session received', () => {
  const figures = selectConnectedDashboard(serverWorkspaceData(entries()));
  assert.equal(figures.openLeads.length, 2);
  assert.equal(figures.properties, 2);
  assert.equal(figures.available, 1);
  assert.deepEqual(
    figures.dueTasks.map((task) => task.activity_id),
    ['FU-1'],
  );
  assert.deepEqual(
    figures.upcoming.map((viewing) => viewing.viewing_id),
    ['VW-1'],
  );
  assert.deepEqual(figures.stages, [
    { name: 'New', count: 2 },
    { name: 'Lost', count: 1 },
  ]);
  assert.deepEqual(figures.sources, [
    { name: 'Bayut', count: 1 },
    { name: 'Other', count: 1 },
  ]);
  assert.equal(figures.counts.Clients, 3);
  assert.equal(figures.counts.Viewings, 2);
  assert.equal('Deals' in figures.counts, false);
  const empty = selectConnectedDashboard(serverWorkspaceData({}));
  assert.equal(empty.properties, 0);
  assert.equal(empty.maxStage, 1);
});

test('a member workload follows holders and links activity through held clients', () => {
  const all = entries();
  const data = serverWorkspaceData(all);
  assert.equal(filterWorkload(all, data, ''), data);
  const a = filterWorkload(all, data, 'a');
  assert.deepEqual(
    a.Clients.map((client) => client.client_id),
    ['CL-1'],
  );
  assert.deepEqual(a['Follow-ups'].map((task) => task.activity_id).sort(), ['FU-1', 'FU-2']);
  assert.deepEqual(
    a.Viewings.map((viewing) => viewing.viewing_id),
    ['VW-1'],
  );
  assert.equal(workloadCount(a), 3);
  const b = filterWorkload(all, data, 'b');
  assert.deepEqual(b.Viewings, [], 'activity follows the linked client, not the listing');
  assert.deepEqual(
    b.Properties.map((property) => property.property_id),
    ['PR-2'],
  );
  const queue = filterWorkload(all, data, 'queue');
  assert.deepEqual(
    queue.Clients.map((client) => client.client_id),
    ['CL-3'],
  );
  assert.deepEqual(
    queue.Properties.map((property) => property.property_id),
    ['PR-1'],
  );
});

test('widgets and the workload filter follow module grants and record scope', () => {
  const full = { relationships: true, properties: true, schedule: true, finance: true };
  const admin = { roleId: 'admin', permissions: full };
  assert.deepEqual(dashboardWidgets(admin).collections.length, 8);
  assert.equal(workloadModule(admin, 'team'), 'Clients');
  assert.equal(workloadModule(admin, 'assigned'), null);
  const scheduler = { roleId: 'staff', permissions: { schedule: true } };
  const widgets = dashboardWidgets(scheduler);
  assert.equal(widgets.leads, false);
  assert.equal(widgets.properties, false);
  assert.equal(widgets.schedule, true);
  assert.deepEqual(widgets.collections, [
    'Follow-ups',
    'Viewings',
    'Interaction log',
    'Client care',
  ]);
  assert.equal(workloadModule(scheduler, 'team'), 'Follow-ups');
  assert.equal(workloadModule({ roleId: 'staff', permissions: {} }, 'team'), null);
});

test('hidden linked records use permitted labels only', () => {
  const data = serverWorkspaceData(entries());
  const references = (collection, id) =>
    id === 'CL-9' ? { label: 'CL-9 · Task client (not assigned to you)' } : null;
  assert.equal(linkedName(data, references, 'Clients', 'CL-1'), 'Amal');
  assert.equal(linkedName(data, references, 'Clients', 'CL-2'), 'CL-2');
  assert.equal(linkedName(data, references, 'Properties', 'PR-1'), 'Marina flat');
  assert.equal(
    linkedName(data, references, 'Clients', 'CL-9'),
    'CL-9 · Task client (not assigned to you)',
  );
  assert.equal(
    linkedName(data, references, 'Properties', 'PR-7'),
    'PR-7 · Linked record unavailable',
  );
  assert.equal(linkedName(data, undefined, 'Clients', ''), '—');
});
