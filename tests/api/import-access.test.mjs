import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  commit,
  emptyRecords,
  fixtures,
  organisation,
  planned,
  preview,
  tokenHash,
} from './import-helpers.mjs';

let owner, admin, other;
before(async () => ({ owner, admin, other } = await fixtures()));

test('imports require Super Admin, exact Origin and session-bound CSRF', async () => {
  const records = emptyRecords();
  assert.equal((await preview(admin, admin.user.id, records)).status, 403);
  const plan = await planned(owner, admin.user.id, records);
  assert.equal((await commit(admin, admin.user.id, plan.token)).status, 403);
  for (const options of [
    { csrf: undefined },
    { csrf: admin.csrf },
    { headers: { Origin: 'https://untrusted.example' } },
  ]) {
    assert.equal(
      (await preview(owner, admin.user.id, records, 'backup-personal', options)).status,
      403,
    );
    assert.equal((await commit(owner, admin.user.id, plan.token, options)).status, 403);
  }
  const response = await commit(owner, admin.user.id, plan.token);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('organisation and personal provenance cannot change ownership namespaces', async () => {
  const records = emptyRecords();
  assert.equal((await preview(owner, admin.user.id, records, organisation)).status, 403);
  assert.equal((await preview(owner, organisation, records, 'backup-personal')).status, 403);
  assert.equal((await preview(owner, organisation, records, 'legacy-aidah')).status, 403);
  assert.equal((await preview(owner, organisation, records, organisation)).status, 200);
  assert.equal((await preview(owner, owner.user.id, records, 'backup-personal')).status, 200);
  assert.equal((await preview(owner, admin.user.id, records, 'legacy-aidah')).status, 200);
});

test('tokens are bound to actor and workspace and must still be unexpired', async () => {
  const plan = await planned(owner, admin.user.id, emptyRecords());
  assert.equal((await commit(owner, other.user.id, plan.token)).status, 403);
  assert.equal((await commit(owner, admin.user.id, 'x'.repeat(43))).status, 403);
  const hash = tokenHash(plan.token);
  query(`UPDATE crm_import_plans SET actor_id='${other.user.id}' WHERE token_hash='${hash}'`);
  assert.equal((await commit(owner, admin.user.id, plan.token)).status, 403);
  query(
    `UPDATE crm_import_plans SET actor_id='${owner.user.id}',expires_at=clock_timestamp()-interval '1 second' WHERE token_hash='${hash}'`,
  );
  const expired = await commit(owner, admin.user.id, plan.token);
  assert.equal(expired.status, 400);
  assert.match(expired.value.message, /expired/i);
});
