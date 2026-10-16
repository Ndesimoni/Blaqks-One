import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';
import { query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { runSample, sampleAdmin, sampleRows, seed, staffEmail } from './sample-helpers.mjs';

const count = (sql) => Number(query(`SELECT count(*) FROM ${sql}`));
const unmarked =
  /This database is not marked as a local development database\. Nothing was changed\./;

test('unmarked databases and unconfirmed runs are refused before any change', async () => {
  const url = process.env.CRM_DATABASE_URL;
  for (const [name, before] of [
    ['kws_sample_migrated', '0011'],
    ['kws_sample_empty', '0000'],
  ]) {
    const db = seededDatabase(name, before);
    db.create();
    try {
      for (const command of ['seed-sample', 'clear-sample']) {
        const env = { CRM_DATABASE_URL: url.replace(/\/kws_crm_test$/, `/${name}`) };
        const result = runSample(command, { email: 'admin-a@crm-fixture.test', env });
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, unmarked);
      }
      // Refused before migrations: no sqlx history, and no tracking rows or records.
      assert.equal(db.query(`SELECT to_regclass('public._sqlx_migrations') IS NULL`), 't');
      if (before === '0011') {
        assert.equal(db.query('SELECT count(*) FROM crm_sample_records'), '0');
        assert.equal(db.query('SELECT count(*) FROM crm_sample_accounts'), '0');
      } else {
        assert.equal(db.query(`SELECT to_regclass('public.crm_sample_records') IS NULL`), 't');
      }
    } finally {
      db.drop();
    }
  }
  const { email, workspace } = await sampleAdmin('sample-confirm-admin');
  const unconfirmed = runSample('seed-sample', { email, yes: false });
  assert.equal(unconfirmed.status, 1);
  assert.match(unconfirmed.stderr, /Database:\s+127\.0\.0\.1:\d+\/kws_crm_test/);
  assert.match(unconfirmed.stderr, new RegExp(`Workspace: ${workspace}`));
  assert.match(unconfirmed.stderr, /Pass --yes to confirm/);
  assert.equal(sampleRows(workspace), 0);
  assert.equal(count(`crm_sample_accounts WHERE workspace_id='${workspace}'`), 0);
});

test('sample history is marked as such and app-suspended staff stay suspended', async () => {
  const { owner, admin, email, workspace } = await sampleAdmin('sample-source-admin');
  const seeded = seed(email);
  assert.match(seeded.stdout, /generated passwords are shown only once/);
  const sources = (table) =>
    query(
      `SELECT string_agg(DISTINCT source, ',') FROM ${table} WHERE workspace_id='${workspace}'`,
    );
  assert.equal(sources('crm_activity'), 'sample');
  assert.equal(sources('crm_assignments'), 'sample');
  assert.equal(sources('crm_team_activity'), 'sample');
  assert.equal(
    query(`SELECT string_agg(DISTINCT reason, ',') FROM crm_assignments
      WHERE workspace_id='${workspace}'`),
    'created,handover,import,reassigned',
  );
  assert.equal(sources('crm_finance_events'), 'sample');
  const created = await admin.request(`/workspaces/${workspace}/records/Clients`, {
    method: 'POST',
    body: { record: { full_name: 'Added in the app' } },
  });
  assert.equal(created.status, 201);
  const feed = (await admin.request(`/workspaces/${workspace}/activity?kind=record&limit=100`))
    .value.activity;
  assert.equal(feed.find((row) => row.record?.id === created.value.id).sample, false);
  assert.ok(feed.filter((row) => row.sample).length > 0);
  assert.ok(feed.every((row) => row.actor.id === admin.user.id));

  // An Admin suspends Noura in the app; reseeding must not undo that.
  const noura = staffEmail('sample.noura', email);
  const id = query(`SELECT id FROM crm_users WHERE email='${noura}'`);
  const member = await findMember(admin, id);
  const update = await admin.request(teamPath(admin, id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(update.status, 200, JSON.stringify(update.value));
  const again = seed(email);
  assert.equal(again.staff[noura].status, 'suspended');
  assert.match(again.stdout, /left suspended/);
  assert.equal(query(`SELECT active FROM crm_users WHERE id='${id}'`), 'f');

  // Defence in depth: a marker row naming the Admin never suspends the Admin.
  query(`INSERT INTO crm_sample_accounts (user_id,workspace_id)
    VALUES ('${admin.user.id}','${workspace}')`);
  const cleared = runSample('clear-sample', { email, args: ['--include-edited'] });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.match(cleared.stdout, /Sample staff suspended: 2/);
  assert.equal(query(`SELECT active FROM crm_users WHERE id='${admin.user.id}'`), 't');

  // An account marked for this team that is not its staff refuses the seed unchanged.
  const other = await sampleAdmin('sample-owned-admin');
  const impostor = await owner.request(`/workspaces/${owner.user.workspaceId}/team/invitations`, {
    method: 'POST',
    body: {
      name: 'Impostor Admin',
      email: staffEmail('sample.layla', other.email),
      phone: '+971500000998',
      accountRole: 'admin',
    },
  });
  assert.equal(impostor.status, 201, JSON.stringify(impostor.value));
  const impostorId = impostor.value.member.id;
  query(`INSERT INTO crm_sample_accounts (user_id,workspace_id)
    VALUES ('${impostorId}','${other.workspace}')`);
  const refused = runSample('seed-sample', { email: other.email });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /not sample staff of this team/);
  assert.equal(
    query(`SELECT role||','||active||','||coalesce(owner_id::text,'-') FROM crm_users
      WHERE id='${impostorId}'`),
    'admin,false,-',
  );
  assert.equal(sampleRows(other.workspace), 0);
});
