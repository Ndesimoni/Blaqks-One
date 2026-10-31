/**
 * `npm run check:lines`: strict check; every hand-written file must meet the limit.
 * `npm run check:lines:ci`: `--baseline <file>` tolerates the listed oversized files
 * only while they do not grow (see scripts/file-size-baseline.mjs).
 */
import { resolve } from 'node:path';
import { compareWithBaseline, readBaseline, reportBaseline } from './file-size-baseline.mjs';
import { limit, measureFiles, projectRoot } from './file-size-scan.mjs';

const args = process.argv.slice(2);
const baselineIndex = args.indexOf('--baseline');
const baselinePath = baselineIndex === -1 ? null : args[baselineIndex + 1];
const requestedPaths = args.filter(
  (_, index) => baselineIndex === -1 || (index !== baselineIndex && index !== baselineIndex + 1),
);
const targets = requestedPaths.length ? requestedPaths.map((path) => resolve(path)) : [projectRoot];

try {
  if (baselineIndex !== -1 && !baselinePath) throw Error('--baseline needs a file path.');
  const { checked, violations } = await measureFiles(targets);
  console.log(`Checked ${checked} hand-written code/configuration files (limit: ${limit} lines).`);
  if (baselinePath) {
    const baseline = await readBaseline(resolve(baselinePath));
    const result = compareWithBaseline(violations, baseline);
    if (!reportBaseline(result, baselinePath, limit)) process.exitCode = 1;
  } else {
    for (const { path, lines } of violations) console.error(`${path}: ${lines} lines`);
    if (violations.length) {
      console.error(`FAILED: ${violations.length} files exceed ${limit} lines.`);
      process.exitCode = 1;
    } else {
      console.log('PASS: every checked file meets the line limit.');
    }
  }
} catch (error) {
  console.error(`Cannot check file sizes: ${error.message}`);
  process.exitCode = 1;
}
