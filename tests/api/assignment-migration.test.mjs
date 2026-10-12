import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  createSeedDatabase,
  dropSeedDatabase,
  migrate,
  migrationFiles,
  seedFailure,
  seedQuery,
  viewColumns,
} from './assignment-db.mjs';
import { ids, records, seedSql } from './assignment-seed.mjs';

const views = ['crm_all_user_profiles', 'crm_user_profiles', 'crm_member_profiles'];
const columnsBefore = {};

before(() => {
  createSeedDatabase();
  for (const view of views) columnsBefore[view] = viewColumns(view);
  seedQuery(seedSql());
  assert.equal(migrationFiles().at(-1), '0008_assignments.sql');
  migrate('0008_assignments.sql');
});
after(dropSeedDatabase);

const rows = () =>
  Object.fromEntries(
    seedQuery(
      `SELECT legacy_id, coalesce(assignee_id::text,'-'), version, updated_at=
         '2020-01-02T00:00:00Z'::timestamptz FROM crm_records ORDER BY legacy_id`,
    )
      .split('\n')
      .map((line) => line.split('|'))
      .map(([legacy, assignee, version, kept]) => [legacy, { assignee, version, kept }]),
  );

test('0008 applies to a seeded 0007 database and appends record_scope to every profile view', () => {
  for (const view of views) {
    assert.deepEqual(viewColumns(view), [...columnsBefore[view], 'record_scope'], view);
  }
  assert.equal(
    seedQuery(`SELECT string_agg(DISTINCT record_scope, ',') FROM crm_member_profiles`),
    'assigned',
  );
  assert.equal(
    seedQuery(
      `SELECT count(*) FROM crm_user_profiles WHERE id IN ('${ids.archived}','${ids.d}','${ids.archivedTeam}')`,
    ),
    '0',
  );
});

test('backfill assigns eligible staff creators and otherwise the owner or nobody', () => {
  const current = rows();
  for (const record of records) {
    const row = current[record.legacy];
    assert.equal(row.assignee, record.expected ?? '-', record.legacy);
    assert.equal(row.version, '3', `${record.legacy} version`);
    assert.equal(row.kept, 't', `${record.legacy} updated_at`);
  }
  assert.equal(
    seedQuery(
      `SELECT count(*) FROM crm_records WHERE assignee_id IS NOT NULL AND collection IN
         ('Viewings','Shortlist','Interaction log','Client care')`,
    ),
    '0',
  );
  assert.equal(
    seedQuery(
      `SELECT count(*) FROM crm_records r JOIN crm_workspaces w ON w.id=r.workspace_id
       JOIN crm_users u ON u.id=r.assignee_id
       WHERE u.id<>w.owner_id AND u.workspace_id IS DISTINCT FROM r.workspace_id`,
    ),
    '0',
  );
});

test('backfill writes exactly one history row per assigned record', () => {
  const assigned = Number(
    seedQuery(`SELECT count(*) FROM crm_records WHERE assignee_id IS NOT NULL`),
  );
  assert.equal(assigned, records.filter((record) => record.expected).length);
  assert.equal(
    seedQuery(
      `SELECT count(*) FROM crm_assignments h JOIN crm_records r ON r.id=h.record_id
       WHERE h.reason='backfill' AND h.actor_id IS NULL AND h.from_id IS NULL
         AND h.to_id=r.assignee_id AND h.workspace_id=r.workspace_id
         AND h.collection=r.collection`,
    ),
    String(assigned),
  );
  assert.equal(seedQuery(`SELECT count(*) FROM crm_assignments`), String(assigned));
  assert.equal(
    seedQuery(`SELECT count(*) FROM (SELECT record_id FROM crm_assignments
      GROUP BY record_id HAVING count(*)>1) duplicates`),
    '0',
  );
});

test('the record scope grant is limited to staff', () => {
  seedQuery(`UPDATE crm_users SET record_scope='team' WHERE id='${ids.eligible}'`);
  assert.equal(
    seedQuery(`SELECT record_scope FROM crm_user_profiles WHERE id='${ids.eligible}'`),
    'team',
  );
  for (const id of [ids.a, ids.sa]) {
    assert.match(
      seedFailure(`UPDATE crm_users SET record_scope='team' WHERE id='${id}'`),
      /crm_record_scope_staff/,
    );
  }
  assert.match(
    seedFailure(`UPDATE crm_users SET record_scope='all' WHERE id='${ids.eligible}'`),
    /record_scope_check/,
  );
  seedQuery(`UPDATE crm_users SET record_scope='assigned' WHERE id='${ids.eligible}'`);
});
