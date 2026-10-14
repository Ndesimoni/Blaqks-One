import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, query } from './helpers.mjs';
import { legacyCount, referralTeams } from './referral-helpers.mjs';

const linked = { message: 'A linked record prevents this change.', code: 'conflict' };
const missingReferral = {
  message:
    'The referred client is missing from this workspace. Choose another client or clear the referral.',
  code: 'link_missing',
};
let admin, other;
before(async () => ({ admin, other } = await referralTeams('referral-links')));

const path = (collection, id) =>
  `/workspaces/${admin.user.id}/records/${encodeURIComponent(collection)}${id ? `/${id}` : ''}`;
const post = (collection, record) =>
  admin.request(path(collection), { method: 'POST', body: { record } });
const referralRef = (id) =>
  query(`SELECT coalesce(referral_ref,'-') FROM crm_records WHERE id='${id}'`);

test('referrals must name a Client in the same workspace with a specific message', async () => {
  const referrer = await create(admin, 'Clients', { client_id: 'REF-SOURCE', full_name: 'Source' });
  await create(other, 'Clients', { client_id: 'REF-FOREIGN', full_name: 'Other team' });
  for (const [collection, record] of [
    ['Clients', { client_id: 'REF-CROSS', referred_by_client_id: 'REF-FOREIGN' }],
    ['Clients', { client_id: 'REF-MISSING', referred_by_client_id: 'REF-NOBODY' }],
    ['Client care', { care_id: 'REF-CARE-CROSS', referred_client_id: 'REF-FOREIGN' }],
    ['Client care', { care_id: 'REF-CARE-MISSING', referred_client_id: 'REF-NOBODY' }],
  ]) {
    const response = await post(collection, record);
    assert.equal(response.status, 409, JSON.stringify(record));
    assert.deepEqual(response.value, missingReferral);
  }
  for (const id of ['REF-CROSS', 'REF-MISSING', 'REF-CARE-CROSS', 'REF-CARE-MISSING']) {
    assert.equal(legacyCount(admin.user.id, id), 0, `${id} must roll back with its activity`);
  }
  const self = await post('Clients', {
    client_id: 'REF-SELF',
    referred_by_client_id: ' REF-SELF ',
  });
  assert.equal(self.status, 400);
  assert.equal(self.value.message, 'A client cannot be recorded as their own referrer.');
  const referred = await create(admin, 'Clients', {
    client_id: 'REF-REFERRED',
    referred_by_client_id: ' REF-SOURCE ',
  });
  assert.equal(referred.record.referred_by_client_id, 'REF-SOURCE');
  assert.equal(referralRef(referred.id), 'REF-SOURCE');
  const care = await create(admin, 'Client care', {
    care_id: 'REF-CARE',
    client_id: 'REF-SOURCE',
    referred_client_id: 'REF-REFERRED',
  });
  assert.equal(referralRef(care.id), 'REF-REFERRED');
  const moved = await admin.request(path('Clients', referred.id), {
    method: 'PATCH',
    body: {
      version: 1,
      record: { client_id: 'REF-REFERRED', referred_by_client_id: 'REF-NOBODY' },
    },
  });
  assert.equal(moved.status, 409);
  assert.deepEqual(moved.value, missingReferral);
  assert.equal(referralRef(referred.id), 'REF-SOURCE');
  assert.equal(referrer.version, 1);
});

test('referenced clients cannot be deleted or renamed; the check runs at commit', async () => {
  const source = await create(admin, 'Clients', { client_id: 'REF-HOLD', full_name: 'Holder' });
  const referred = await create(admin, 'Clients', {
    client_id: 'REF-HELD',
    referred_by_client_id: 'REF-HOLD',
  });
  const removed = await admin.request(path('Clients', source.id), {
    method: 'DELETE',
    body: { version: 1 },
  });
  assert.equal(removed.status, 409);
  assert.deepEqual(removed.value, linked);
  const renamed = await admin.request(path('Clients', source.id), {
    method: 'PATCH',
    body: { version: 1, record: { client_id: 'REF-HOLD-RENAMED', full_name: 'Holder' } },
  });
  assert.equal(renamed.status, 409);
  assert.deepEqual(renamed.value, linked);
  assert.equal(legacyCount(admin.user.id, 'REF-HOLD'), 1);
  const kept = await admin.request(path('Clients', referred.id), {
    method: 'PATCH',
    body: { version: 1, record: { client_id: 'REF-HELD-2', referred_by_client_id: 'REF-HOLD' } },
  });
  assert.equal(kept.status, 200, JSON.stringify(kept.value));
  assert.equal(referralRef(referred.id), 'REF-HOLD');
  const ownOldId = await admin.request(path('Clients', referred.id), {
    method: 'PATCH',
    body: { version: 2, record: { client_id: 'REF-HELD-3', referred_by_client_id: 'REF-HELD-2' } },
  });
  assert.deepEqual([ownOldId.status, ownOldId.value], [409, missingReferral]);
  const cleared = await admin.request(path('Clients', referred.id), {
    method: 'PATCH',
    body: { version: 2, record: { client_id: 'REF-HELD-2', referred_by_client_id: '' } },
  });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  assert.equal(referralRef(referred.id), '-');
  const deleted = await admin.request(path('Clients', source.id), {
    method: 'DELETE',
    body: { version: 1 },
  });
  assert.equal(deleted.status, 200);
  const list = await admin.request(`/workspaces/${admin.user.id}/records`);
  assert.equal(list.status, 200);
  assert.ok(!list.value.records.Clients.some((entry) => entry.id === source.id));
});
