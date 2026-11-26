/**
 * Shrink-only baseline for known oversized files (used by `npm run check:lines:ci`).
 * New oversized files and baseline files that grow fail; shrinking is reported so the
 * baseline can be tightened. Never add entries or raise counts to make a check pass.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from './file-size-scan.mjs';

export async function readBaseline(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  const files = parsed?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw Error(`${path} must contain a "files" object of path: line count.`);
  }
  for (const [file, lines] of Object.entries(files)) {
    if (!Number.isInteger(lines) || lines < 1) {
      throw Error(`${path}: "${file}" needs a positive whole line count.`);
    }
  }
  return files;
}

/** Splits current violations into failures and baseline notices. */
export function compareWithBaseline(violations, baseline) {
  const current = new Map(violations.map(({ path, lines }) => [path, lines]));
  const result = { added: [], grown: [], tightened: [], resolved: [], missing: [] };
  for (const { path, lines } of violations) {
    const allowed = Object.hasOwn(baseline, path) ? baseline[path] : undefined;
    if (allowed === undefined) result.added.push({ path, lines });
    else if (lines > allowed) result.grown.push({ path, lines, allowed });
    else if (lines < allowed) result.tightened.push({ path, lines, allowed });
  }
  result.baselined = violations.length - result.added.length;
  for (const [path, allowed] of Object.entries(baseline)) {
    if (current.has(path)) continue;
    if (existsSync(resolve(projectRoot, path))) result.resolved.push({ path, allowed });
    else result.missing.push({ path, allowed });
  }
  return result;
}

/** Prints the comparison and returns true when the check passes. */
export function reportBaseline(result, baselinePath, limit) {
  const { added, grown, tightened, resolved, missing } = result;
  for (const { path, lines } of added) {
    console.error(`NEW: ${path}: ${lines} lines (limit ${limit}; split it, do not baseline it)`);
  }
  for (const { path, lines, allowed } of grown) {
    console.error(`GREW: ${path}: ${lines} lines (baseline ${allowed}; it may only shrink)`);
  }
  for (const { path, lines, allowed } of tightened) {
    console.log(`Shrank: ${path}: ${allowed} -> ${lines} lines; lower its baseline count.`);
  }
  for (const { path } of resolved) {
    console.log(`Fixed: ${path} now meets the limit; remove it from ${baselinePath}.`);
  }
  for (const { path } of missing) {
    console.log(`Gone: ${path} no longer exists; remove it from ${baselinePath}.`);
  }
  const failures = added.length + grown.length;
  if (failures) {
    console.error(`FAILED: ${failures} files are newly oversized or grew past the baseline.`);
    return false;
  }
  console.log(`PASS: no new or growing oversized files (${result.baselined} baselined remain).`);
  return true;
}
