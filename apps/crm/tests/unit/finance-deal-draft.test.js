import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dealBodyFromDraft,
  dealCapMessage,
  draftChanged,
  draftFromDeal,
  requiredMessages,
  stepErrors,
} from '../../src/features/server/finance/dealDraft.js';
import { amountMessage, percentMessage } from '../../src/lib/finance/money.js';

const draft = (changes = {}) => ({
  ...draftFromDeal(null, 'CL-1'),
  agreedValue: '2,450,000',
  feeRate: '2',
  ...changes,
});

test('a draft becomes the exact deal body in integer fils and basis points', () => {
  const { body, errors } = dealBodyFromDraft(
    draft({
      partnerShare: '12.5',
      partnerName: '  Partner LLC ',
      details: { notes: 'Hi', x: ' ' },
    }),
  );
  assert.deepEqual(errors, {});
  assert.deepEqual(body, {
    clientId: 'CL-1',
    propertyId: null,
    dealType: 'Sale',
    stage: 'New',
    agreedValueFils: 245_000_000,
    feeBasis: 'percentage',
    feeRateBp: 200,
    fixedFeeFils: null,
    partnerShareBp: 1250,
    partnerName: 'Partner LLC',
    details: { notes: 'Hi' },
  });
  const fixed = dealBodyFromDraft(
    draft({ feeBasis: 'fixed', fixedFee: '49,000.05', feeRate: 'x' }),
  );
  assert.equal(fixed.body.fixedFeeFils, 4_900_005);
  assert.equal(fixed.body.feeRateBp, null, 'the unused basis is cleared, never validated');
});

test('invalid money and shares are refused, never rounded, and errors belong to their step', () => {
  const { body, errors } = dealBodyFromDraft(
    draft({ clientId: '', agreedValue: '1.005', feeRate: '101', partnerShare: '-1' }),
  );
  assert.equal(body, null);
  assert.deepEqual(errors, {
    clientId: requiredMessages.clientId,
    agreedValue: amountMessage,
    feeRate: percentMessage,
    partnerShare: percentMessage,
  });
  assert.equal(
    dealBodyFromDraft(draft({ agreedValue: '10000000000.01' })).errors.agreedValue,
    dealCapMessage,
  );
  assert.equal(
    dealBodyFromDraft(draft({ agreedValue: '' })).errors.agreedValue,
    requiredMessages.agreedValue,
  );
  assert.equal(
    dealBodyFromDraft(draft({ feeBasis: 'fixed' })).errors.fixedFee,
    requiredMessages.fixedFee,
  );
  const broken = draft({ clientId: '', agreedValue: 'abc' });
  assert.deepEqual(Object.keys(stepErrors(broken, 'parties')), ['clientId']);
  assert.deepEqual(Object.keys(stepErrors(broken, 'value')), ['agreedValue']);
  assert.deepEqual(stepErrors(broken, 'pipeline'), {});
  assert.equal(Object.keys(stepErrors(broken, 'review')).length, 2);
});

test('editing keeps hidden workbook details and shows stored values exactly', () => {
  const deal = {
    clientId: 'CL-2',
    propertyId: 'PR-1',
    dealType: 'Rental',
    stage: 'Offer',
    agreedValueFils: 12_000_001,
    feeBasis: 'fixed',
    feeRateBp: null,
    fixedFeeFils: 600_050,
    partnerShareBp: 0,
    partnerName: null,
    details: { record_check: 'OK', notes: 'Keep' },
  };
  const form = draftFromDeal(deal);
  assert.equal(form.agreedValue, '120000.01');
  assert.equal(form.fixedFee, '6000.50');
  assert.equal(form.partnerShare, '0');
  assert.deepEqual(dealBodyFromDraft(form).body.details, { record_check: 'OK', notes: 'Keep' });
  assert.equal(draftChanged(form, draftFromDeal(deal)), false);
  assert.equal(draftChanged({ ...form, stage: 'Lost' }, draftFromDeal(deal)), true);
});
