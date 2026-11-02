import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monthSources,
  quietClients,
  viewingsToOffers,
  viewingsWeekOnWeek,
} from '../../src/features/server/insights/insightsKpis.js';

// Wednesday 4 November 2026 in Dubai; clearly fictional records.
const TODAY = '2026-11-04';

test("this month's new leads by source, most first", () => {
  const clients = [
    { lead_source: 'Website', date_added: '2026-11-01' },
    { lead_source: 'Website', date_added: '2026-11-03' },
    { lead_source: 'Instagram', date_added: '2026-11-02' },
    { lead_source: '', date_added: '2026-11-02' },
    { lead_source: 'Referral', date_added: '2026-10-30' },
  ];
  assert.deepEqual(monthSources(clients, '2026-11'), {
    total: 4,
    sources: [
      { name: 'Website', count: 2 },
      { name: 'Instagram', count: 1 },
    ],
  });
});

test('viewings to offers counts viewed clients who reached negotiation or later', () => {
  const data = {
    Viewings: [
      { client_id: 'CL-1', viewing_status: 'Completed' },
      { client_id: 'CL-1', viewing_status: 'Completed' },
      { client_id: 'CL-2', viewing_status: 'Completed' },
      { client_id: 'CL-3', viewing_status: 'Scheduled' },
    ],
    Clients: [
      { client_id: 'CL-1', lead_stage: 'Negotiation' },
      { client_id: 'CL-2', lead_stage: 'Viewing' },
      { client_id: 'CL-3', lead_stage: 'Closed' },
    ],
  };
  assert.deepEqual(viewingsToOffers(data), { viewed: 2, offers: 1 });
});

test('viewings week on week leave cancelled ones out', () => {
  const viewings = [
    { appointment_date_time: '2026-11-02 10:00' },
    { appointment_date_time: '2026-11-08 18:00' },
    { appointment_date_time: '2026-10-28 09:00' },
    { appointment_date_time: '2026-11-03 10:00', viewing_status: 'Cancelled' },
  ];
  assert.deepEqual(viewingsWeekOnWeek(viewings, TODAY), { thisWeek: 2, lastWeek: 1 });
});

test('quiet clients are open clients without contact for 30 days', () => {
  const data = {
    Clients: [
      { client_id: 'CL-1', date_added: '2026-08-01', lead_stage: 'Qualified' },
      { client_id: 'CL-2', date_added: '2026-08-01', lead_stage: 'Qualified' },
      { client_id: 'CL-3', date_added: '2026-10-20', lead_stage: 'New' },
      { client_id: 'CL-4', date_added: '2026-08-01', lead_stage: 'Lost' },
      { client_id: 'CL-5', date_added: '2026-08-01', lead_stage: 'Viewing' },
    ],
    'Interaction log': [{ client_id: 'CL-2', contacted_on_uae_time: '2026-10-25 10:00' }],
    'Follow-ups': [{ client_id: 'CL-5', contact_date: '2026-09-01' }],
  };
  // CL-1 never contacted since August; CL-5 last contacted in September.
  assert.equal(quietClients(data, TODAY), 2);
});
