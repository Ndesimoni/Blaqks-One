import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companyRows,
  eligibilityBody,
  eligibilityChanged,
  eligibilityForm,
  eligibilityImpacts,
  filterCompanies,
  filterCounts,
  isConflict,
  pageOf,
} from '../../src/features/server/website/companies/companiesModel.js';

const site = (workspace, extras = {}) => ({
  workspace,
  name: `Synthetic site ${workspace}`,
  host: `${workspace}.example.test`,
  active: true,
  entitled: true,
  licenceVerified: true,
  version: 3,
  ...extras,
});

const rows = companyRows(
  [
    site('ws-b', { entitled: false }),
    site('ws-a', { licenceVerified: false, content: { heroTitle: 'PRIVATE' } }),
    site('ws-c', { name: 'Harbour Homes', host: 'harbour.example.test' }),
  ],
  [
    { id: 'ws-a', name: 'Alpha Realty' },
    { id: 'ws-b', name: 'Beta Estates' },
  ],
);

test('rows are named by company, sorted, and keep only the listed setup fields', () => {
  assert.deepEqual(
    rows.map((row) => row.company),
    ['Alpha Realty', 'Beta Estates', 'Harbour Homes'],
  );
  assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    'active',
    'company',
    'entitled',
    'host',
    'licenceVerified',
    'name',
    'version',
    'workspace',
  ]);
  assert.deepEqual(companyRows(null), []);
});

test('search matches company, website name or address and filters narrow by flag', () => {
  assert.deepEqual(
    filterCompanies(rows, { query: 'beta' }).map((row) => row.workspace),
    ['ws-b'],
  );
  assert.deepEqual(
    filterCompanies(rows, { query: '  HARBOUR.example ' }).map((row) => row.workspace),
    ['ws-c'],
  );
  assert.deepEqual(
    filterCompanies(rows, { filter: 'licence' }).map((row) => row.workspace),
    ['ws-a'],
  );
  assert.deepEqual(
    filterCompanies(rows, { filter: 'entitled' }).map((row) => row.workspace),
    ['ws-b'],
  );
  assert.deepEqual(filterCompanies(rows, { query: 'alpha', filter: 'entitled' }), []);
  assert.deepEqual(filterCounts(rows, ''), { all: 3, licence: 1, entitled: 1 });
  assert.deepEqual(filterCounts(rows, 'synthetic'), { all: 2, licence: 1, entitled: 1 });
});

test('pages hold twelve companies and clamp when the result shrinks', () => {
  const many = Array.from({ length: 25 }, (_, index) => ({ workspace: `ws-${index}` }));
  assert.equal(pageOf(many, 0).items.length, 12);
  assert.deepEqual(pageOf(many, 2), { current: 2, items: many.slice(24) });
  assert.equal(pageOf(many, 9).current, 2);
  assert.deepEqual(pageOf([], 4), { current: 0, items: [] });
  assert.equal(pageOf(many, -3).current, 0);
});

test('turning a flag off names its impact; turning one on does not', () => {
  const both = rows.find((row) => row.workspace === 'ws-c');
  const form = eligibilityForm(both);
  assert.deepEqual(eligibilityImpacts(both, form), []);
  assert.deepEqual(eligibilityImpacts(both, { ...form, licenceVerified: false }), ['licenceOff']);
  assert.deepEqual(eligibilityImpacts(both, { ...form, entitled: false }), ['entitlementOff']);
  assert.deepEqual(eligibilityImpacts(both, { ...form, entitled: false, licenceVerified: false }), [
    'licenceOff',
    'entitlementOff',
  ]);
  const unverified = rows.find((row) => row.workspace === 'ws-a');
  assert.deepEqual(
    eligibilityImpacts(unverified, { ...eligibilityForm(unverified), licenceVerified: true }),
    [],
  );
});

test('the body sends the listed version and omits a blank address so it is kept', () => {
  const row = rows[0];
  const form = eligibilityForm(row);
  assert.equal(form.host, '');
  assert.equal(eligibilityChanged(row, form), false);
  assert.deepEqual(eligibilityBody(row, { ...form, host: '   ' }), {
    version: 3,
    entitled: true,
    licenceVerified: false,
  });
  const moved = { ...form, host: ' new.example.test ' };
  assert.equal(eligibilityChanged(row, moved), true);
  assert.equal(eligibilityBody(row, moved).host, 'new.example.test');
  assert.equal(eligibilityChanged(row, { ...form, host: row.host.toUpperCase() }), false);
  assert.equal(eligibilityChanged(row, { ...form, licenceVerified: true }), true);
});

test('a stale version is recognised by status or code', () => {
  assert.equal(isConflict({ status: 409 }), true);
  assert.equal(isConflict({ status: 400, details: { code: 'version_conflict' } }), true);
  assert.equal(isConflict({ status: 403 }), false);
  assert.equal(isConflict(null), false);
});
