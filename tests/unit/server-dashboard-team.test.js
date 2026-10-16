import test from 'node:test';
import assert from 'node:assert/strict';
import { teamRows } from '../../src/features/server/dashboard/sectionsModel.js';

test('team rows come only from a team-scope overview and the targets returned', () => {
  const agent = (id, name) => ({ id, name });
  const line = (id, amountFils) => ({ agent: agent(id, id), amountFils });
  const overview = {
    scope: 'team',
    teamTotals: {
      byAgent: [
        { agent: agent('a', 'Amal'), earnedFils: 100, receivedShareFils: 40 },
        { agent: agent('b', 'Badr'), earnedFils: 300, receivedShareFils: 0 },
      ],
    },
    deals: [
      {
        assignee: agent('a'),
        earnedOn: '2026-10-02',
        calculation: { preview: false, lines: [line('a', 60)] },
      },
      {
        assignee: agent('b'),
        earnedOn: '2026-09-02',
        calculation: { preview: false, lines: [line('b', 300)] },
      },
      { assignee: agent('b'), earnedOn: null, calculation: null },
    ],
  };
  const targets = [{ metric: 'fees', memberId: 'a', value: 120 }];
  const rows = teamRows(overview, targets, '2026-10');
  assert.deepEqual(
    rows.map((row) => [
      row.name,
      row.deals,
      row.earnedFils,
      row.receivedFils,
      row.monthFils,
      row.targetFils,
    ]),
    [
      ['Badr', 2, 300, 0, 0, null],
      ['Amal', 1, 100, 40, 60, 120],
    ],
  );
  assert.deepEqual(
    teamRows({ ...overview, scope: 'own', teamTotals: null }, targets, '2026-10'),
    [],
  );
  assert.deepEqual(teamRows(null, targets, '2026-10'), []);
});
