import test from 'node:test';
import assert from 'node:assert/strict';
import { previewDeal, previewShare } from '../../src/lib/finance/preview.js';
import {
  appendedColumns,
  financeColumns,
  financeExportRows,
} from '../../src/features/server/finance/financeColumns.js';
import { dealsColumns } from '../../src/data/schemas/deals.js';

const g2 = { feeBasis: 'percentage', agreedValueFils: 8_733_333, feeRateBp: 500 };
const agreements = [
  { id: 'A1', agentShareBp: 6000, effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' },
  { id: 'A2', agentShareBp: 6500, effectiveFrom: '2026-07-01', effectiveTo: null },
];

test('the editor estimate mirrors the golden G2/G3 split when every input is visible', () => {
  const deal = { ...g2, partnerShareBp: 5000 };
  const team = { teamDefaultBp: 5000, hasSecond: true, secondShareBp: 2500, vatRegistered: false };
  const first = previewDeal(deal, { ...team, secondSource: 'first_agent' });
  assert.deepEqual(first, {
    grossFils: 436_667,
    partnerFils: 218_334,
    netFils: 218_333,
    vatFils: 0,
    split: {
      agentShareBp: 5000,
      splitSource: 'team_default',
      agreementId: null,
      primaryFils: 81_875,
      secondFils: 27_291,
      companyFils: 109_167,
    },
  });
  const company = previewDeal(deal, { ...team, secondSource: 'company' });
  assert.deepEqual([company.split.primaryFils, company.split.companyFils], [109_166, 81_876]);
});

test('the estimate never guesses a split the caller cannot see', () => {
  const own = previewDeal(g2, { agreements, on: '2025-12-31' });
  assert.equal(own.split, null, 'no agreement in force and no team default');
  assert.equal(own.vatFils, null, 'settings unknown');
  const secondHidden = previewDeal(g2, { agreements, on: '2026-08-01', hasSecond: true });
  assert.equal(secondHidden.split, null);
  const agreed = previewDeal(g2, { agreements, on: '2026-07-01', vatRegistered: true });
  assert.deepEqual([agreed.split.splitSource, agreed.split.agreementId], ['agreement', 'A2']);
  assert.equal(agreed.vatFils, 21_833);
  assert.deepEqual(previewShare({ ownerHeld: true }), {
    agentShareBp: null,
    splitSource: 'owner',
    agreementId: null,
  });
  assert.equal(previewShare({ overrideBp: 8000, teamDefaultBp: 5000 }).splitSource, 'override');
  assert.equal(previewDeal({ feeBasis: 'percentage', agreedValueFils: 1.5, feeRateBp: 1 }), null);
  assert.equal(previewDeal({ feeBasis: 'fixed', fixedFeeFils: null }), null);
});

const view = (team) => ({
  dealId: 'DL-001',
  assignee: { id: 'u-sara', name: 'Sara' },
  clientId: 'CL-001',
  propertyId: null,
  dealType: 'Sale',
  stage: 'Completed',
  agreedValueFils: 245_000_000,
  feeBasis: 'percentage',
  feeRateBp: 200,
  fixedFeeFils: null,
  partnerShareBp: 0,
  earnedOn: '2026-10-01',
  details: { notes: 'Signed SPA', payment_due: '2026-11-01' },
  secondAgent: null,
  calculation: {
    preview: false,
    grossFils: 4_900_000,
    partnerFils: 0,
    netFils: 4_900_000,
    vatFils: 245_000,
    companyFils: team ? 1_960_000 : null,
    lines: [{ role: 'primary', amountFils: 2_940_000 }],
    adjusted: false,
    splitSource: team ? 'agreement' : null,
  },
  receivedFils: 2_450_000,
  outstandingFils: 2_450_000,
  paymentStatus: 'outstanding',
});

test('the export map keeps workbook order, appends connected columns and writes exact AED', () => {
  const names = financeColumns.Deals.map((column) => column.name);
  assert.deepEqual(names, [...dealsColumns.map((c) => c.name), ...appendedColumns.Deals]);
  const [team] = financeExportRows('Deals', [view(true)]);
  assert.equal(team['Agreed value AED'], '2450000.00');
  assert.equal(team['Fee rate %'], '2');
  assert.equal(team['Your share %'], '40', 'team view: the company line');
  assert.equal(team['Your earned fee AED'], '19600.00');
  assert.equal(team['Company share AED'], '19600.00');
  assert.equal(team['Agent commission AED'], '29400.00');
  assert.equal(team['VAT AED'], '2450.00');
  assert.equal(team['Split source'], 'Agreement');
  assert.equal(team['Payment due'], '2026-11-01');
  assert.equal(team.Notes, 'Signed SPA');
  assert.equal(team['Payment status'], 'Outstanding');
  const [own] = financeExportRows('Deals', [view(false)]);
  assert.equal(own['Your share %'], '60', 'own view: the caller line');
  assert.equal(own['Your expected fee AED'], '29400.00');
  assert.equal(own['Company share AED'], '');
  assert.equal(own['Split source'], '');
  const payment = {
    ...{ paymentId: 'PM-1', dealId: 'DL-001', receiptDate: '2026-10-02', amountFils: 2_450_000 },
    ...{ vatFils: 122_500, totalFils: 2_572_500, reference: null, notes: null, status: 'void' },
    ...{ submittedBy: { id: 'u', name: 'Sara' }, decidedBy: null, reason: 'Duplicate' },
  };
  const [row] = financeExportRows('Payments', [payment]);
  assert.equal(row['Total received AED'], '25725.00');
  assert.deepEqual(
    appendedColumns.Payments.map((name) => row[name]),
    ['Voided', 'Sara', '', 'Duplicate'],
  );
  assert.throws(() => financeExportRows('Clients', []), /No finance export map/);
});
