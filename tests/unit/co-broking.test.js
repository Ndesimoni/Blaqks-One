import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftFromTerms,
  shareDraft,
  shareOther,
} from '../../src/features/server/agreements/agreementDraft.js';
import { readDraft } from '../../src/features/server/agreements/readDraft.js';
import {
  readCoBroking,
  readCoBrokingProperty,
} from '../../src/features/server/listingShares/coBrokingModel.js';

// Co-broking from a listing share (docs/record-sharing.md R2).
const today = '2026-10-23';
const ID = '6f1c2a34-8b9d-4e0f-a123-456789abcdef';
const property = {
  emirate: 'Dubai',
  area: 'Dubai Hills',
  propertyType: 'Villa',
  bedrooms: 3,
  sizeSqft: null,
  askingPriceFils: 350000000,
  listingRef: 'LS-AB12CD34',
};
const share = {
  id: ID,
  reference: 'LS-AB12CD34',
  coBrokingProperty: property,
  from: { id: 'sender', name: 'Synthetic Layla', company: 'Synthetic Homes' },
  to: { id: 'agent', name: 'Synthetic Omar', company: 'Synthetic Realty' },
};

test('a draft from a share sends its fixed property as it is, missing facts included', () => {
  const draft = {
    ...shareDraft(share, today),
    clientName: 'Sara K.',
    amount: '52,500',
    collectingParty: 'sender',
  };
  const { terms, errors } = readDraft(draft, today);
  assert.deepEqual(errors, {});
  assert.deepEqual(terms.property, property);
  assert.equal(terms.money.senderShareBp, 5000);
  assert.equal(terms.money.collectingParty, 'sender');
});

test('revising terms bound to an introduction keeps their property fixed', () => {
  const terms = {
    subject: { property, client: { displayName: 'Sara K.', contact: null } },
    money: {
      basis: 'commission',
      amountFils: 5250000,
      senderShareBp: 5000,
      paymentExpectation: 'on_transfer',
      collectingParty: 'sender',
    },
    expiresAt: null,
    governingEmirate: 'Dubai',
    notes: null,
    introduction: { reference: 'LS-AB12CD34' },
  };
  assert.deepEqual(draftFromTerms('co_broking', terms, today).frozen, property);
  const plain = { ...terms, introduction: undefined };
  assert.equal(draftFromTerms('co_broking', plain, today).frozen, null);
});

test('a proposal goes to the other named person of the share', () => {
  assert.equal(shareOther({ share }, { id: 'sender' }).name, 'Synthetic Omar');
  assert.equal(shareOther({ share }, { id: 'agent' }).name, 'Synthetic Layla');
});

test('the co-broking part of a share view is read strictly', () => {
  assert.equal(readCoBroking(null), null);
  assert.deepEqual(readCoBroking({ id: ID, state: 'sent' }), { id: ID, state: 'sent' });
  assert.throws(() => readCoBroking({ id: ID, state: 'declined' }), /invalid listing share/);
  assert.throws(() => readCoBroking({ id: 'nope', state: 'draft' }), /invalid listing share/);
  assert.deepEqual(readCoBrokingProperty(property), property);
  assert.equal(readCoBrokingProperty(undefined), null);
  assert.throws(() => readCoBrokingProperty({ ...property, bedrooms: '3' }));
});
