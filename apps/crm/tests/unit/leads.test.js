import assert from 'node:assert/strict';
import test from 'node:test';
import {
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from '../../src/features/leads/selectors.js';
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
