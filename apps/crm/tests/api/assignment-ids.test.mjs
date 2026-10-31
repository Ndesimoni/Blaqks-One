import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { commit, emptyRecords, planned } from './import-helpers.mjs';
import { add, assignmentTeams, history, list, workspacePath } from './assignment-helpers.mjs';

let owner, admin, other, one;
before(async () => ({ owner, admin, other, one } = await assignmentTeams('issued')));

const post = (session, collection, record) =>
  session.request(workspacePath(session, collection), { method: 'POST', body: { record } });

test('issued IDs continue past hidden and unparseable IDs and stop at the cap', async () => {
  for (const contact_id of ['CT-041', 'CT-1234567890', 'CT-ABC', 'ct-500', 'CT-07x']) {
    await add(admin, 'Contacts', { contact_id });
  }
  const issued = await add(one, 'Contacts', { full_name: 'Next' });
  assert.equal(issued.record.contact_id, 'CT-042');
  assert.equal((await add(admin, 'Contacts', { full_name: 'Team' })).record.contact_id, 'CT-043');
  const blank = await add(admin, 'Contacts', { contact_id: '  ', full_name: 'Blank' });
  assert.equal(blank.record.contact_id, 'CT-044');
  const numeric = await post(admin, 'Contacts', { contact_id: 7 });
  assert.equal(numeric.status, 400);
  await add(admin, 'Properties', { property_id: 'PR-999999998' });
  assert.equal((await add(one, 'Properties', {})).record.property_id, 'PR-999999999');
  const before = query(`SELECT count(*) FROM crm_records WHERE workspace_id='${admin.user.id}'`);
  for (const session of [one, admin]) {
    const full = await post(session, 'Properties', { listing_title: 'Overflow' });
    assert.equal(full.status, 409);
    assert.equal(full.value.code, 'conflict');
    assert.equal(full.value.message, 'No record IDs are left for this collection. Ask your Admin.');
  }
  assert.equal(
    query(`SELECT count(*) FROM crm_records WHERE workspace_id='${admin.user.id}'`),
    before,
  );
  const duplicate = await post(admin, 'Contacts', { contact_id: 'CT-042' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.value.message, 'That record ID is already in use.');
});

test('twenty parallel creates receive distinct sequential IDs', async () => {
  const client = await add(one, 'Clients', { full_name: 'Parallel owner' });
  const created = await Promise.all(
    Array.from({ length: 20 }, () =>
      post(one, 'Follow-ups', { client_id: client.record.client_id }),
    ),
  );
  assert.ok(created.every((result) => result.status === 201));
  const ids = created.map((result) => result.value.record.activity_id).sort();
  assert.deepEqual(
    ids,
    Array.from({ length: 20 }, (_, index) => `FU-${String(index + 1).padStart(3, '0')}`),
  );
  assert.equal((await list(one)).records['Follow-ups'].length, 20);
});

test('imported parents go to the destination owner with import history', async () => {
  const records = {
    ...emptyRecords(),
    Clients: [{ client_id: 'IMP-ASSIGN-CL' }],
    Contacts: [{ contact_id: 'IMP-ASSIGN-CT' }],
    Properties: [{ property_id: 'IMP-ASSIGN-PR', contact_id: 'IMP-ASSIGN-CT' }],
    'Follow-ups': [{ activity_id: 'IMP-ASSIGN-FU' }],
    Viewings: [{ viewing_id: 'IMP-ASSIGN-VW', client_id: 'IMP-ASSIGN-CL' }],
  };
  const plan = await planned(owner, other.user.id, records);
  assert.equal((await commit(owner, other.user.id, plan.token)).status, 200);
  const rows = query(
    `SELECT string_agg(legacy_id || '=' || coalesce(assignee_id::text,'-'), ',' ORDER BY legacy_id)
     FROM crm_records WHERE workspace_id='${other.user.id}' AND legacy_id LIKE 'IMP-ASSIGN-%'`,
  );
  const holder = other.user.id;
  assert.equal(
    rows,
    `IMP-ASSIGN-CL=${holder},IMP-ASSIGN-CT=${holder},IMP-ASSIGN-FU=-,IMP-ASSIGN-PR=${holder},IMP-ASSIGN-VW=-`,
  );
  const client = query(
    `SELECT id FROM crm_records WHERE workspace_id='${holder}' AND legacy_id='IMP-ASSIGN-CL'`,
  );
  assert.equal(history(client), `import:${holder}:${owner.user.id}`);
});
