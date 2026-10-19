import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavedLanguage, saveLanguage } from '../../src/i18n/languages.js';

test('blocked access to browser storage keeps language initialization and changes usable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is blocked', 'SecurityError');
    },
  });
  try {
    assert.equal(readSavedLanguage(), 'en');
    assert.doesNotThrow(() => saveLanguage('ar'));
    assert.equal(readSavedLanguage({ getItem: () => 'ar' }), 'ar');
    const values = new Map();
    saveLanguage('ar', { setItem: (key, value) => values.set(key, value) });
    assert.equal(values.get('kws-crm-language'), 'ar');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
