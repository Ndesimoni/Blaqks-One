import test from 'node:test';
import assert from 'node:assert/strict';
import { dealColumns, stageMoveBody } from '../../src/features/server/finance/dealBoardModel.js';
import { dealBodyFromDraft, draftFromDeal } from '../../src/features/server/finance/dealDraft.js';
import { dealStages } from '../../src/features/server/finance/dealModel.js';

const deal = {
  id: 'deal-uuid-1',
  dealId: 'DL-0001',
  clientId: 'CL-001',
  propertyId: 'PR-007',
  dealType: 'Sale',
  stage: 'Viewing',
  agreedValueFils: 245_000_050,
  feeBasis: 'percentage',
  feeRateBp: 200,
  fixedFeeFils: null,
  partnerShareBp: 2500,
  partnerName: 'Synthetic Partner Realty',
  details: { 'Viewing notes': 'Liked the view', empty: ' ' },
  version: 4,
  earnedOn: null,
  assignee: { id: 'member-1', name: 'Synthetic Agent' },
  allowed: { edit: true },
};

test('the pipeline has one column per deal stage and places every deal once', () => {
  const deals = [deal, { ...deal, id: 'deal-uuid-2', stage: 'Offer' }];
  const columns = dealColumns(deals);
  assert.deepEqual(
    columns.map((column) => column.key),
    dealStages,
  );
  assert.equal(columns.flatMap((column) => column.items).length, deals.length);
  assert.deepEqual(columns.find((column) => column.key === 'Offer').items, [deals[1]]);
  assert.equal(columns.find((column) => column.key === 'Lost').tone, 'muted');
  assert.match(columns.find((column) => column.key === 'Viewing').summary, /^1 · AED /);
  assert.deepEqual(
    dealColumns(deals, 'Offer').map((column) => column.key),
    ['Offer'],
  );
});

test('a stage move sends the editor body with only the stage changed', () => {
  const unchanged = dealBodyFromDraft(draftFromDeal(deal)).body;
  const moved = stageMoveBody(deal, 'Negotiation');
  assert.deepEqual(moved, { ...unchanged, stage: 'Negotiation' });
  assert.equal(moved.agreedValueFils, deal.agreedValueFils);
  assert.equal(moved.feeRateBp, deal.feeRateBp);
  assert.equal(moved.partnerShareBp, deal.partnerShareBp);
  assert.deepEqual(moved.details, { 'Viewing notes': 'Liked the view' });
});

test('no move body for the same stage, an unknown stage or a deal that no longer validates', () => {
  assert.equal(stageMoveBody(deal, 'Viewing'), null);
  assert.equal(stageMoveBody(deal, 'Imaginary'), null);
  assert.equal(stageMoveBody({ ...deal, clientId: '' }, 'Offer'), null);
});
