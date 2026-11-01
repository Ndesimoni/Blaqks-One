import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace, splitMatch } from '../../src/features/server/products/searchModel.js';

const data = {
  Clients: [
    { client_id: 'CL-1', full_name: 'Layla Haddad', lead_source: 'Website' },
    { client_id: 'CL-2', full_name: 'Omar Farouk' },
  ],
  Contacts: [{ contact_id: 'CO-1', full_name: 'Hassan Rahimi', contact_type: 'Landlord' }],
  Properties: [{ property_id: 'PR-1', listing_title: 'Marina Gate 2-bed', community: 'Marina' }],
};

test('search groups matches by collection in a fixed order and names each match', () => {
  const groups = searchWorkspace(data, 'ha');
  assert.deepEqual(
    groups.map((group) => [group.module, group.hits.map((hit) => hit.title)]),
    [
      ['Clients', ['Layla Haddad']],
      ['Contacts', ['Hassan Rahimi']],
    ],
  );
  const [layla] = groups[0].hits;
  assert.equal(layla.id, 'CL-1');
  assert.equal(layla.detail, 'Website · CL-1');
  assert.equal(groups[1].hits[0].detail, 'Landlord · CO-1');
});

test('search needs two letters and only looks where it is allowed', () => {
  assert.deepEqual(searchWorkspace(data, 'm'), []);
  assert.deepEqual(searchWorkspace(data, '  '), []);
  assert.deepEqual(
    searchWorkspace(data, 'marina', ['Clients', 'Contacts']).map((group) => group.module),
    [],
  );
  assert.deepEqual(
    searchWorkspace(data, 'marina').map((group) => group.module),
    ['Properties'],
  );
});

test('the first match is split out for highlighting, whatever its case', () => {
  assert.deepEqual(splitMatch('Layla Haddad', 'HAD'), ['Layla ', 'Had', 'dad']);
  assert.deepEqual(splitMatch('Layla Haddad', ' lay '), ['', 'Lay', 'la Haddad']);
  assert.deepEqual(splitMatch('Layla Haddad', 'zz'), ['Layla Haddad', '', '']);
});
