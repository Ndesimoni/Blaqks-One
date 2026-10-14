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
  address: 'Marina Gate Tower 2, Marina Walk',
  map_link: 'https://maps.google.com/?q=Marina+Gate+Tower+2',
};

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

const contactsOf = async (session, workspace) =>
  (await session.request(`/workspaces/${workspace}/records`)).value.records.Contacts;

test('Contacts persist address and an https map link on create and update', async () => {
  const created = await create(admin, 'Contacts', { full_name: 'Synthetic tenant', ...place });
  assert.equal(created.record.address, place.address);
  assert.equal(created.record.map_link, place.map_link);
  const moved = { address: 'Burj Vista 1, Downtown', map_link: 'http://maps.app.goo.gl/abc123' };
  const updated = await admin.request(recordsPath(admin, 'Contacts', created.id), {
    method: 'PATCH',
    body: { record: { ...created.record, ...moved }, version: created.version },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  const stored = (await contactsOf(admin, admin.user.id)).find((row) => row.id === created.id);
  assert.equal(stored.record.address, moved.address);
  assert.equal(stored.record.map_link, moved.map_link);
  const cleared = await admin.request(recordsPath(admin, 'Contacts', created.id), {
    method: 'PATCH',
    body: { record: { ...stored.record, map_link: '' }, version: updated.value.version },
  });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  assert.equal(cleared.value.record.map_link, '');
});

test('an empty map link is allowed on create', async () => {
  const created = await create(admin, 'Contacts', { full_name: 'No map', map_link: '' });
  assert.equal(created.record.map_link, '');
});

test('unsafe, schemeless and nested map links are rejected on create and update', async () => {
  const base = await create(admin, 'Contacts', { full_name: 'Synthetic owner' });
  const path = recordsPath(admin, 'Contacts', base.id);
  for (const map_link of BAD_LINKS) {
    const created = await admin.request(recordsPath(admin, 'Contacts'), {
      method: 'POST',
      body: { record: { full_name: 'Rejected', map_link } },
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
  const stored = (await contactsOf(admin, admin.user.id)).find((row) => row.id === base.id);
  assert.equal(stored.record.map_link, undefined);
});

test('Super Admin import preserves address and map link and rejects bad links', async () => {
  const contact = { contact_id: 'ADDR-IMPORT', full_name: 'Synthetic imported owner', ...place };
  const plan = await planned(owner, admin.user.id, { ...emptyRecords(), Contacts: [contact] });
  const result = await commit(owner, admin.user.id, plan.token);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.imported.Contacts, 1);
  const imported = (await contactsOf(owner, admin.user.id)).find(
    (row) => row.record.contact_id === 'ADDR-IMPORT',
  );
  assert.equal(imported.record.address, place.address);
  assert.equal(imported.record.map_link, place.map_link);
  const bad = { ...contact, contact_id: 'ADDR-BAD', map_link: 'javascript:alert(1)' };
  const rejected = await preview(owner, admin.user.id, { ...emptyRecords(), Contacts: [bad] });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.value.message, MAP_LINK);
});
