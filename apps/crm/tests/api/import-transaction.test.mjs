import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  activityCount,
  commit,
  counts,
  emptyRecords,
  fixtures,
  planned,
  recordCount,
  tokenHash,
} from './import-helpers.mjs';

let admin;
before(async () => ({ admin } = await fixtures()));

test('a database failure rolls back every inserted record, audit entry and completion marker', async () => {
  const plan = await planned(admin, admin.user.id, {
    ...emptyRecords(),
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
    const response = await commit(admin, admin.user.id, plan.token);
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
  const retry = await commit(admin, admin.user.id, plan.token);
  assert.equal(retry.status, 200);
  assert.equal(retry.value.replayed, false);
  assert.deepEqual(retry.value.imported, counts({ Clients: 1, Contacts: 1, Properties: 1 }));
  assert.equal(activityCount(admin.user.id), before + 3);
});

const assignee = (id) =>
  query(
    `SELECT coalesce(assignee_id::text,'queue') FROM crm_records WHERE workspace_id='${admin.user.id}' AND legacy_id='${id}'`,
  );

test('parents go to the chosen member, who is checked again under the commit lock (T9)', async () => {
  const agent = await activate(await invite(admin, 'import-holder-agent'));
  const options = { memberId: agent.user.id };
  const plan = await planned(
    admin,
    admin.user.id,
    {
      ...emptyRecords(),
      Clients: [{ client_id: 'IMP-HELD-CLIENT' }],
      Contacts: [{ contact_id: 'IMP-HELD-CONTACT' }],
      'Follow-ups': [{ activity_id: 'IMP-HELD-FOLLOW', client_id: 'IMP-HELD-CLIENT' }],
    },
    'backup-personal',
    options,
  );
  assert.equal((await commit(admin, admin.user.id, plan.token)).status, 200);
  assert.equal(assignee('IMP-HELD-CLIENT'), agent.user.id);
  assert.equal(assignee('IMP-HELD-CONTACT'), agent.user.id);
  assert.equal(assignee('IMP-HELD-FOLLOW'), 'queue');
  // A member holding nothing: suspending them changes no records, so only the member
  // re-check (not the stale-preview check) can refuse the commit.
  const spare = await activate(await invite(admin, 'import-spare-agent'));
  const later = await planned(
    admin,
    admin.user.id,
    {
      ...emptyRecords(),
      Clients: [{ client_id: 'IMP-HELD-LATER' }],
    },
    'backup-personal',
    { memberId: spare.user.id },
  );
  const member = await findMember(admin, spare.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const refused = await commit(admin, admin.user.id, later.token);
  assert.equal(refused.status, 400);
  assert.equal(recordCount(admin.user.id, 'IMP-HELD-LATER'), 0);
  const organisationPlan = await planned(
    admin,
    admin.user.id,
    {
      ...emptyRecords(),
      Clients: [{ client_id: 'IMP-HELD-ORGANISATION' }],
    },
    'super-admin-workspace',
  );
  assert.equal((await commit(admin, admin.user.id, organisationPlan.token)).status, 200);
  assert.equal(assignee('IMP-HELD-ORGANISATION'), admin.user.id);
});
