import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';
import { admins, ids, seedSql, staff } from './permission-seed.mjs';

// A disposable database seeded before 0009, migrated through 0010, then given 0011.
const db = seededDatabase('kws_finance_0010', '0009');
const snapshot = () => db.query(`SELECT jsonb_object_agg(id, actions) FROM crm_users`);
const stored = (name) =>
  JSON.parse(db.query(`SELECT actions FROM crm_users WHERE id='${ids[name]}'`));
const live = Object.entries(staff).filter(([, row]) => !row[3]);
const versions = () =>
  db.query(`SELECT string_agg(id || ':' || version, ',' ORDER BY id) FROM crm_users`);
let before0011, versionsBefore;

before(() => {
  db.create();
  db.query(seedSql());
  db.migrate('0009_action_grants.sql');
  db.migrate('0010_sample_data.sql');
  before0011 = JSON.parse(snapshot());
  versionsBefore = versions();
  db.migrate('0011_finance_settings.sql');
});
after(db.drop);

test('0011 backfills finance from the module for every non-archived staff row', () => {
  for (const [name, row] of live) {
    const finance = row[5].finance === true;
    const want = { create: finance, edit: finance, assign: finance };
    assert.deepEqual(stored(name), {
      ...before0011[ids[name]],
      finance: { ...want, approve: false, teamView: false },
    });
  }
  for (const name of [...Object.keys(admins), 'archived', 'archivedTeam']) {
    assert.deepEqual(stored(name), before0011[ids[name]], name);
  }
  assert.equal(versions(), versionsBefore, 'versions are untouched');
  assert.equal(
    db.query(`SELECT user_id FROM crm_sessions WHERE token_hash='seed-session'`),
    ids.teamFull,
  );
});

test('database guards: teamView needs team scope, approve needs teamView, flags need the module', () => {
  const set = (name, path, value) =>
    `UPDATE crm_users SET actions=jsonb_set(actions,'{finance,${path}}','${value}')
     WHERE id='${ids[name]}'`;
  const failing = [
    [set('assignedFull', 'teamView', true), /crm_actions_finance_team/],
    [set('teamFull', 'approve', true), /crm_actions_finance_approve/],
    [set('teamNoSchedule', 'create', true), /crm_actions_finance_module/],
    [
      `UPDATE crm_users SET permissions=permissions||'{"finance":false}' WHERE id='${ids.teamFull}'`,
      /crm_actions_finance_module/,
    ],
  ];
  for (const [sql, constraint] of failing) assert.match(db.failure(sql), constraint);
  db.query(
    `UPDATE crm_users SET actions=jsonb_set(jsonb_set(actions,'{finance,teamView}','true'),
     '{finance,approve}','true') WHERE id='${ids.teamFull}'`,
  );
  assert.equal(stored('teamFull').finance.approve, true);
});

test('0011 creates the finance tables, refuses edits to history and is idempotent', () => {
  const tables = db.query(
    `SELECT string_agg(relname, ',' ORDER BY relname) FROM pg_class WHERE relkind='r'
     AND relname IN ('crm_finance_settings','crm_commission_agreements','crm_finance_events')`,
  );
  assert.equal(tables, 'crm_commission_agreements,crm_finance_events,crm_finance_settings');
  assert.equal(db.query(`SELECT count(*) FROM pg_extension WHERE extname='btree_gist'`), '1');
  const current = snapshot();
  db.migrate('0011_finance_settings.sql');
  assert.equal(snapshot(), current);
  db.query(`INSERT INTO crm_finance_events (id,workspace_id,entity,entity_id,action,actor_id)
    VALUES (gen_random_uuid(),'${ids.a}','settings',gen_random_uuid(),'created','${ids.a}')`);
  assert.match(db.failure(`UPDATE crm_finance_events SET action='updated'`), /append-only/);
  assert.match(db.failure(`DELETE FROM crm_finance_events`), /append-only/);
  assert.match(
    db.failure(`INSERT INTO crm_finance_events (id,workspace_id,entity,entity_id,action,actor_id)
      VALUES (gen_random_uuid(),'${ids.a}','settings',gen_random_uuid(),'paid','${ids.a}')`),
    /crm_finance_events_action_check/,
  );
});

test('0011 refuses non-boolean finance grants and leaves the row unchanged', () => {
  const bad = ids.a.replace(/10$/, '98');
  db.query(`INSERT INTO crm_users (id,name,email,phone,password_hash,role,owner_id,workspace_id,
      permissions,actions) VALUES ('${bad}','Bad','bad-fin@seed.test','+971500000000','x',
      'staff','${ids.a}','${ids.a}','{"finance":"yes"}','{"schedule":{"create":false}}')`);
  let error = '';
  try {
    db.migrate('0011_finance_settings.sql');
  } catch (caught) {
    error = String(caught.stderr);
  }
  assert.match(error, /non-boolean finance grant/);
  assert.deepEqual(JSON.parse(db.query(`SELECT actions FROM crm_users WHERE id='${bad}'`)), {
    schedule: { create: false },
  });
  db.query(`DELETE FROM crm_users WHERE id='${bad}'`);
});
