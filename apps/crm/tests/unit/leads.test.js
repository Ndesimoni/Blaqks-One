import assert from 'node:assert/strict';
import test from 'node:test';
import {
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from '../../src/features/leads/selectors.js';
import {
  canPersistStage,
  changesStage,
  leadBudget,
  leadColumns,
  leadNeed,
  stageTone,
} from '../../src/features/leads/boardModel.js';
import { selectRecords } from '../../src/lib/workspace.js';

const records = [
  {
    client_id: 'CL-1',
    full_name: 'Alice',
    lead_source: ' instagram ',
    lead_stage: ' new ',
    campaign_reference: 'Summer launch',
  },
  { client_id: 'CL-2', full_name: 'Bob', lead_source: 'Instagram', lead_stage: 'Qualified' },
  { client_id: 'CL-3', lead_source: 'Legacy portal', lead_stage: 'Imported stage' },
  { client_id: 'CL-4', lead_source: 'legacy PORTAL', lead_stage: 'Closed' },
  { client_id: 'CL-5', lead_source: ' ', lead_stage: '' },
  { client_id: 'CL-6', lead_stage: 'Lost' },
];

test('source totals include custom and unrecorded sources, group casing, and preserve records', () => {
  const before = structuredClone(records);
  assert.deepEqual(selectLeadSources(records), [
    { label: 'Instagram', count: 2 },
    { label: 'Legacy portal', count: 2 },
    { label: 'Not recorded', count: 2 },
  ]);
  assert.deepEqual(selectLeadSources([]), []);
  assert.deepEqual(records, before);
});

test('lead source and stage filters compose with shared search and sorting on existing client profiles', () => {
  const data = { Clients: records, Properties: [] };
  const selected = selectRecords(data, 'Clients', {
    query: ' summer ',
    sort: { key: 'full_name', direction: 'desc' },
    filter: (record) => matchesLeadFilters(record, { source: 'Instagram', stage: 'New' }),
  });
  assert.deepEqual(selected, [records[0]]);
  assert.equal(selected[0], records[0]);
  assert.equal(matchesLeadFilters(records[1], { source: 'Instagram', stage: 'New' }), false);
  assert.equal(matchesLeadFilters(records[2], { source: 'Legacy portal' }), true);
  assert.equal(
    matchesLeadFilters(records[4], { source: 'Not recorded', stage: 'Not recorded' }),
    true,
  );
  for (const record of records) assert.equal(matchesLeadFilters(record), true);
});

test('stage choices retain closed/lost history and unknown imported stages', () => {
  const stages = leadStageOptions(records);
  for (const stage of ['New', 'Qualified', 'Closed', 'Lost', 'Imported stage', 'Not recorded'])
    assert.ok(stages.includes(stage));
  assert.equal(stages.filter((stage) => stage === 'New').length, 1);
  assert.ok(leadStageOptions([], 'Imported stage').includes('Imported stage'));
});

test('the lead board groups every filtered record once and preserves custom stages', () => {
  const columns = leadColumns(records);
  assert.deepEqual(columns.find((column) => column.key === 'New').items, [records[0]]);
  assert.deepEqual(columns.find((column) => column.key === 'Imported stage').items, [records[2]]);
  assert.equal(columns.flatMap((column) => column.items).length, records.length);
  assert.equal(stageTone('Qualified'), 'green');
  assert.equal(stageTone('Unknown'), 'muted');
  assert.equal(changesStage(records[0], 'NEW'), false);
  assert.equal(changesStage(records[0], 'Qualified'), true);
  assert.equal(changesStage(records[0], 'Not recorded'), false);
  assert.equal(canPersistStage('Not recorded'), false);
  assert.equal(columns.find((column) => column.key === 'Not recorded').acceptsMove, false);
  const filtered = leadColumns([records[0]], records);
  assert.ok(filtered.some((column) => column.key === 'Imported stage'));
  assert.equal(filtered.flatMap((column) => column.items).length, 1);
});

test('lead board summaries use existing fields without mutating a record', () => {
  const record = {
    buy_rent: 'Buy',
    property_type: 'Apartment',
    preferred_communities: 'Dubai Marina',
    maximum_budget_aed: '2500000',
  };
  const before = structuredClone(record);
  assert.equal(leadNeed(record), 'Buy · Apartment · Dubai Marina');
  assert.equal(leadBudget(record), 2500000);
  assert.equal(leadBudget({ maximum_budget_aed: 'unknown' }), null);
  assert.deepEqual(record, before);
});
