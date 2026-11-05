import assert from 'node:assert/strict';
import test from 'node:test';
import { lookingForColumn } from '../../src/features/leads/boardModel.js';
import { leadPresets, matchesLeadFilters } from '../../src/features/leads/selectors.js';
import { leadTier } from '../../src/lib/crm.js';

// 2 November 2026 is a Monday; clearly fictional leads.
const today = '2026-11-04';
const leads = [
  { client_id: 'L1', date_added: '2026-11-02', lead_source: 'Website' },
  { client_id: 'L2', date_added: '2026-11-01', lead_source: 'website ' },
  { client_id: 'L3', date_added: '', lead_source: 'Referral' },
];
const ids = (preset) =>
  leads.filter((record) => matchesLeadFilters(record, { preset, today })).map((r) => r.client_id);

test("the mockup's Leads presets; the first reads My leads only for assigned-only scope", () => {
  assert.deepEqual(leadPresets(false), ['All leads', 'New this week', 'Hot', 'From the website']);
  assert.equal(leadPresets(true)[0], 'My leads');
  assert.deepEqual(ids('All leads'), ['L1', 'L2', 'L3']);
  assert.deepEqual(ids('My leads'), ['L1', 'L2', 'L3'], 'the server already narrowed them');
  assert.deepEqual(ids('New this week'), ['L1'], 'added since Monday');
  assert.deepEqual(ids('From the website'), ['L1', 'L2'], 'imported casing still matches');
  const hot = leads.filter((record) => leadTier(record) === 'Hot').map((r) => r.client_id);
  assert.deepEqual(ids('Hot'), hot);
});

test('presets combine with the kept Source and Lead stage filters', () => {
  const pick = (filters) =>
    leads
      .filter((record) => matchesLeadFilters(record, { today, ...filters }))
      .map((r) => r.client_id);
  assert.deepEqual(pick({ preset: 'New this week', source: 'Referral' }), []);
  assert.deepEqual(pick({ preset: 'All leads', source: 'Referral' }), ['L3']);
});

test('Looking for reads the lead’s need as one display-only column', () => {
  assert.equal(lookingForColumn.virtual, true);
  const record = { buy_rent: 'Rent', property_type: 'Apartment', preferred_communities: 'JLT' };
  assert.equal(lookingForColumn.value(record), 'Rent · Apartment · JLT');
});
