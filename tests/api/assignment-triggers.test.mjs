import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  createSeedDatabase,
  dropSeedDatabase,
  migrate,
  seedFailure,
  seedQuery,
} from './assignment-db.mjs';
import { ids, records, seedSql } from './assignment-seed.mjs';

before(() => {
  createSeedDatabase();
  seedQuery(seedSql());
  migrate('0008_assignments.sql');
});
after(dropSeedDatabase);

const recordId = (legacy) => records.find((record) => record.legacy === legacy).id;
const assign = (legacy, assignee) =>
  `UPDATE crm_records SET assignee_id='${assignee}' WHERE id='${recordId(legacy)}'`;
const ineligible = /Assignee is not an active member of this workspace/;

test('the backstop rejects assignees outside the workspace or without an active membership', () => {
  for (const assignee of [ids.otherTeam, ids.b, ids.inactive, ids.archived, ids.orgStaff]) {
    assert.match(seedFailure(assign('A-CL-ADMIN', assignee)), ineligible, assignee);
  }
  // Staff whose Admin is suspended are not eligible, nor is the suspended Admin.
  assert.match(seedFailure(assign('C-CL-STAFF', ids.ownerInactive)), ineligible);
  assert.match(seedFailure(assign('C-FU-STAFF', ids.c)), ineligible);
  assert.match(
    seedFailure(
      `INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload,assignee_id)
       VALUES (gen_random_uuid(),'${ids.a}','Clients','A-CL-INSERT','{}','${ids.otherTeam}')`,
    ),
    ineligible,
  );
  assert.match(seedFailure(assign('A-VW-CHILD', ids.eligible)), /crm_records_assignable/);
  seedQuery(assign('A-CL-ADMIN', ids.eligible));
  seedQuery(assign('A-CL-ADMIN', ids.a));
  seedQuery(assign('ORG-CL-STAFF', ids.sa));
  // Rows that keep a backfilled owner who is no longer active stay editable.
  seedQuery(
    `UPDATE crm_records SET payload='{"edited":true}' WHERE id='${recordId('C-CL-STAFF')}'`,
  );
  seedQuery(`UPDATE crm_records SET version=version+1 WHERE id='${recordId('D-CL-STAFF')}'`);
  assert.equal(
    seedQuery(`SELECT assignee_id FROM crm_records WHERE id='${recordId('A-CL-ADMIN')}'`),
    ids.a,
  );
});

test('assignment history is append-only and notes are read-only but follow their record', () => {
  const target = recordId('A-CL-NONE');
  const history = '00000000-0000-4000-8000-000000000900';
  seedQuery(
    `INSERT INTO crm_assignments (id,workspace_id,record_id,collection,from_id,to_id,actor_id,reason)
     VALUES ('${history}','${ids.a}','${target}','Clients','${ids.a}','${ids.eligible}',
       '${ids.a}','reassigned');
     INSERT INTO crm_assignment_notes (assignment_id,record_id,note)
     VALUES ('${history}','${target}','Call the landlord first.')`,
  );
  assert.match(
    seedFailure(`UPDATE crm_assignments SET reason='bulk' WHERE id='${history}'`),
    /append-only/,
  );
  assert.match(seedFailure(`DELETE FROM crm_assignments WHERE id='${history}'`), /append-only/);
  assert.match(
    seedFailure(`UPDATE crm_assignment_notes SET note='Changed' WHERE assignment_id='${history}'`),
    /Hand-off notes are read-only/,
  );
  assert.match(
    seedFailure(
      `INSERT INTO crm_assignments (id,workspace_id,record_id,collection,to_id,reason)
       VALUES (gen_random_uuid(),'${ids.a}','${target}','Clients','${ids.a}','reassigned')`,
    ),
    /crm_assignments_check/,
  );
  assert.match(
    seedFailure(
      `INSERT INTO crm_assignment_notes (assignment_id,record_id,note)
       SELECT id,record_id,'' FROM crm_assignments WHERE record_id='${recordId('A-CL-ADMIN')}'
       LIMIT 1`,
    ),
    /crm_assignment_notes_note_check/,
  );
  seedQuery(`DELETE FROM crm_records WHERE id='${target}'`);
  assert.equal(seedQuery(`SELECT count(*) FROM crm_assignment_notes`), '0');
  assert.equal(seedQuery(`SELECT count(*) FROM crm_assignments WHERE record_id='${target}'`), '2');
});

test('activity accepts the assigned action and still rejects unknown actions', () => {
  const insert = (action) =>
    `INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,record_id)
     VALUES (gen_random_uuid(),'${ids.a}','${ids.a}','${action}','Clients',
       '${recordId('A-CL-ADMIN')}')`;
  seedQuery(insert('assigned'));
  assert.match(seedFailure(insert('handed-off')), /crm_activity_action_check/);
});
