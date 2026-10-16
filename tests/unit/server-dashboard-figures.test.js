import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../../src/features/server/dashboard/keyFiguresModel.js';
import {
  agendaFollowUps,
  dayLabel,
  followUpWhen,
} from '../../src/features/server/dashboard/agendaModel.js';

const today = '2026-10-16';
const deal = (stage, earnedOn = null, grossFils = 0, preview = false) => ({
  stage,
  earnedOn,
  calculation: { grossFils, preview, lines: [] },
});

test('weekly and daily counts use Dubai calendar days inside their window only', () => {
  const days = [
    '2026-10-16',
    '2026-10-10',
    '2026-10-09',
    '2026-08-22',
    '2026-08-21',
    '',
    '2026-10-17',
  ];
  assert.deepEqual(model.weeklyCounts(days, today), [1, 0, 0, 0, 0, 0, 1, 2]);
  assert.deepEqual(
    model.dailyCounts(['2026-10-16', '2026-10-18', '2026-10-18', '2026-10-23'], today),
    [1, 0, 2, 0, 0, 0, 0],
  );
});

test('due follow-ups split into overdue and due today', () => {
  const due = [{ due_date: '2026-10-16' }, { due_date: '2026-01-01' }, { due_date: '2026-10-15' }];
  assert.deepEqual(model.followUpSplit(due, today), { overdue: 2, today: 1 });
});

test('listing status and open deal groups count only what the session holds', () => {
  const listings = [
    { listing_status: 'Available' },
    { listing_status: 'available' },
    { listing_status: 'Under offer' },
    { listing_status: 'Sold' },
    {},
  ];
  assert.deepEqual(
    model.propertyStatus(listings).map((row) => row.value),
    [2, 1, 2],
  );
  const open = model.openDeals([
    deal('New'),
    deal('Offer'),
    deal('Negotiation'),
    deal('Documentation'),
    deal('On hold'),
    deal('Completed'),
    deal('Lost'),
    deal('Cancelled'),
  ]);
  assert.equal(open.count, 5);
  assert.deepEqual(
    open.segments.map((row) => [row.name, row.value]),
    [
      ['Early', 1],
      ['Negotiating', 2],
      ['Contract', 1],
      ['On hold', 1],
    ],
  );
});

test('fees this month: team gross of earned deals; own commission statement lines only', () => {
  const team = {
    scope: 'team',
    deals: [
      deal('Completed', '2026-10-02', 500_000),
      deal('Completed', '2026-10-05', 900_000, true),
      deal('Completed', '2026-09-30', 700_000),
      { stage: 'Offer', earnedOn: null, calculation: null },
    ],
  };
  assert.equal(model.feesInMonth(team, '2026-10'), 500_000);
  const own = {
    scope: 'own',
    deals: team.deals,
    statement: {
      lines: [
        { earnedOn: '2026-10-02', amountFils: 120_000 },
        { earnedOn: '2026-09-02', amountFils: 80_000 },
      ],
    },
  };
  assert.equal(model.feesInMonth(own, '2026-10'), 120_000);
});

test('the fees target follows the finance scope shown', () => {
  const targets = [
    { metric: 'fees', memberId: null, value: 1_000_000 },
    { metric: 'fees', memberId: 'me', value: 300_000 },
    { metric: 'deals', memberId: 'me', value: 4 },
  ];
  assert.equal(model.feesTarget(targets, 'team', 'me'), 1_000_000);
  assert.equal(model.feesTarget(targets, 'own', 'me'), 300_000);
  assert.equal(model.feesTarget(targets, 'own', 'other'), null);
  assert.equal(model.feesTarget([{ metric: 'fees', memberId: null, value: 0 }], 'team'), null);
});

test('compact AED keeps one decimal and its unit', () => {
  assert.deepEqual(model.compactAed(386_000_000_0), { figure: '38.6', unit: 'M AED' });
  assert.deepEqual(model.compactAed(1_250_000), { figure: '12.5', unit: 'K AED' });
  assert.deepEqual(model.compactAed(500_050), { figure: '5,001', unit: 'AED' });
  assert.equal(model.axisAed(50_000_000), '500K');
  assert.equal(model.axisAed(0), '0');
});

test('agenda labels and order: due first, then the next open follow-ups', () => {
  assert.equal(dayLabel('2026-10-16 09:00', today), 'Today');
  assert.equal(dayLabel('2099-01-15 14:30', today), '15 Jan');
  assert.equal(dayLabel('', today), '');
  assert.deepEqual(followUpWhen({ due_date: '2026-10-01' }, today), {
    label: 'Overdue',
    overdue: true,
    detail: '1 Oct',
  });
  assert.deepEqual(followUpWhen({}, today), { label: 'No date', overdue: false });
  const due = { id: 'due', due_date: '2000-01-01' };
  const later = { id: 'later', due_date: '2999-01-01' };
  const ids = agendaFollowUps({ dueTasks: [due], tasks: [later, due] }).map((task) => task.id);
  assert.deepEqual(ids, ['due', 'later']);
});
