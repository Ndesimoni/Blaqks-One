import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bandFor, wholeDirhams } from '../../src/features/server/marketplace/requestBands.js';
import {
  bedroomChoices,
  draftFrom,
  draftFromRequest,
  requestBodyOf,
} from '../../src/features/server/marketplace/requestOptions.js';

/** The request form's helpers after Claude's MK2 review (2026-10-24). */
const stored = {
  purpose: 'buy',
  emirate: 'abu-dhabi',
  communities: ['Al Reem'],
  propertyType: 'villa',
  bedrooms: 12,
  budgetMinAed: null,
  budgetMaxAed: 4_000_000,
  moveIn: null,
};

test('whole dirhams drop separators and fils, never multiplying by a hundred', () => {
  assert.equal(wholeDirhams('1,500,000.50'), 1_500_000);
  assert.equal(wholeDirhams(' 120000 '), 120_000);
  assert.equal(wholeDirhams(''), null);
  assert.equal(wholeDirhams(null), null);
});

test('bands follow the server edges', () => {
  assert.equal(bandFor('buy', 1_000_000), 'buy_1m');
  assert.equal(bandFor('buy', 1_000_001), 'buy_2m');
  assert.equal(bandFor('rent', 50_000), 'rent_50k');
  assert.equal(bandFor('rent', 500_001), 'rent_500k_plus');
  assert.equal(bandFor('rent', 0), '');
});

test("a client's stored type matches a choice in any casing, or falls back", () => {
  assert.equal(draftFrom(stored).propertyType, 'Villa');
  assert.equal(draftFrom({ ...stored, propertyType: 'Castle' }).propertyType, 'Apartment');
  assert.equal(draftFrom({ ...stored, propertyType: null }).propertyType, 'Apartment');
});

test("every bedroom count the server accepts has a choice, so a client's count is kept", () => {
  assert.equal(bedroomChoices.length, 21);
  assert.ok(bedroomChoices.includes(Number(draftFrom(stored).bedrooms)));
});

test('a request with no move-in month edits as an empty month field', () => {
  const editable = draftFromRequest({
    ...stored,
    propertyType: 'Villa',
    openToOtherAreas: false,
    ready: 'any',
    furnishing: 'any',
    cheques: null,
    buildingAge: 'any',
  });
  assert.equal(editable.moveIn, '');
  assert.equal(requestBodyOf(editable).moveIn, null);
  assert.equal(
    requestBodyOf({ ...editable, budgetMaxAed: '2,500,000.75' }).budgetMaxAed,
    2_500_000,
  );
});
