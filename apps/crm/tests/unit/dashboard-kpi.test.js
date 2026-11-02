import assert from 'node:assert/strict';
import test from 'node:test';
import { collectedShare } from '../../src/features/server/dashboard/financeDashboard.js';
import { formatAed } from '../../src/lib/finance/money.js';
import {
  compactAed,
  followUpsDue,
  newLeadsByWeek,
  openPipeline,
  todayAgenda,
  viewingsThisWeek,
  weekStart,
  workloadDeals,
} from '../../src/features/server/dashboard/kpiModel.js';

// Wednesday 4 November 2026 in Dubai; clearly fictional records.
const TODAY = '2026-11-04';

test('weeks run Monday to Sunday, in Dubai calendar days', () => {
  assert.equal(weekStart(TODAY), '2026-11-02');
  assert.equal(weekStart('2026-11-08'), '2026-11-02');
  assert.equal(weekStart('2026-11-02'), '2026-11-02');
});

test('follow-ups due today and overdue follow the Follow-ups page rule', () => {
  const rows = [
    { due_date: `${TODAY} 10:30`, task_status: 'Open' },
    { due_date: '2026-11-01', task_status: 'Open' },
    { due_date: '2026-11-01', task_status: 'Completed' },
    { task_status: 'Open' },
  ];
  assert.deepEqual(followUpsDue(rows, TODAY), { today: 1, overdue: 1 });
});

test('new leads count per week, this week so far last; viewings per weekday', () => {
  const clients = ['2026-11-02', '2026-11-04', '2026-11-05', '2026-10-27', '2026-10-20'].map(
    (date_added) => ({ date_added }),
  );
  assert.deepEqual(newLeadsByWeek(clients, TODAY, 3), [1, 1, 2]);
  const viewings = [
    { appointment_date_time: '2026-11-02 10:00' },
    { appointment_date_time: `${TODAY} 15:00` },
    { appointment_date_time: `${TODAY} 16:00`, viewing_status: 'Cancelled' },
    { appointment_date_time: '2026-11-09 09:00' },
  ];
  assert.deepEqual(viewingsThisWeek(viewings, TODAY), [1, 0, 1, 0, 0, 0, 0]);
});

test('the open pipeline sums open deals, within the chosen workload', () => {
  const deals = [
    { stage: 'Negotiation', agreedValueFils: '1900000000', assignee: { id: 'u-1' } },
    { stage: 'Offer', agreedValueFils: '190000000', assignee: null },
    { stage: 'Completed', agreedValueFils: '500000000', assignee: { id: 'u-1' } },
  ];
  assert.deepEqual(openPipeline(deals), { fils: '2090000000', count: 2 });
  assert.equal(compactAed(openPipeline(deals).fils), 'AED 20.9M');
  assert.equal(workloadDeals(deals, 'u-1').length, 2);
  assert.equal(workloadDeals(deals, 'queue').length, 1);
  assert.equal(workloadDeals(deals, '').length, 3);
});

test("today's agenda lists today's open follow-ups and viewings by time", () => {
  const data = {
    'Follow-ups': [
      { client_id: 'CL-1', next_action: 'Call back', due_date: `${TODAY} 10:30` },
      { client_id: 'CL-2', next_action: 'Send draft', due_date: TODAY },
      { client_id: 'CL-3', next_action: 'Done', due_date: TODAY, task_status: 'Completed' },
    ],
    Viewings: [{ client_id: 'CL-1', property_id: 'PR-1', appointment_date_time: `${TODAY} 09:00` }],
  };
  const rows = todayAgenda(data, TODAY);
  assert.deepEqual(
    rows.map((row) => [row.module, row.time, row.clientId]),
    [
      ['Viewings', '09:00', 'CL-1'],
      ['Follow-ups', '10:30', 'CL-1'],
      ['Follow-ups', '', 'CL-2'],
    ],
  );
});

test('the collected meter reads received against what is due', () => {
  const team = { scope: 'team', teamTotals: { receivedFils: '300', outstandingFils: '700' } };
  assert.deepEqual(collectedShare(team), { receivedFils: 300n, dueFils: 1000n, percent: 30 });
  // The meter writes its amounts with the shared money formatter.
  assert.equal(formatAed(collectedShare(team).dueFils), 'AED 10.00');
  const own = {
    scope: 'own',
    statement: { totals: { receivedShareFils: '0', outstandingFils: '0' } },
  };
  assert.deepEqual(collectedShare(own), { receivedFils: 0n, dueFils: 0n, percent: 0 });
});
