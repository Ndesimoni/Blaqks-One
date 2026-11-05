import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentWins,
  closedDeals,
  daysToClose,
  leadResponse,
} from '../../src/features/server/performance/performanceKpis.js';

// Clearly fictional deals: earned gross fees in fils, as the finance overview shapes them.
const deal = (id, holder, details, extra = {}) => ({
  id,
  stage: 'Completed',
  assignee: holder,
  details,
  earnedOn: '2026-11-03',
  calculation: { preview: false, grossFils: 100_000 },
  ...extra,
});
const aidah = { id: 'u-1', name: 'Aidah' };
const reem = { id: 'u-2', name: 'Reem' };
const overview = {
  deals: [
    deal('d-1', aidah, { opened_date: '2026-10-01', closed_date: '2026-11-04' }),
    deal('d-2', aidah, { opened_date: '2026-10-25' }),
    deal('d-3', reem, {}, { calculation: { preview: true, grossFils: 5 } }),
    deal('d-4', null, { closed_date: '2026-10-30' }),
    deal('d-5', reem, {}, { stage: 'Negotiation' }),
  ],
};

test('closed deals follow the selection and the close month', () => {
  const team = closedDeals(overview, { kind: 'team' }, '2026-11');
  assert.deepEqual(
    team.map((row) => row.id),
    ['d-1', 'd-2', 'd-3'],
  );
  const own = closedDeals(overview, { kind: 'member', memberId: 'u-2' }, '2026-11');
  assert.deepEqual(
    own.map((row) => row.id),
    ['d-3'],
  );
});

test('days to close average only deals with an opened date', () => {
  const team = closedDeals(overview, { kind: 'team' }, '2026-11');
  // 1 Oct → 4 Nov is 34 days; 25 Oct → earned 3 Nov is 9 days.
  assert.deepEqual(daysToClose(team), { days: 22, measured: 2 });
  assert.deepEqual(daysToClose([]), { days: null, measured: 0 });
});

test('deals won per agent count deals and earned fees, most first', () => {
  const team = closedDeals(overview, { kind: 'team' }, '2026-11');
  assert.deepEqual(agentWins(team), [
    { id: 'u-1', name: 'Aidah', count: 2, fils: 200_000 },
    { id: 'u-2', name: 'Reem', count: 1, fils: 0 },
  ]);
});

test('lead response measures days to the first logged contact after a lead arrives', () => {
  const data = {
    Clients: [
      { client_id: 'CL-1', date_added: '2026-11-02' },
      { client_id: 'CL-2', date_added: '2026-11-03' },
      { client_id: 'CL-3', date_added: '2026-11-04' },
      { client_id: 'CL-4', date_added: '2026-10-30' },
    ],
    'Interaction log': [
      { client_id: 'CL-1', contacted_on_uae_time: '2026-11-02 09:40' },
      { client_id: 'CL-2', contacted_on_uae_time: '2026-11-01 10:00' },
      { client_id: 'CL-4', contacted_on_uae_time: '2026-10-30 12:00' },
    ],
    'Follow-ups': [{ client_id: 'CL-2', contact_date: '2026-11-06' }],
  };
  // CL-1 same day (0), CL-2 three days later (the earlier contact predates it), CL-3 none.
  assert.deepEqual(leadResponse(data, '2026-11'), { days: 1.5, measured: 2 });
  assert.deepEqual(leadResponse({ Clients: [] }, '2026-11'), { days: null, measured: 0 });
});
