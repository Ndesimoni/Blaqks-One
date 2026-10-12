import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  activityCount,
  commit,
  fixtures,
  planned,
  recordCount,
  tokenHash,
} from './import-helpers.mjs';

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

test('a database failure rolls back every inserted record, audit entry and completion marker', async () => {
  const plan = await planned(owner, admin.user.id, {
    Clients: [{ client_id: 'IMP-TX-CLIENT' }],
    Contacts: [{ contact_id: 'IMP-TX-CONTACT' }],
    Properties: [{ property_id: 'IMP-TX-FAIL', contact_id: 'IMP-TX-CONTACT' }],
  });
  const before = activityCount(admin.user.id);
  query(`CREATE FUNCTION crm_test_reject_import() RETURNS trigger AS $$
    BEGIN
      IF NEW.legacy_id = 'IMP-TX-FAIL' THEN
        RAISE EXCEPTION 'Synthetic database failure must not leak';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER crm_test_reject_import BEFORE INSERT ON crm_records
    FOR EACH ROW EXECUTE FUNCTION crm_test_reject_import()`);
  try {
    const response = await commit(owner, admin.user.id, plan.token);
    assert.equal(response.status, 503);
    assert.equal(response.value.code, 'database_unavailable');
    assert.ok(!JSON.stringify(response.value).includes('Synthetic database failure'));
    for (const id of ['IMP-TX-CLIENT', 'IMP-TX-CONTACT', 'IMP-TX-FAIL']) {
      assert.equal(recordCount(admin.user.id, id), 0);
    }
    assert.equal(activityCount(admin.user.id), before);
    assert.equal(
      query(
        `SELECT result IS NULL FROM crm_import_plans WHERE token_hash='${tokenHash(plan.token)}'`,
      ),
      't',
    );
  } finally {
    query(
      'DROP TRIGGER crm_test_reject_import ON crm_records; DROP FUNCTION crm_test_reject_import()',
    );
  }
  const retry = await commit(owner, admin.user.id, plan.token);
  assert.equal(retry.status, 200);
  assert.equal(retry.value.replayed, false);
  assert.deepEqual(retry.value.imported, { Clients: 1, Contacts: 1, Properties: 1 });
  assert.equal(activityCount(admin.user.id), before + 3);
});
