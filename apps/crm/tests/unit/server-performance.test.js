import test from 'node:test';
import assert from 'node:assert/strict';
import {
  financeActuals,
  financeCovers,
  monthsEnding,
  performanceRows,
  performanceSelection,
  visibleMetrics,
} from '../../src/features/server/performance/performanceModel.js';

const months = monthsEnding('2026-10', 3);
const data = {
  Clients: [{ date_added: '2026-10-02' }, { date_added: '2026-09-30' }, { date_added: '' }],
  Viewings: [
    { appointment_date_time: '2026-10-05T10:00', viewing_status: 'Completed' },
    { appointment_date_time: '2026-10-06T10:00', viewing_status: 'Scheduled' },
    { appointment_date_time: '2025-10-06T10:00', viewing_status: 'Completed' },
  ],
};
const line = (agent, amountFils) => ({ role: 'primary', agent: { id: agent }, amountFils });
const deal = (assignee, stage, earnedOn, grossFils, lines, details = {}) => ({
  assignee: { id: assignee, name: assignee },
  stage,
  earnedOn,
  details,
  calculation: { preview: !earnedOn, grossFils, lines },
});
const teamOverview = {
  scope: 'team',
  statement: { lines: [] },
  deals: [
    deal('amy', 'Completed', '2026-10-03', 1_000_000, [line('amy', 400_000), line('ben', 100_000)]),
    deal('ben', 'Completed', null, 900_000, [line('ben', 300_000)], { closed_date: '2026-09-20' }),
    deal('ben', 'Offer', '2026-08-01', 500_000, [line('ben', 250_000)]),
  ],
};

test('the selection follows record scope and the Assigned-to filter', () => {
  assert.deepEqual(performanceSelection('assigned', 'x', 'me'), { kind: 'member', memberId: 'me' });
  assert.deepEqual(performanceSelection('team', '', 'me'), { kind: 'team', memberId: null });
  assert.deepEqual(performanceSelection('team', 'queue', 'me'), { kind: 'queue', memberId: null });
  assert.deepEqual(performanceSelection('team', 'ben', 'me'), { kind: 'member', memberId: 'ben' });
});

test('finance figures appear only when the finance view covers the selection', () => {
  const team = { kind: 'team', memberId: null };
  const me = { kind: 'member', memberId: 'me' };
  const other = { kind: 'member', memberId: 'ben' };
  assert.ok(financeCovers({ scope: 'team' }, team, 'me'));
  assert.ok(financeCovers({ scope: 'team' }, other, 'me'));
  assert.ok(!financeCovers({ scope: 'team' }, { kind: 'queue', memberId: null }, 'me'));
  assert.ok(financeCovers({ scope: 'own' }, me, 'me'));
  assert.ok(!financeCovers({ scope: 'own' }, team, 'me'), 'own finance never shows team money');
  assert.ok(!financeCovers({ scope: 'own' }, other, 'me'));
  assert.ok(!financeCovers({ scope: 'none' }, me, 'me'));
  assert.deepEqual(
    visibleMetrics(false).map((metric) => metric.key),
    ['enquiries', 'viewings'],
  );
  assert.equal(visibleMetrics(true).length, 4);
});

test('months end with the chosen month across year boundaries', () => {
  assert.deepEqual(monthsEnding('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(monthsEnding('2026-10').length, 12);
});

test('record actuals count enquiries and completed viewings by month', () => {
  const rows = performanceRows(data, null, { kind: 'team' }, months, false);
  assert.deepEqual(rows, [
    { month: '2026-08', enquiries: 0, viewings: 0, deals: null, fees: null },
    { month: '2026-09', enquiries: 1, viewings: 0, deals: null, fees: null },
    { month: '2026-10', enquiries: 1, viewings: 1, deals: null, fees: null },
  ]);
});

test('team fees are gross earned fees; a member’s fees are their commission lines', () => {
  const team = financeActuals(teamOverview, { kind: 'team', memberId: null }, months);
  assert.deepEqual(team.deals, { '2026-08': 0, '2026-09': 1, '2026-10': 1 });
  assert.deepEqual(team.fees, { '2026-08': 500_000, '2026-09': 0, '2026-10': 1_000_000 });
  const ben = financeActuals(teamOverview, { kind: 'member', memberId: 'ben' }, months);
  assert.deepEqual(ben.deals, { '2026-08': 0, '2026-09': 1, '2026-10': 0 });
  assert.deepEqual(ben.fees, { '2026-08': 250_000, '2026-09': 0, '2026-10': 100_000 });
});

test('the own view uses the caller’s statement lines, never team totals', () => {
  const own = {
    scope: 'own',
    deals: [
      deal('me', 'Completed', '2026-10-01', 9_999_999, [
        { role: 'primary', agent: null, amountFils: 1 },
      ]),
    ],
    statement: {
      lines: [
        { earnedOn: '2026-10-01', amountFils: 300_000 },
        { earnedOn: '2026-09-11', amountFils: 50_000 },
      ],
    },
  };
  const result = financeActuals(own, { kind: 'member', memberId: 'me' }, months);
  assert.deepEqual(result.fees, { '2026-08': 0, '2026-09': 50_000, '2026-10': 300_000 });
  assert.deepEqual(result.deals, { '2026-08': 0, '2026-09': 0, '2026-10': 1 });
  const rows = performanceRows(data, own, { kind: 'member', memberId: 'me' }, months, true);
  assert.equal(rows.at(-1).fees, 300_000);
});
