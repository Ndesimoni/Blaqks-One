import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentLanguage, createI18n } from '../../src/i18n/createI18n.js';
import {
  availableLanguages,
  effectiveLanguage,
  readSavedLanguage,
  saveLanguage,
} from '../../src/i18n/languages.js';
import { createTranslator } from '../../src/i18n/translate.js';

const catalogs = {
  en: {
    demo: {
      hello: 'Hello, {name}',
      only: 'English only',
      sessions: { one: '{count} session', other: '{count} sessions' },
    },
  },
  ar: {
    demo: {
      hello: 'مرحبًا، {name}',
      sessions: {
        zero: 'لا جلسات',
        one: 'جلسة واحدة',
        two: 'جلستان',
        few: '{count} جلسات',
        many: '{count} جلسة',
        other: '{count} جلسة',
      },
    },
  },
};

test('keys resolve by namespace with interpolation', () => {
  const t = createTranslator('en', catalogs);
  assert.equal(t('demo.hello', { name: 'Aidah' }), 'Hello, Aidah');
  assert.equal(t('demo.hello'), 'Hello, {name}');
  assert.equal(t('demo.hello', {}), 'Hello, ');
  assert.equal(
    createTranslator('ar', catalogs)('demo.hello', { name: 'سيموني' }),
    'مرحبًا، سيموني',
  );
});

test('plurals follow each language, including the six Arabic forms', () => {
  const en = createTranslator('en', catalogs);
  assert.equal(en('demo.sessions', { count: 1 }), '1 session');
  assert.equal(en('demo.sessions', { count: 0 }), '0 sessions');
  assert.equal(en('demo.sessions', { count: 1250 }), '1,250 sessions');
  const ar = createTranslator('ar', catalogs);
  const forms = [0, 1, 2, 3, 11, 100].map((count) => ar('demo.sessions', { count }));
  assert.deepEqual(forms, ['لا جلسات', 'جلسة واحدة', 'جلستان', '3 جلسات', '11 جلسة', '100 جلسة']);
});

test('missing Arabic text falls back to English and warns once in development', () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const t = createTranslator('ar', catalogs, { DEV: true });
    assert.equal(t('demo.only'), 'English only');
    assert.equal(t('demo.only'), 'English only');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Missing ar text for "demo.only"/);
    assert.equal(createTranslator('ar', catalogs, {})('demo.only'), 'English only');
  } finally {
    console.warn = original;
  }
});

test('unknown keys never show the raw key', () => {
  const t = createTranslator('en', catalogs, {});
  for (const key of ['demo.nothing', 'nothing.here', 'nodots', '', undefined, 'demo.'])
    assert.equal(t(key), '');
  assert.equal(t('demo.toString'), '');
  assert.equal(t('demo.__proto__'), '');
});

test('preview languages are offered only behind the flag', () => {
  assert.deepEqual(availableLanguages(false), ['en']);
  assert.deepEqual(availableLanguages(true), ['en', 'ar']);
  assert.equal(effectiveLanguage('ar', false), 'en');
  assert.equal(effectiveLanguage('ar', true), 'ar');
  assert.equal(effectiveLanguage('fr', true), 'en');
  assert.equal(createI18n('ar', { preview: true }).dir, 'rtl');
  assert.equal(createI18n('ar').locale, 'ar-AE-u-nu-latn');
  assert.equal(createI18n('fr').language, 'en');
});

test('the saved browser choice survives broken storage', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(readSavedLanguage(storage), 'en');
  saveLanguage('ar', storage);
  assert.equal(store.get('kws-crm-language'), 'ar');
  assert.equal(readSavedLanguage(storage), 'ar');
  saveLanguage('xx', storage);
  assert.equal(readSavedLanguage(storage), 'ar');
  const broken = {
    getItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('blocked');
    },
  };
  assert.equal(readSavedLanguage(broken), 'en');
  assert.doesNotThrow(() => saveLanguage('ar', broken));
  assert.equal(readSavedLanguage(undefined), 'en');
});

test('the document root gets lang and dir', () => {
  const root = {};
  applyDocumentLanguage(root, 'ar');
  assert.deepEqual(root, { lang: 'ar', dir: 'rtl' });
  applyDocumentLanguage(root, 'en');
  assert.deepEqual(root, { lang: 'en', dir: 'ltr' });
});
