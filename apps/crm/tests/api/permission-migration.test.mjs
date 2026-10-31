import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';
import { ASSIGNABLE, COLLECTIONS, PARENTS, moduleOf } from './permission-helpers.mjs';
import { admins, ids, seedSql, staff } from './permission-seed.mjs';

const db = seededDatabase('kws_actions_0008', '0009');
const views = ['crm_all_user_profiles', 'crm_user_profiles', 'crm_member_profiles'];
const columns = (view) =>
  db
    .query(
      `SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute
      WHERE attrelid='${view}'::regclass AND attnum>0 AND NOT attisdropped`,
    )
    .split(',');
const columnsBefore = {};
const snapshot = () => db.query(`SELECT jsonb_object_agg(id, actions) FROM crm_users`);
const stored = (name) =>
  JSON.parse(db.query(`SELECT actions FROM crm_users WHERE id='${ids[name]}'`));
const live = Object.entries(staff).filter(([, row]) => !row[3]);
let versions;

before(() => {
  db.create();
  for (const view of views) columnsBefore[view] = columns(view);
  db.query(seedSql());
  versions = db.query(`SELECT string_agg(id || ':' || version, ',' ORDER BY id) FROM crm_users`);
  db.migrate('0009_action_grants.sql');
});
after(db.drop);

/** The documented backfill: today's abilities; deleteMain needs team scope and coverage. */
function backfill([, , , , scope, permissions]) {
  const [r, p, s] = ['relationships', 'properties', 'schedule'].map((m) => permissions[m] === true);
  const team = scope === 'team';
  return {
    relationships: { create: r, edit: r, assign: r, deleteMain: r && team && p },
    properties: { create: p, edit: p, assign: p, deleteActivity: p, deleteMain: p && team && s },
    schedule: { create: s, edit: s, assign: s, deleteActivity: s },
  };
}

/** Pre-A2 rules: module grants allowed everything except parent deletes without team scope. */
function preA2([, , , , scope, permissions], collection, action) {
  if (permissions[moduleOf(collection)] !== true) return false;
  if (action === 'assign') return ASSIGNABLE.includes(collection);
  return action !== 'delete' || !PARENTS.includes(collection) || scope === 'team';
}

const covers = {
  Clients: ['schedule', 'properties'],
  Properties: ['schedule'],
  Contacts: ['properties'],
};
function afterA2(row, actions, collection, action) {
  const [, , , , scope, permissions] = row;
  if (permissions[moduleOf(collection)] !== true) return false;
  const flags = actions[moduleOf(collection)];
  if (action === 'assign') return ASSIGNABLE.includes(collection) && flags.assign;
  if (action !== 'delete') return flags[action];
  if (!PARENTS.includes(collection)) return flags.deleteActivity;
  const covered = covers[collection].every((module) => permissions[module] === true);
  return scope === 'team' && flags.deleteMain && covered;
}

test('0009 appends actions to every profile view and keeps versions and sessions', () => {
  for (const view of views) assert.deepEqual(columns(view), [...columnsBefore[view], 'actions']);
  assert.equal(
    db.query(`SELECT string_agg(id || ':' || version, ',' ORDER BY id) FROM crm_users`),
    versions,
  );
  assert.equal(
    db.query(`SELECT user_id FROM crm_sessions WHERE token_hash='seed-session'`),
    ids.teamFull,
  );
});

test('backfill fills every non-archived staff row, including pending and suspended ones', () => {
  for (const [name, row] of live) assert.deepEqual(stored(name), backfill(row), name);
  for (const name of [...Object.keys(admins), 'archived', 'archivedTeam']) {
    assert.deepEqual(stored(name), {}, name);
  }
});

test('golden table: only the M-C coverage rule removes pre-A2 abilities', () => {
  const losses = [];
  for (const [name, row] of live) {
    for (const collection of COLLECTIONS) {
      for (const action of ['create', 'edit', 'delete', 'assign']) {
        const before = preA2(row, collection, action);
        const now = afterA2(row, stored(name), collection, action);
        if (before === now) continue;
        assert.ok(before && action === 'delete' && PARENTS.includes(collection), name);
        losses.push(`${name}:${collection}`);
      }
    }
  }
  assert.deepEqual(losses.sort(), [
    'teamNoSchedule:Clients',
    'teamNoSchedule:Properties',
    'teamRelOnly:Clients',
    'teamRelOnly:Contacts',
  ]);
  console.log(`# Members losing parent deletes under M-C: ${losses.join(', ')}`);
});

test('database guards keep grants on staff and deleteMain on whole-team staff', () => {
  const failing = [
    [
      `UPDATE crm_users SET actions='{"relationships":{}}' WHERE id='${ids.a}'`,
      /crm_actions_staff/,
    ],
    [`UPDATE crm_users SET actions='[]' WHERE id='${ids.teamFull}'`, /crm_actions_object/],
    [
      `UPDATE crm_users SET record_scope='assigned' WHERE id='${ids.teamFull}'`,
      /crm_actions_delete_main/,
    ],
  ];
  for (const [sql, constraint] of failing) assert.match(db.failure(sql), constraint);
  db.query(`INSERT INTO crm_team_activity (id,actor_id,workspace_id,member_id,action)
    VALUES (gen_random_uuid(),'${ids.a}','${ids.a}','${ids.teamFull}','access_changed')`);
});

test('0009 is idempotent and refuses non-boolean module grants', () => {
  const current = snapshot();
  db.migrate('0009_action_grants.sql');
  assert.equal(snapshot(), current);
  const bad = ids.a.replace(/10$/, '99');
  db.query(`INSERT INTO crm_users (id,name,email,phone,password_hash,role,owner_id,workspace_id,
      permissions) VALUES ('${bad}','Bad','bad@seed.test','+971500000000','x','staff',
      '${ids.a}','${ids.a}','{"schedule":"yes"}')`);
  let error = '';
  try {
    db.migrate('0009_action_grants.sql');
  } catch (caught) {
    error = String(caught.stderr);
  }
  assert.match(error, /non-boolean module grant/);
  assert.deepEqual(JSON.parse(db.query(`SELECT actions FROM crm_users WHERE id='${bad}'`)), {});
  db.query(`DELETE FROM crm_users WHERE id='${bad}'`);
});
