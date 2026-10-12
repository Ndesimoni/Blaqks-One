import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { fixtures, emptyRecords, preview, zeroCounts } from './import-helpers.mjs';

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

test('preview validates complete source shapes, IDs and same-workspace contact links', async () => {
  for (const records of [
    { Clients: [], Contacts: [] },
    { ...emptyRecords(), Unknown: [] },
    { ...emptyRecords(), Clients: {} },
    { ...emptyRecords(), Clients: [{ client_id: 'IMP-DUP' }, { client_id: ' IMP-DUP ' }] },
    { ...emptyRecords(), Properties: [{ property_id: 'IMP-DANGLING', contact_id: 'IMP-MISSING' }] },
    { ...emptyRecords(), Clients: [{ client_id: 'IMP-NUM', maximum_budget_aed: true }] },
    { ...emptyRecords(), Properties: [{ property_id: 'IMP-OBJECT', listing_title: {} }] },
    { ...emptyRecords(), Clients: [{ client_id: 'IMP-FORGED', owner_id: admin.user.id }] },
  ]) {
    assert.equal((await preview(owner, admin.user.id, records)).status, 400);
  }
  assert.equal((await preview(owner, admin.user.id, emptyRecords(), ' ')).status, 400);
  const tooMany = {
    ...emptyRecords(),
    Clients: Array.from({ length: 1001 }, (_, id) => ({ client_id: `IMP-LIMIT-${id}` })),
  };
  assert.equal((await preview(owner, admin.user.id, tooMany)).status, 400);
});

test('preview rejects credentials recursively and unsupported media assets', async () => {
  for (const key of [
    'password',
    'passwordHash',
    'password_hash',
    'access_token',
    'refresh_token',
    'provider_token',
    'csrfToken',
    'sessionToken',
  ]) {
    const records = {
      ...emptyRecords(),
      Clients: [{ client_id: `IMP-SECRET-${key}`, extra: [{ [key]: 'never-import' }] }],
    };
    assert.equal((await preview(owner, admin.user.id, records)).status, 400);
  }
  for (const media_photos of [
    null,
    {},
    [null],
    [{ name: 'image', src: 'javascript:alert(1)' }],
    [{ name: 'pdf', src: 'data:application/pdf;base64,AAA=' }],
  ]) {
    const records = {
      ...emptyRecords(),
      Properties: [{ property_id: 'IMP-BAD-MEDIA', media_photos }],
    };
    assert.equal((await preview(owner, admin.user.id, records)).status, 400);
  }
});

test('preview reports counts without creating records', async () => {
  const records = {
    Clients: [{ client_id: 'IMP-PREVIEW-CLIENT', private_extra: { code: 123 } }],
    Contacts: [{ contact_id: 'IMP-PREVIEW-CONTACT' }],
    Properties: [{ property_id: 'IMP-PREVIEW-PROPERTY', contact_id: 'IMP-PREVIEW-CONTACT' }],
  };
  const response = await preview(owner, admin.user.id, records);
  assert.equal(response.status, 200);
  assert.deepEqual(response.value.counts, { Clients: 1, Contacts: 1, Properties: 1 });
  assert.deepEqual(response.value.skipped, zeroCounts);
  const list = await owner.request(`/workspaces/${admin.user.id}/records`);
  assert.ok(
    !list.value.records.Clients.some((entry) => entry.record.client_id === 'IMP-PREVIEW-CLIENT'),
  );
});
