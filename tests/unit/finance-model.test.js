import test from 'node:test';
import assert from 'node:assert/strict';
import { readFinanceOverview } from '../../src/features/server/finance/financeModel.js';
import { invalidFinanceMessage } from '../../src/features/server/finance/financeValues.js';

const person = (id, name) => ({ id, name });
const calculation = () => ({
  preview: false,
  revision: 1,
  grossFils: 436_667,
  partnerFils: 218_334,
  netFils: 218_333,
  vatFils: 0,
  companyFils: 109_167,
  splitSource: 'team_default',
  lines: [
    { role: 'primary', agent: person('u-sara', 'Sara'), shareBp: 5000, amountFils: 81_875 },
    { role: 'second', agent: person('u-omar', 'Omar'), shareBp: 2500, amountFils: 27_291 },
  ],
  adjusted: true,
});
const deal = () => ({
  id: 'd-1',
  version: 2,
  dealId: 'DL-001',
  assignee: person('u-sara', 'Sara'),
  clientId: 'CL-001',
  propertyId: null,
  dealType: 'Rental',
  stage: 'Completed',
  agreedValueFils: 8_733_333,
  feeBasis: 'percentage',
  feeRateBp: 500,
  fixedFeeFils: null,
  partnerShareBp: 5000,
  partnerName: 'Partner LLC',
  earnedOn: '2026-10-01',
  details: { notes: 'Signed' },
  secondAgent: { id: 'u-omar', name: 'Omar', shareBp: 2500 },
  override: { agentShareBp: 5000, reason: 'Private reason' },
  calculation: calculation(),
  receivedFils: 100_000,
  outstandingFils: 118_333,
  paymentStatus: 'outstanding',
  allowed: { edit: true, earn: 'true' },
});
const decided = { status: 'approved', decidedBy: person('u-admin', 'Aidah'), reason: null };
const payment = () => ({
  ...{ id: 'p-1', version: 1, paymentId: 'PM-001', dealId: 'DL-001', receiptDate: '2026-10-02' },
  ...{ amountFils: 2_450_000, vatFils: 122_500, totalFils: 2_572_500, reference: null },
  ...{ notes: null, submittedBy: person('u-sara', 'Sara'), decidedAt: 'now', allowed: {} },
  ...decided,
});
const expense = () => ({
  ...{ id: 'e-1', version: 1, expenseId: 'EX-001', datePaid: '2026-10-03', amountFils: 5_000 },
  ...{ incurredBy: person('u-sara', 'Sara'), submittedBy: person('u-sara', 'Sara') },
  ...{ status: 'rejected', reason: 'Missing receipt', receiptUrl: 'http://example.com/r' },
});
const settings = { version: 3, agentShareBp: 5000, secondAgentSource: 'first_agent' };
const overview = (scope) => ({
  scope,
  settings: { ...settings, maxReferralShareBp: 0, vatRegistered: false, vatRateBp: 500, trn: null },
  myAgreements: [{ id: 'a-1', agentShareBp: 6000, effectiveFrom: '2026-01-01', effectiveTo: null }],
  deals: [deal()],
  payments: [payment()],
  expenses: [expense()],
  statement: {
    lines: [
      ...[{ dealId: 'DL-001', earnedOn: '2026-10-01', dealType: 'Rental', role: 'second' }],
    ].map((line) => ({
      ...line,
      amountFils: 27_291,
      receivedShareFils: 12_499,
      outstandingFils: 14_792,
    })),
    totals: { earnedFils: 27_291, receivedShareFils: 12_499, outstandingFils: 14_792 },
  },
  teamTotals: {
    ...{ grossFils: 436_667, partnerFils: 218_334, netFils: 218_333, companyFils: 109_167 },
    ...{ vatFils: 0, receivedFils: 100_000, outstandingFils: 118_333, expensesApprovedFils: 0 },
    pendingCount: 2,
    byAgent: [{ agent: person('u-sara', 'Sara'), earnedFils: 81_875, receivedShareFils: 37_500 }],
  },
  references: { Clients: [{ client_id: 'CL-001', full_name: 'Amal' }], Properties: [] },
});

