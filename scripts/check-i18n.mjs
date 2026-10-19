/**
 * `npm run check:i18n` (docs/i18n.md): fails when the English and Arabic catalogues differ
 * in namespaces or keys, when a value is empty, when plural forms do not match the
 * language, when `{placeholders}` differ, or when a file is missing from catalogs/index.js.
 */
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkCatalogs, checkRegistry } from './i18n-rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'src/i18n/catalogs');

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
  const problems = [...checkRegistry(files, catalogs), ...checkCatalogs(files)];
  const keys = Object.values(files.en ?? {}).reduce((sum, ns) => sum + Object.keys(ns).length, 0);
  const namespaces = Object.keys(files.en ?? {}).length;
  console.log(
    `Checked ${languages.join(', ')} catalogues: ${namespaces} namespaces, ${keys} keys each.`,
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
