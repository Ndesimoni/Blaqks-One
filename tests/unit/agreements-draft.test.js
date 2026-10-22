import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftFromTerms,
  emptyDraft,
  endOfDubaiDay,
  expiryDay,
  expiryRange,
  generatedRef,
  withKind,
} from '../../src/features/server/agreements/agreementDraft.js';
import {
  previewTerms,
  readDraft,
  readShare,
  stepErrors,
} from '../../src/features/server/agreements/readDraft.js';

const today = '2026-10-22';
const filled = (changes = {}) => ({
  ...emptyDraft('co_broking', today, 1_760_000_000_000),
  area: '  Dubai Marina ',
  bedrooms: '2',
  sizeSqft: '1100',
  askingPrice: '2,100,000',
  clientName: 'Synthetic A.',
  amount: '52500',
  senderShare: '40',
  ...changes,
});

test('percentages become basis points per type, without floats or rounding', () => {
  assert.deepEqual(readShare('co_broking', '40'), { value: 4000 });
  assert.deepEqual(readShare('co_broking', '33.33%'), { value: 3333 });
  assert.deepEqual(readShare('co_broking', '0.01'), { value: 1 });
  assert.deepEqual(readShare('co_broking', '99.99'), { value: 9999 });
  assert.deepEqual(readShare('co_broking', '100'), { error: 'shareCoBroking' });
  assert.deepEqual(readShare('co_broking', '0'), { error: 'shareCoBroking' });
  assert.deepEqual(readShare('co_broking', '12.345'), { error: 'shareCoBroking' });
  assert.deepEqual(readShare('handover_referral', '50'), { value: 5000 });
  assert.deepEqual(readShare('handover_referral', '50.01'), { error: 'shareReferral' });
  assert.deepEqual(readShare('handover_referral', ''), { error: 'required' });
  assert.deepEqual(readShare('handover_full', 'anything'), { value: 0 });
});

test('a complete draft becomes the server terms in fils and basis points', () => {
  const { terms, errors } = readDraft(filled(), today);
  assert.deepEqual(errors, {});
  assert.deepEqual(terms, {
    property: {
      emirate: 'Dubai',
      area: 'Dubai Marina',
      propertyType: 'Apartment',
      bedrooms: 2,
      sizeSqft: 1100,
      askingPriceFils: 210_000_000,
      listingRef: 'AG-' + (1_760_000_000_000).toString(36).toUpperCase().slice(-6),
    },
    client: { displayName: 'Synthetic A.', contact: null },
    money: {
      basis: 'commission',
      amountFils: 5_250_000,
      senderShareBp: 4000,
      paymentExpectation: 'on_transfer',
    },
    expiresAt: '2026-11-05T19:59:59Z',
    governingEmirate: 'Dubai',
    notes: null,
  });
  assert.equal(previewTerms('co_broking', terms).money.recipientShareBp, 6000);
});

test('invalid fields are named with a reason and grouped by step', () => {
  const { terms, errors } = readDraft(
    filled({
      area: '',
      bedrooms: '2.5',
      askingPrice: '0',
      shareContact: true,
      contact: ' ',
      amount: '1.234',
      expiresOn: today,
      notes: 'x'.repeat(2001),
    }),
    today,
  );
  assert.equal(terms, null);
  assert.deepEqual(errors.area, { error: 'required' });
  assert.deepEqual(errors.bedrooms, { error: 'whole', max: 20 });
  assert.deepEqual(errors.askingPrice, { error: 'amount' });
  assert.deepEqual(errors.contact, { error: 'required' });
  assert.deepEqual(errors.amount, { error: 'amount' });
  assert.deepEqual(errors.expiresOn, { error: 'expiry' });
  assert.deepEqual(errors.notes, { error: 'tooLong', max: 2000 });
  assert.deepEqual(Object.keys(stepErrors(errors, 'subject')).sort(), [
    'area',
    'askingPrice',
    'bedrooms',
    'contact',
  ]);
  assert.deepEqual(Object.keys(stepErrors(errors, 'money')).sort(), [
    'amount',
    'expiresOn',
    'notes',
  ]);
});

test('offer end days run from tomorrow to 89 days ahead, ending at Dubai midnight', () => {
  assert.deepEqual(expiryRange(today), { min: '2026-10-23', max: '2027-01-19' });
  assert.equal(endOfDubaiDay('2026-11-05'), '2026-11-05T19:59:59Z');
  assert.equal(expiryDay('2026-11-05T19:59:59Z'), '2026-11-05');
  assert.equal(expiryDay(null), '');
  assert.ok(readDraft(filled({ expiresOn: '2027-01-19' }), today).terms);
  assert.equal(
    readDraft(filled({ expiresOn: '2027-01-20' }), today).errors.expiresOn.error,
    'expiry',
  );
});

test('revisions start from the frozen terms and keep a usable offer end day', () => {
  const { terms } = readDraft(filled({ shareContact: true, contact: 'Email only' }), today);
  const stored = previewTerms('co_broking', terms);
  const draft = draftFromTerms('co_broking', stored, today);
  assert.equal(draft.askingPrice, '2100000.00');
  assert.equal(draft.amount, '52500.00');
  assert.equal(draft.senderShare, '40');
  assert.equal(draft.contact, 'Email only');
  assert.equal(draft.shareContact, true);
  assert.equal(draft.expiresOn, '2026-11-05');
  assert.deepEqual(readDraft(draft, today).terms, terms);
  const lapsed = draftFromTerms(
    'co_broking',
    { ...stored, expiresAt: '2026-10-22T10:00:00Z' },
    today,
  );
  assert.equal(lapsed.expiresOn, '2026-11-05');
});

test('a type change resets the share, and listing labels never reuse a record ID', () => {
  assert.equal(withKind(filled(), 'handover_full').senderShare, '0');
  assert.equal(withKind(filled(), 'handover_referral').senderShare, '25');
  assert.equal(withKind(filled(), 'handover_referral').area, '  Dubai Marina ');
  assert.match(generatedRef(1_760_000_000_000), /^AG-[0-9A-Z]{6}$/);
});
