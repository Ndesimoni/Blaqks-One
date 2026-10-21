/**
 * `npm run check:i18n` (docs/i18n.md): fails when an English value is empty, when its plural
 * forms do not match English, or when a file is missing from catalogs/index.js. Arabic is
 * frozen (owner, 2026-10-22): its files stay registered but no longer follow English, and a
 * missing Arabic key shows the English text.
 */
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkLanguage, checkRegistry } from './i18n-rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'src/i18n/catalogs');
const CHECKED = 'en';

async function loadLanguage(language) {
  const names = (await readdir(join(directory, language))).filter((name) => name.endsWith('.js'));
  const entries = await Promise.all(
    names.sort().map(async (name) => {
      const module = await import(pathToFileURL(join(directory, language, name)).href);
      return [name.replace(/\.js$/, ''), module.default];
    }),
  );
  return Object.fromEntries(entries);
}

try {
  const languages = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const files = Object.fromEntries(
    await Promise.all(languages.map(async (language) => [language, await loadLanguage(language)])),
  );
  const { catalogs } = await import(pathToFileURL(join(directory, 'index.js')).href);
  const problems = [...checkRegistry(files, catalogs), ...checkLanguage(files, CHECKED)];
  const english = files[CHECKED] ?? {};
  const keys = Object.values(english).reduce((sum, ns) => sum + Object.keys(ns).length, 0);
  const frozen = languages.filter((language) => language !== CHECKED).join(', ');
  console.log(
    `Checked the English catalogue: ${Object.keys(english).length} namespaces, ${keys} keys` +
      (frozen ? ` (${frozen} frozen, not checked).` : '.'),
  );
  for (const problem of problems) console.error(problem);
  if (problems.length) {
    console.error(`${problems.length} catalogue problem(s).`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Could not check the catalogues: ${error.message}`);
  process.exitCode = 1;
}
