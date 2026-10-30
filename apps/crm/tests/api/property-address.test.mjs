import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, recordsPath } from './helpers.mjs';
import { commit, emptyRecords, fixtures, planned, preview } from './import-helpers.mjs';

const MAP_LINK = 'Enter a complete http:// or https:// map link.';
const BAD_LINKS = [
  'javascript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'www.google.com/maps',
  ['https://maps.google.com'],
];
const place = {
  address: 'Unit 1204, Marina Gate Tower 2, Marina Walk',
  map_link: 'https://maps.google.com/?q=Marina+Gate+Tower+2',
};

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

const propertiesOf = async (session, workspace) =>
  (await session.request(`/workspaces/${workspace}/records`)).value.records.Properties;

test('Properties persist address and an https map link on create and update', async () => {
  const landlord = await create(admin, 'Contacts', { full_name: 'Synthetic landlord' });
  const created = await create(admin, 'Properties', {
    listing_title: 'Synthetic marina apartment',
    contact_id: landlord.record.contact_id,
    ...place,
  });
  assert.equal(created.record.address, place.address);
  assert.equal(created.record.map_link, place.map_link);
  const moved = { address: 'Burj Vista 1, Downtown', map_link: 'http://maps.app.goo.gl/abc123' };
  const updated = await admin.request(recordsPath(admin, 'Properties', created.id), {
    method: 'PATCH',
    body: { record: { ...created.record, ...moved }, version: created.version },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  const stored = (await propertiesOf(admin, admin.user.id)).find((row) => row.id === created.id);
  assert.equal(stored.record.address, moved.address);
  assert.equal(stored.record.map_link, moved.map_link);
  const cleared = await admin.request(recordsPath(admin, 'Properties', created.id), {
    method: 'PATCH',
    body: { record: { ...stored.record, map_link: '' }, version: updated.value.version },
  });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  assert.equal(cleared.value.record.map_link, '');
});

test('an empty map link is allowed and other property URLs stay unvalidated', async () => {
  const created = await create(admin, 'Properties', {
    listing_title: 'No map',
    map_link: '',
    listing_url: 'listing page to follow',
  });
  assert.equal(created.record.map_link, '');
  assert.equal(created.record.listing_url, 'listing page to follow');
});

test('unsafe, schemeless and nested map links are rejected on create and update', async () => {
  const base = await create(admin, 'Properties', { listing_title: 'Synthetic villa' });
  const path = recordsPath(admin, 'Properties', base.id);
  for (const map_link of BAD_LINKS) {
    const created = await admin.request(recordsPath(admin, 'Properties'), {
      method: 'POST',
      body: { record: { listing_title: 'Rejected', map_link } },
    });
    assert.equal(created.status, 400, JSON.stringify(map_link));
    assert.equal(created.value.message, MAP_LINK);
    const updated = await admin.request(path, {
      method: 'PATCH',
      body: { record: { ...base.record, map_link }, version: base.version },
    });
    assert.equal(updated.status, 400, JSON.stringify(map_link));
    assert.equal(updated.value.message, MAP_LINK);
  }
  const stored = (await propertiesOf(admin, admin.user.id)).find((row) => row.id === base.id);
  assert.equal(stored.record.map_link, undefined);
});

test('Super Admin import preserves address and map link and rejects bad links', async () => {
  const property = { property_id: 'ADDR-PR-IMPORT', listing_title: 'Synthetic import', ...place };
  const records = { ...emptyRecords(), Properties: [property] };
  const plan = await planned(owner, admin.user.id, records);
  const result = await commit(owner, admin.user.id, plan.token);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.imported.Properties, 1);
  const imported = (await propertiesOf(owner, admin.user.id)).find(
    (row) => row.record.property_id === 'ADDR-PR-IMPORT',
  );
  assert.equal(imported.record.address, place.address);
  assert.equal(imported.record.map_link, place.map_link);
  const bad = { ...property, property_id: 'ADDR-PR-BAD', map_link: 'javascript:alert(1)' };
  const rejected = await preview(owner, admin.user.id, { ...emptyRecords(), Properties: [bad] });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.value.message, MAP_LINK);
});
