import test from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeContact,
  needsCheck,
} from '../../src/features/server/listingShares/shareChecks.js';

// The send confirmation rule (R2a security review L8), the same as the server's review.rs.
test('phone numbers and email addresses are flagged like the server flags them', () => {
  assert.ok(looksLikeContact('Call the owner on 050 123 4567'));
  assert.ok(looksLikeContact('Email owner@example.test for keys'));
  assert.ok(looksLikeContact('+971 (50) 123-4567'));
  assert.ok(looksLikeContact('Owner: 050/123/4567'));
  assert.ok(looksLikeContact('Owner: 050\u00a0123\u00a04567'));
  assert.ok(!looksLikeContact('Three bedrooms, AED 2,500,000, sea views'));
  assert.ok(!looksLikeContact('Meet @ the lobby'));
  assert.ok(!looksLikeContact(null));
});

test('the tick is needed for flagged text, links or a contact-like note only', () => {
  assert.ok(needsCheck(['contact']));
  assert.ok(needsCheck(['links', 'pdf']));
  assert.ok(needsCheck([], 'WhatsApp me on 0501234567'));
  assert.ok(!needsCheck(['inline', 'over', 'unavailable', 'pdf'], 'See you at the viewing'));
  assert.ok(!needsCheck());
});
