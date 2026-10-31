import test from 'node:test';
import assert from 'node:assert/strict';
import {
  financeFigures,
  ownPendingCount,
} from '../../src/features/server/dashboard/financeDashboard.js';
import { dashboardWidgets } from '../../src/features/server/dashboard/dashboardModel.js';

const entry = (status, submitter) => ({ status, submittedBy: { id: submitter, name: 'x' } });
const statement = {
  lines: [],
  totals: { earnedFils: 2_940_000, receivedShareFils: 600_000, outstandingFils: 2_340_000 },
};

test('the own view shows only statement totals and the caller’s pending submissions', () => {
  const overview = {
    scope: 'own',
    statement,
    teamTotals: null,
    payments: [entry('pending', 'me'), entry('approved', 'me'), entry('pending', 'admin')],
    expenses: [entry('pending', 'me'), entry('rejected', 'me')],
  };
  const figures = financeFigures(overview, 'me');
  assert.equal(figures.scope, 'own');
  assert.deepEqual(
    figures.tiles.map((tile) => [tile.id, tile.value]),
    [
      ['earned', 'AED 29,400.00'],
      ['received', 'AED 6,000.00'],
      ['outstanding', 'AED 23,400.00'],
    ],
  );
  assert.equal(ownPendingCount(overview, 'me'), 2);
  assert.equal(figures.pending.count, 2);
  assert.ok(!JSON.stringify(figures).match(/company|Fees earned|VAT/i));
});

test('the team view shows the server’s team totals as sent', () => {
  const teamTotals = {
    grossFils: 5_000_000,
    partnerFils: 100_000,
    netFils: 4_900_000,
    companyFils: 1_960_000,
    vatFils: 245_000,
    receivedFils: 1_000_000,
    outstandingFils: 3_900_000,
    expensesApprovedFils: 450_000,
    pendingCount: 3,
    byAgent: [],
  };
  const figures = financeFigures(
    { scope: 'team', statement, teamTotals, payments: [], expenses: [] },
    'me',
  );
  assert.deepEqual(
    figures.tiles.map((tile) => tile.value),
    [
      'AED 50,000.00',
      'AED 19,600.00',
      'AED 10,000.00',
      'AED 39,000.00',
      'AED 2,450.00',
      'AED 4,500.00',
    ],
  );
  assert.deepEqual(figures.pending, { count: 3, label: 'Awaiting approval' });
});

test('the finance widget needs Deals and effective finance access', () => {
  const finance = { scope: 'own', create: true };
  const staff = (modules, access) => ({
    roleId: 'staff',
    permissions: modules,
    financeAccess: access,
  });
  assert.equal(dashboardWidgets(staff({ finance: true }, finance)).finance, true);
  assert.equal(dashboardWidgets(staff({ finance: true }, null)).finance, false);
  assert.equal(dashboardWidgets(staff({ schedule: true }, finance)).finance, false);
});
