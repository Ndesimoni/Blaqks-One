import test from 'node:test';
import assert from 'node:assert/strict';
import { requestActivityCapabilities as capabilities } from '../../src/features/server/marketplace/marketActivityModel.js';

test('a full or paused marketplace request never offers new property or message actions', () => {
  for (const request of [
    { state: 'open', activeOffers: 3, canMessage: true },
    { state: 'paused', activeOffers: 1, canMessage: true },
    { state: 'closed', activeOffers: 0, canMessage: true },
  ]) {
    const found = capabilities({ request, matches: [] });
    assert.equal(found.canOffer, false);
    assert.equal(found.canMessage, false);
  }
});

test('no-match messaging requires server permission, free capacity and no own match', () => {
  const request = { state: 'open', activeOffers: 2, canMessage: true };
  assert.equal(capabilities({ request, matches: [] }).canMessage, true);
  assert.equal(capabilities({ request, matches: [{ recordId: 'own' }] }).canMessage, false);
  assert.equal(capabilities({ request: { ...request, canMessage: false } }).canMessage, false);
  assert.equal(capabilities({ request: { ...request, isPoster: true } }).canMessage, false);
  assert.equal(
    capabilities({ request: { ...request, activeOffers: undefined } }).canMessage,
    false,
  );
});
