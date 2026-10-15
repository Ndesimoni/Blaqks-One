import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkBoundaries, moduleOf, namesIn, stripComment } from '../../scripts/boundary-rules.mjs';

const map = {
  owners: {
    records: ['crm_records'],
    finance: ['crm_deals'],
    auth: ['crm_users', 'crm_user_profiles'],
  },
  domainFree: { paths: ['auth/', 'error.rs'], domains: ['records', 'finance'] },
  published: ['crm_user_profiles'],
  unrestricted: { sample: 'dev tool' },
  allowed: { finance: { crm_records: 'C1' } },
};

test('comments are ignored but strings that contain slashes are kept', () => {
  assert.equal(stripComment('let a = 1; // crm_deals'), 'let a = 1; ');
  assert.equal(stripComment('"http://x crm_deals"'), '"http://x crm_deals"');
  assert.deepEqual(
    namesIn('/// crm_deals\n"FROM crm_records r JOIN crm_users u"').map(({ name }) => name),
    ['crm_records', 'crm_users'],
  );
  assert.equal(moduleOf('finance/deals/links.rs'), 'finance');
  assert.equal(moduleOf('error.rs'), 'root');
});

test('owners, published views, allowlisted and unrestricted modules pass', () => {
  const result = checkBoundaries(map, [
    { path: 'records/list.rs', text: '"FROM crm_records JOIN crm_user_profiles"' },
    { path: 'finance/links.rs', text: '"FROM crm_deals d JOIN crm_records r"' },
    { path: 'sample/clear.rs', text: '"DELETE FROM crm_deals"' },
  ]);
  assert.deepEqual(result, { violations: [], stale: [] });
});

test('unlisted cross-module access, unowned names and domain paths fail', () => {
  const { violations, stale } = checkBoundaries(map, [
    { path: 'records/visibility.rs', text: 'x\n"SELECT 1 FROM crm_deals"' },
    { path: 'records/new.rs', text: '"crm_mystery"' },
    { path: 'auth/grants.rs', text: 'use crate::records::collections; // finance::x' },
  ]);
  assert.deepEqual(violations, [
    'records/visibility.rs:2 records/ uses crm_deals (owned by finance) without an entry.',
    'records/new.rs:1 crm_mystery has no owner in the boundary map.',
    'auth/grants.rs:1 shared infrastructure names the domain path records:: (rule 5).',
  ]);
  assert.deepEqual(stale, ['finance/ → crm_records']);
});

test('the repository map names an owner for every module it allowlists', async () => {
  const url = new URL('../../scripts/boundaries.json', import.meta.url);
  const repository = JSON.parse(await readFile(url, 'utf8'));
  const modules = new Set([...Object.keys(repository.owners), 'root']);
  for (const module of Object.keys(repository.allowed)) assert.ok(modules.has(module), module);
  for (const view of repository.published) assert.ok(repository.owners.auth.includes(view));
  for (const reasons of Object.values(repository.allowed)) {
    for (const reason of Object.values(reasons)) assert.ok(reason.length > 10, reason);
  }
});
