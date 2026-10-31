import assert from 'node:assert/strict';
import test from 'node:test';
import { contactTabs, matchesContactTab } from '../../src/features/contacts/selectors.js';
import { OPTIONS } from '../../src/config/fields.js';
import { blank } from '../../src/lib/schema.js';
import { selectRecords } from '../../src/lib/workspace.js';

test('contact categories handle imported casing and keep unknown or unclassified contacts accessible', () => {
  const records = [
    { contact_id: 'CT-1', contact_type: ' Landlord ' },
    { contact_id: 'CT-2', contact_type: 'CLIENT' },
    { contact_id: 'CT-SG', contact_type: '  security GUARD ' },
    { contact_id: 'CT-BM', contact_type: 'Building Manager' },
    ...['Owner', 'Developer', 'Broker', 'Partner', 'Supplier', 'Other', 'Referral source', ''].map(
      (contact_type, index) => ({ contact_id: `CT-${index + 3}`, contact_type }),
    ),
    { contact_id: 'CT-11' },
    { contact_id: 'CT-12', contact_type: 'Security guards' },
    { contact_id: 'CT-13', contact_type: 'Building manager assistant' },
  ];
  const before = structuredClone(records);
  const inTab = (tab) => records.filter((record) => matchesContactTab(record, tab));
  assert.deepEqual(inTab('Landlords'), [records[0]]);
  assert.deepEqual(inTab('Clients'), [records[1]]);
  assert.deepEqual(inTab('Security guards'), [records[2]]);
  assert.deepEqual(inTab('Building managers'), [records[3]]);
  assert.deepEqual(inTab('Other contacts'), records.slice(4));
  assert.deepEqual(inTab('All'), records);
  assert.deepEqual(records, before);
});

test('contact categories combine with the existing search and sort without changing stored records', () => {
  const data = blank();
  data.Contacts = [
    { contact_id: 'CT-1', contact_type: 'Landlord', full_name: 'Zara', company: 'Harbour Homes' },
    { contact_id: 'CT-2', contact_type: 'Client', full_name: 'Amy', company: 'Harbour Homes' },
    { contact_id: 'CT-3', contact_type: 'Landlord', full_name: 'Ben', company: 'Harbour Homes' },
    { contact_id: 'CT-4', contact_type: 'Landlord', full_name: 'Cara', company: 'Other company' },
  ];
  const before = structuredClone(data);
  assert.deepEqual(
    selectRecords(data, 'Contacts', {
      query: ' HARBOUR ',
      sort: { key: 'full_name', direction: 'asc' },
      filter: (record) => matchesContactTab(record, 'Landlords'),
    }),
    [data.Contacts[2], data.Contacts[0]],
  );
  assert.deepEqual(data, before);
});

test('contact tabs list each category once in order and every type has exactly one category', () => {
  assert.deepEqual(contactTabs, [
    'All',
    'Landlords',
    'Clients',
    'Security guards',
    'Building managers',
    'Other contacts',
  ]);
  for (const contact_type of OPTIONS['Contact type']) {
    const tabs = contactTabs.filter(
      (tab) => tab !== 'All' && matchesContactTab({ contact_type }, tab),
    );
    assert.equal(tabs.length, 1, contact_type);
  }
  assert.deepEqual(OPTIONS['Contact type'].slice(-3), [
    'Security guard',
    'Building manager',
    'Other',
  ]);
});

test('contact search matches building and community text within the selected category', () => {
  const data = blank();
  data.Contacts = [
    {
      contact_id: 'CT-1',
      full_name: 'Night guard',
      contact_type: 'Security guard',
      building_project: 'Marina Gate 2',
      community: 'Dubai Marina',
      emirate: 'Dubai',
    },
    {
      contact_id: 'CT-2',
      full_name: 'Tower manager',
      contact_type: 'Building manager',
      building_project: 'Creek Vista',
      community: 'Sobha Hartland',
      emirate: 'Dubai',
    },
  ];
  const find = (query, tab = 'All') =>
    selectRecords(data, 'Contacts', {
      query,
      filter: (record) => matchesContactTab(record, tab),
    }).map((record) => record.contact_id);
  assert.deepEqual(find('marina gate'), ['CT-1']);
  assert.deepEqual(find(' HARTLAND '), ['CT-2']);
  assert.deepEqual(find('Dubai'), ['CT-1', 'CT-2']);
  assert.deepEqual(find('Dubai', 'Building managers'), ['CT-2']);
  assert.deepEqual(find('Creek', 'Security guards'), []);
});
