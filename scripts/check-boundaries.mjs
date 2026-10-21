/**
 * `npm run check:boundaries`: automated rule 12 of docs/service-boundaries.md. Scans
 * services/crm-api/src for `crm_*` names and fails on a name without an owner, on a
 * module using another module's table without an allowlist entry in
 * scripts/boundaries.json, and on allowlist entries that are no longer used.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBoundaries } from './boundary-rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'services/crm-api/src');
const mapPath = join(root, 'scripts/boundaries.json');
// Messaging and media modules' tables live in their own file to keep each map small.
const extraPaths = [join(root, 'scripts/boundaries-messaging.json')];

async function rustFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return rustFiles(path);
      return entry.name.endsWith('.rs') ? [path] : [];
    }),
  );
  return nested.flat().sort();
}

try {
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  for (const path of extraPaths) {
    const extra = JSON.parse(await readFile(path, 'utf8'));
    Object.assign(map.owners, extra.owners);
  }
  const paths = await rustFiles(source);
  const files = await Promise.all(
    paths.map(async (path) => ({
      path: relative(source, path).split('\\').join('/'),
      text: await readFile(path, 'utf8'),
    })),
  );
  const { violations, stale } = checkBoundaries(map, files);
  console.log(`Checked ${files.length} Rust files against scripts/boundaries.json.`);
  for (const violation of violations) console.error(`services/crm-api/src/${violation}`);
  for (const entry of stale) console.error(`Stale allowlist entry (remove it): ${entry}`);
  if (violations.length || stale.length) {
    console.error(
      'FAILED: call the owning module instead, or justify the coupling in ' +
        'docs/service-boundaries.md and add it to scripts/boundaries.json.',
    );
    process.exitCode = 1;
  } else {
    console.log('PASS: every crm_* name is used by its owner or an accepted coupling.');
  }
} catch (error) {
  console.error(`Cannot check service boundaries: ${error.message}`);
  process.exitCode = 1;
}
