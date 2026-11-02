import assert from 'node:assert/strict';
import test from 'node:test';
import { maskPhone } from '../../src/lib/format.js';

test('a phone keeps its start and last four digits, as the mockup masks an owner', () => {
  assert.equal(maskPhone('+971 55 123 2210'), '+971 55 *** 2210');
  assert.equal(maskPhone('+971500000202'), '+971 50 *** 0202');
  assert.equal(maskPhone('050 123 4567'), '050 *** 4567');
  assert.equal(maskPhone('+44 7700 900123'), '+447 *** 0123');
});

test('short, blank and unreadable phones never show their digits', () => {
  assert.equal(maskPhone('12345'), '***');
  assert.equal(maskPhone(''), '');
  assert.equal(maskPhone(null), '');
  assert.equal(maskPhone('ask reception'), '');
});
