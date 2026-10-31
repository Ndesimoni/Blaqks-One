import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/i18n/catalogs/index.js';
import { checkCatalogs, checkLanguage, checkRegistry } from '../../../../scripts/i18n-rules.mjs';

// Arabic is frozen (owner, 2026-10-22): only the English catalogue must be complete.
test('the shipped English catalogue is complete and every file registered', () => {
  assert.deepEqual(checkLanguage(catalogs, 'en'), []);
  assert.deepEqual(checkRegistry(catalogs, catalogs), []);
});

test('one language alone: empty values and unused plural forms are reported', () => {
  const problems = checkLanguage({
    en: { a: { gone: ' ', n: { one: '1', few: '2', other: 'n' } } },
  });
  assert.deepEqual(problems, [
    'en a.gone is empty or not text.',
    'en a.n has "few", which en does not use.',
  ]);
});

test('missing namespaces, keys, empty values and placeholder drift are reported', () => {
  const problems = checkCatalogs({
    en: { a: { one: 'One', two: 'Hi {name}', three: 'x' }, b: { k: 'v' } },
    ar: { a: { one: ' ', two: 'مرحبًا {person}', four: 'y' } },
  });
  assert.deepEqual(problems, [
    'a.four is missing in en.',
    'a.three is missing in ar.',
    'a.two placeholders differ: en {name} vs ar {person}.',
    'ar a.one is empty or not text.',
    'Namespace b is missing in ar.',
  ]);
});

test('plural forms must match each language', () => {
  const problems = checkCatalogs({
    en: { a: { n: { one: '{count} item', other: '{count} items' }, s: 'text' } },
    ar: { a: { n: { one: 'عنصر', other: '{count} عنصر' }, s: { other: 'نص' } } },
  });
  assert.ok(problems.includes('a.s is plural in only one language.'));
  for (const form of ['zero', 'two', 'few', 'many'])
    assert.ok(problems.includes(`ar a.n needs the "${form}" form.`), form);
  const extra = checkCatalogs({
    en: { a: { n: { one: 'a', two: 'b', other: 'c' } } },
    ar: { a: {} },
  });
  assert.ok(extra.includes('en a.n has "two", which en does not use.'));
});

test('unregistered catalogue files are reported', () => {
  const file = { k: 'v' };
  const problems = checkRegistry(
    { en: { a: file, b: file } },
    { en: { a: file, c: file }, fr: {} },
  );
  assert.deepEqual(problems, [
    'en/b.js is not registered in catalogs/index.js.',
    'catalogs/index.js registers en/c without a file.',
    'catalogs/index.js registers unknown fr.',
  ]);
});
