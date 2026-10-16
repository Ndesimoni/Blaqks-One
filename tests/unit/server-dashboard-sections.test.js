import test from 'node:test';
import assert from 'node:assert/strict';
import { feesSeries, monthlyTotals } from '../../src/features/server/dashboard/feesModel.js';
import { financeRing } from '../../src/features/server/dashboard/financeDashboard.js';
import { pipelineRows, sourceRows } from '../../src/features/server/dashboard/sectionsModel.js';

const payment = (status, receiptDate, amountFils) => ({ status, receiptDate, amountFils });

test('team fees by month count approved payments only, excluding VAT', () => {
  const overview = {
    scope: 'team',
    payments: [
      payment('approved', '2026-10-03', 100_000),
      payment('approved', '2026-10-20', 50_000),
      payment('pending', '2026-10-04', 999_000),
      payment('rejected', '2026-09-04', 999_000),
      payment('void', '2026-09-04', 999_000),
      payment('approved', '2025-10-11', 40_000),
      payment('approved', '2024-01-01', 70_000),
    ],
    statement: { lines: [] },
    deals: [
      { stage: 'Completed', earnedOn: '2026-10-02', details: {} },
      { stage: 'Completed', earnedOn: '2026-09-28', details: { closed_date: '2026-10-01' } },
      { stage: 'Completed', earnedOn: '2026-09-02', details: {} },
      { stage: 'Offer', earnedOn: null, details: {} },
    ],
  };
  const series = feesSeries(overview, '2026-10');
  assert.equal(series.points.length, 12);
  assert.equal(series.points[0].month, '2025-11');
  assert.equal(series.latest.month, '2026-10');
  assert.equal(series.latest.current, 150_000);
  assert.equal(series.latest.previous, 40_000);
  assert.equal(series.total, 150_000);
  assert.equal(series.previousTotal, 40_000);
  assert.equal(series.change, 275);
  assert.equal(series.latest.closed, 2);
  assert.equal(series.empty, false);
  assert.equal(
    series.points.reduce((sum, point) => sum + point.current, 0),
    150_000,
  );
});

test('own fees use the caller’s statement lines and never team payments', () => {
  const overview = {
    scope: 'own',
    payments: [payment('approved', '2026-10-03', 5_000_000)],
    statement: {
      lines: [
        { earnedOn: '2026-10-02', amountFils: 120_000 },
        { earnedOn: '2026-03-09', amountFils: 30_000 },
      ],
    },
  };
  const totals = monthlyTotals(overview, ['2026-10', '2026-03']);
  assert.deepEqual(totals, { '2026-10': 120_000, '2026-03': 30_000 });
  const series = feesSeries(overview, '2026-10');
  assert.equal(series.change, null);
  assert.equal(series.team, false);
  assert.ok(feesSeries({ ...overview, statement: { lines: [] } }, '2026-10').empty);
});

test('the finance ring: team totals with net received; own share without company figures', () => {
  const teamTotals = {
    receivedFils: 1_000_000,
    outstandingFils: 400_000,
    expensesApprovedFils: 300_000,
  };
  const team = financeRing({ scope: 'team', teamTotals });
  assert.deepEqual(
    team.segments.map((part) => part.value),
    [1_000_000, 400_000, 300_000],
  );
  assert.deepEqual(team.centre, { label: 'Net received', value: 700_000 });
  const own = financeRing({
    scope: 'own',
    teamTotals: null,
    statement: { totals: { earnedFils: 900, receivedShareFils: 500, outstandingFils: 400 } },
  });
  assert.deepEqual(
    own.segments.map((part) => [part.name, part.value]),
    [
      ['Received share', 500],
      ['Outstanding', 400],
    ],
  );
  assert.ok(!JSON.stringify(own).match(/company|expenses|Net/i));
});

test('lead sources total every client; closed leads are counted per source', () => {
  const clients = [
    { lead_source: 'Bayut', lead_stage: 'Closed' },
    { lead_source: 'Bayut', lead_stage: 'New' },
    { lead_source: 'Referral', lead_stage: 'Qualified' },
    { lead_source: 'Flyer', lead_stage: 'Closed' },
    { lead_stage: 'New' },
  ];
  const rows = sourceRows(clients);
  assert.deepEqual(
    rows.map((row) => [row.name, row.count, row.share, row.closed, row.tone]),
    [
      ['Bayut', 2, 40, 1, 'accent'],
      ['Referral', 1, 20, 0, 'blue'],
      ['Other', 1, 20, 1, 'muted'],
      ['Not recorded', 1, 20, 0, 'muted'],
    ],
  );
  assert.deepEqual(sourceRows([]), []);
  assert.deepEqual(
    pipelineRows([
      { name: 'New', count: 2 },
      { name: 'Closed', count: 1 },
      { name: 'Lost', count: 1 },
    ]).map((row) => row.tone),
    ['blue', 'accent', 'muted'],
  );
});
