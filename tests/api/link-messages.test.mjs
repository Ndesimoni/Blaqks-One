import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create } from './helpers.mjs';
import { legacyCount, referralTeams } from './referral-helpers.mjs';

const messages = {
  client: 'The linked client is missing from this workspace. Choose another client.',
  property:
    'The linked property is missing from this workspace. Choose another property or clear it.',
  contact: 'The linked contact is missing from this workspace. Choose another contact or clear it.',
};
let admin, other;
before(async () => ({ admin, other } = await referralTeams('link-messages')));

const path = (collection, id) =>
  `/workspaces/${admin.user.id}/records/${encodeURIComponent(collection)}${id ? `/${id}` : ''}`;
const post = (collection, record) =>
  admin.request(path(collection), { method: 'POST', body: { record } });

test('missing or cross-workspace links name the missing record type', async () => {
  await create(admin, 'Clients', { client_id: 'LNK-CLIENT', full_name: 'Present' });
  await create(admin, 'Properties', { property_id: 'LNK-PROPERTY', listing_title: 'Villa' });
  await create(other, 'Contacts', { contact_id: 'LNK-FOREIGN', full_name: 'Other team' });
  for (const [collection, record, message] of [
    ['Viewings', { viewing_id: 'LNK-V1', client_id: 'LNK-NONE' }, messages.client],
    [
      'Viewings',
      { viewing_id: 'LNK-V2', client_id: 'LNK-NONE', property_id: 'LNK-NONE' },
      messages.client,
    ],
    [
      'Viewings',
      { viewing_id: 'LNK-V3', client_id: 'LNK-CLIENT', property_id: 'LNK-NONE' },
      messages.property,
    ],
    ['Properties', { property_id: 'LNK-P1', contact_id: 'LNK-NONE' }, messages.contact],
    ['Properties', { property_id: 'LNK-P2', contact_id: 'LNK-FOREIGN' }, messages.contact],
  ]) {
    const response = await post(collection, record);
    assert.equal(response.status, 409, JSON.stringify(record));
    assert.deepEqual(response.value, { message, code: 'link_missing' });
  }
  for (const id of ['LNK-V1', 'LNK-V2', 'LNK-V3', 'LNK-P1', 'LNK-P2']) {
    assert.equal(legacyCount(admin.user.id, id), 0, id);
  }
  const viewing = await create(admin, 'Viewings', {
    viewing_id: 'LNK-VIEW',
    client_id: 'LNK-CLIENT',
    property_id: 'LNK-PROPERTY',
  });
  const update = await admin.request(path('Viewings', viewing.id), {
    method: 'PATCH',
    body: { version: 1, record: { ...viewing.record, property_id: 'LNK-GONE' } },
  });
  assert.equal(update.status, 409);
  assert.deepEqual(update.value, { message: messages.property, code: 'link_missing' });
});