test('the team overview keeps the whole split, team settings and team totals', () => {
  const model = readFinanceOverview(overview('team'));
  const [view] = model.deals;
  assert.equal(model.scope, 'team');
  assert.equal(model.settings.agentShareBp, 5000);
  assert.equal(view.calculation.companyFils, 109_167);
  assert.equal(view.calculation.lines.length, 2);
  assert.equal(view.calculation.splitSource, 'team_default');
  assert.deepEqual(view.override, { agentShareBp: 5000, reason: 'Private reason' });
  assert.deepEqual(view.allowed, { ...view.allowed, edit: true, earn: false, delete: false });
  assert.equal(model.teamTotals.pendingCount, 2);
  assert.equal(model.statement.lines[0].shareBp, null);
  assert.equal(model.expenses[0].receiptUrl, null, 'http receipt links are dropped');
  assert.deepEqual(model.references.Clients, [{ id: 'CL-001', name: 'Amal' }]);
});

test('the own overview never keeps team-only figures even when a response carries them', () => {
  const model = readFinanceOverview(overview('own'));
  const [view] = model.deals;
  assert.deepEqual(model.settings, { vatRegistered: false, vatRateBp: 500, trn: null });
  assert.equal(model.teamTotals, null);
  assert.equal(view.calculation.companyFils, null);
  assert.equal(view.calculation.splitSource, null);
  assert.deepEqual(
    view.calculation.lines.map((line) => line.role),
    ['primary'],
  );
  assert.equal(view.override, null);
  assert.deepEqual(view.secondAgent, { id: null, name: 'Omar', shareBp: null });
  assert.equal(JSON.stringify(model).includes('Private reason'), false);
  assert.equal(JSON.stringify(model).includes('109167'), false);
});

const rejects = (change, label) => {
  const body = overview('team');
  change(body);
  assert.throws(() => readFinanceOverview(body), { message: invalidFinanceMessage }, label);
};

test('money must be a safe whole number of fils within range (§13 L-F3)', () => {
  for (const bad of [1.5, '2450000', -1, 10_000_000_000_001, 2 ** 53, Number.MAX_SAFE_INTEGER + 2])
    rejects((body) => (body.payments[0].amountFils = bad), `payment ${bad}`);
  const parsed = JSON.parse('{"value": 9007199254740993}').value;
  rejects((body) => (body.deals[0].agreedValueFils = parsed), 'precision-lost JSON integer');
  rejects((body) => (body.teamTotals.grossFils = 2 ** 53), 'unsafe total');
  rejects((body) => (body.statement.totals.earnedFils = 0.5), 'fractional total');
  rejects((body) => (body.deals[0].partnerShareBp = 10_001), 'share over 100%');
  rejects((body) => (body.deals[0].feeRateBp = 2.5), 'fractional share');
  rejects((body) => (body.deals[0].version = 0), 'version');
});

test('inconsistent or malformed views reject the whole overview', () => {
  rejects((body) => (body.payments[0].totalFils = 2_572_501), 'payment total');
  rejects((body) => (body.deals[0].calculation.companyFils = 109_168), 'net split');
  rejects((body) => (body.deals[0].calculation.partnerFils = 1), 'gross split');
  rejects((body) => (body.deals[0].feeRateBp = null), 'percentage fee without a rate');
  rejects((body) => body.deals.push(deal()), 'duplicate deal');
  rejects((body) => (body.deals[0].stage = 'Won'), 'stage');
  rejects((body) => (body.payments[0].status = 'draft'), 'status');
  rejects((body) => (body.deals[0].details = { notes: 5 }), 'details text');
  rejects((body) => (body.scope = 'none'), 'scope');
  rejects((body) => delete body.statement, 'statement');
  assert.throws(() => readFinanceOverview(null), { message: invalidFinanceMessage });
});
