import assert from 'node:assert/strict';
import test from 'node:test';
import ar from '../../src/i18n/catalogs/ar/fieldHints.js';
import en from '../../src/i18n/catalogs/en/fieldHints.js';
import { catalogs } from '../../src/i18n/catalogs/index.js';
import { fieldHintKey } from '../../src/i18n/fieldHintKeys.js';
import { lookup } from '../../src/i18n/translate.js';
import { focusOpensHint, hintVisible } from '../../src/lib/fieldHint.js';

test('guidance appears only on focus, with the preference on and no typing', () => {
  const base = { enabled: true, focused: true, pinned: false, typed: false };
  assert.equal(hintVisible(base), true);
  assert.equal(hintVisible({ ...base, enabled: false }), false);
  assert.equal(hintVisible({ ...base, focused: false }), false);
  assert.equal(hintVisible({ ...base, typed: true }), false);
  assert.equal(hintVisible({ ...base, pinned: true }), true);
  assert.equal(hintVisible({ ...base, enabled: false, pinned: true }), true);
});

test('only registered record fields resolve a guidance key', () => {
  assert.equal(fieldHintKey('Clients', 'phone'), 'fieldHints.clients.phone');
  assert.equal(
    fieldHintKey('Properties', 'permit_reference'),
    'fieldHints.properties.permit_reference',
  );
  assert.equal(fieldHintKey('Clients', 'notes'), '');
  assert.equal(fieldHintKey('Contacts', 'phone'), '');
  assert.equal(fieldHintKey('Unknown', 'phone'), '');
});

test('every guidance key has English and Arabic text', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const key of Object.keys(en)) {
    assert.equal(typeof lookup(catalogs, 'en', `fieldHints.${key}`), 'string', key);
    assert.equal(typeof lookup(catalogs, 'ar', `fieldHints.${key}`), 'string', key);
    assert.ok(ar[key].length > 0, key);
  }
});

test('a dropdown opens its hint on keyboard focus only, never under the mouse', () => {
  const control = (tagName, keyboard) => ({
    tagName,
    matches: (selector) => selector === ':focus-visible' && keyboard,
  });
  assert.equal(focusOpensHint(control('SELECT', false)), false, 'mouse-opened list');
  assert.equal(focusOpensHint(control('SELECT', true)), true, 'keyboard focus');
  assert.equal(focusOpensHint(control('INPUT', false)), true, 'text fields as before');
  const old = {
    tagName: 'SELECT',
    matches: () => {
      throw new Error('unsupported');
    },
  };
  assert.equal(focusOpensHint(old), false);
});
