import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';
import { create, query } from './helpers.mjs';
import { commit, counts, emptyRecords, planned, preview } from './import-helpers.mjs';
import { referralRef as ref, referralTeams } from './referral-helpers.mjs';

let owner, admin, other;
before(async () => ({ owner, admin, other } = await referralTeams('referral-legacy')));

const migration = readFileSync('services/crm-api/migrations/0007_client_referrals.sql', 'utf8');
const backfill = migration.match(/^WITH referrals[\s\S]*?;/m)[0];

test('imports accept referrers later in the same batch and reject missing ones', async () => {
  const records = {
    ...emptyRecords(),
    Clients: [
      { client_id: 'REF-IMP-A', referred_by_client_id: 'REF-IMP-B' },
      { client_id: 'REF-IMP-B', full_name: 'Arrives later' },
    ],
    'Client care': [
      { care_id: 'REF-IMP-CARE', client_id: 'REF-IMP-B', referred_client_id: 'REF-IMP-A' },
    ],
  };
  const plan = await planned(owner, admin.user.id, records);
  const result = await commit(owner, admin.user.id, plan.token);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.deepEqual(result.value.imported, counts({ Clients: 2, 'Client care': 1 }));
  assert.equal(ref(admin.user.id, 'REF-IMP-A'), 'REF-IMP-B');
  assert.equal(ref(admin.user.id, 'REF-IMP-CARE'), 'REF-IMP-A');
  for (const rows of [
    { Clients: [{ client_id: 'REF-IMP-C', referred_by_client_id: 'REF-IMP-NONE' }] },
    { 'Client care': [{ care_id: 'REF-IMP-CC', referred_client_id: 'REF-IMP-NONE' }] },
    { Clients: [{ client_id: 'REF-IMP-D', referred_by_client_id: 'REF-IMP-D' }] },
  ]) {
    const response = await preview(owner, admin.user.id, { ...emptyRecords(), ...rows });
    assert.equal(response.status, 400, JSON.stringify(rows));
  }
});

test('migration backfill links only same-workspace referrers and keeps legacy payloads', async () => {
  await create(admin, 'Clients', { client_id: 'REF-OLD-TARGET', full_name: 'Existing' });
  await create(other, 'Clients', { client_id: 'REF-OLD-FOREIGN', full_name: 'Other team' });
  const workspace = admin.user.id;
  const legacy = [
    [
      'Clients',
      'REF-OLD-LINKED',
      { client_id: 'REF-OLD-LINKED', referred_by_client_id: ' REF-OLD-TARGET ' },
    ],
    [
      'Clients',
      'REF-OLD-DANGLING',
      { client_id: 'REF-OLD-DANGLING', referred_by_client_id: 'REF-GONE' },
    ],
    [
      'Clients',
      'REF-OLD-CROSS',
      { client_id: 'REF-OLD-CROSS', referred_by_client_id: 'REF-OLD-FOREIGN' },
    ],
    [
      'Clients',
      'REF-OLD-SELF',
      { client_id: 'REF-OLD-SELF', referred_by_client_id: 'REF-OLD-SELF' },
    ],
    ['Clients', 'REF-OLD-NUMBER', { client_id: 'REF-OLD-NUMBER', referred_by_client_id: 7 }],
    [
      'Client care',
      'REF-OLD-CARE',
      { care_id: 'REF-OLD-CARE', referred_client_id: 'REF-OLD-TARGET' },
    ],
  ];
  const values = legacy
    .map(
      ([collection, id, payload]) =>
        `(gen_random_uuid(),'${workspace}','${collection}','${id}','${JSON.stringify(payload)}'::jsonb)`,
    )
    .join(',');
  query(`INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload) VALUES ${values}`);
  query(backfill);
  assert.equal(ref(workspace, 'REF-OLD-LINKED'), 'REF-OLD-TARGET');
  assert.equal(ref(workspace, 'REF-OLD-CARE'), 'REF-OLD-TARGET');
  for (const id of ['REF-OLD-DANGLING', 'REF-OLD-CROSS', 'REF-OLD-SELF', 'REF-OLD-NUMBER']) {
    assert.equal(ref(workspace, id), '-', id);
  }
  const versions = query(
    `SELECT DISTINCT version FROM crm_records WHERE workspace_id='${workspace}' AND legacy_id LIKE 'REF-OLD-%'`,
  );
  assert.equal(versions, '1');
  const list = await admin.request(`/workspaces/${workspace}/records`);
  assert.equal(list.status, 200);
  const dangling = list.value.records.Clients.find(
    (entry) => entry.record.client_id === 'REF-OLD-DANGLING',
  );
  assert.equal(dangling.record.referred_by_client_id, 'REF-GONE');
  const path = `/workspaces/${workspace}/records/Clients/${dangling.id}`;
  const untouched = await admin.request(path, {
    method: 'PATCH',
    body: { version: 1, record: { ...dangling.record, full_name: 'Edited' } },
  });
  assert.equal(untouched.status, 409);
  assert.equal(untouched.value.code, 'link_missing');
  assert.match(untouched.value.message, /^The referred client is missing from this workspace\./);
  const fixed = await admin.request(path, {
    method: 'PATCH',
    body: { version: 1, record: { ...dangling.record, referred_by_client_id: 'REF-OLD-TARGET' } },
  });
  assert.equal(fixed.status, 200, JSON.stringify(fixed.value));
  assert.equal(ref(workspace, 'REF-OLD-DANGLING'), 'REF-OLD-TARGET');
});
