import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, invite, staffLogin } from './team-helpers.mjs';
import { failure } from './finance-helpers.mjs';
import { activeDays, earnedDeal, events, financeSettings } from './platform-metrics-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const TABLE = 'platform_metrics.crm_platform_events';

test('the event log keeps only names, roles, sources and anonymous amounts', () => {
  const columns = query(`SELECT string_agg(column_name,',' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='platform_metrics' AND table_name='crm_platform_events'`);
  assert.equal(columns, 'id,occurred_at,event,workspace_id,actor_role,source,amount_fils');
  const days = query(`SELECT string_agg(column_name,',' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema='platform_metrics' AND table_name='crm_user_active_days'`);
  assert.equal(days, 'user_id,workspace_id,day');
});

test('money events carry no company and usage events carry no amount', async () => {
  const { admin } = await newCompany('events-money');
  const workspace = admin.user.workspaceId;
  await financeSettings(admin);
  await earnedDeal(admin, 312_500_000);
  const [earned] = events(`event='deal_earned' AND amount_fils=312500000`);
  assert.deepEqual(earned, {
    event: 'deal_earned',
    workspace: null,
    role: null,
    source: 'crm',
    amount: 312_500_000,
  });
  const midnight = query(`SELECT count(*) FROM ${TABLE} WHERE event='deal_earned'
    AND occurred_at=date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai'
    AND amount_fils=312500000`);
  assert.equal(midnight, '1', 'money events keep the day, not the moment');
  const usage = events(`workspace_id='${workspace}'`);
  const names = usage.map((row) => row.event).sort();
  for (const name of ['invitation_sent', 'invitation_accepted', 'record_created_clients'])
    assert.ok(names.includes(name), `${name} in ${names}`);
  assert.ok(usage.every((row) => row.amount === null && row.source === 'crm'));
  assert.deepEqual(
    usage.find((row) => row.event === 'record_created_clients'),
    { event: 'record_created_clients', workspace, role: 'admin', source: 'crm', amount: null },
  );
  assert.equal(events('workspace_id IS NOT NULL AND amount_fils IS NOT NULL').length, 0);
  assert.equal(events('amount_fils IS NOT NULL AND actor_role IS NOT NULL').length, 0);
});

test('the database refuses money with a company and any change to the log', async () => {
  const forged = failure(`INSERT INTO ${TABLE} (event,workspace_id,source,amount_fils)
    VALUES ('deal_earned','synthetic-company','crm',100)`);
  assert.match(forged, /crm_platform_events_money_anonymous/);
  assert.match(
    failure(`UPDATE ${TABLE} SET amount_fils=0 WHERE amount_fils IS NOT NULL`),
    /immutable/,
  );
  assert.match(failure(`DELETE FROM ${TABLE}`), /immutable/);
});

test('a person is active once per Asia/Dubai day, however many requests they make', async () => {
  const { admin } = await newCompany('events-active');
  const agent = await activate(await invite(admin, 'events-active-agent'));
  assert.equal(activeDays(agent.user.id), 1, 'joining signs the person in');
  query(`DELETE FROM platform_metrics.crm_user_active_days WHERE user_id='${agent.user.id}'`);
  const again = await staffLogin(agent.user.email);
  assert.equal(activeDays(agent.user.id), 1, 'a sign-in marks the day');
  for (let index = 0; index < 3; index += 1)
    assert.equal((await again.request('/auth/session')).status, 200);
  assert.equal(activeDays(agent.user.id), 1, 'later requests the same day add nothing');
  const [row] = JSON.parse(
    query(`SELECT jsonb_agg(jsonb_build_object('workspace',workspace_id,
      'today',day=(now() AT TIME ZONE 'Asia/Dubai')::date))
      FROM platform_metrics.crm_user_active_days WHERE user_id='${agent.user.id}'`),
  );
  assert.deepEqual(row, { workspace: admin.user.workspaceId, today: true });
  const [signIn] = events(`event='sign_in' AND workspace_id='${admin.user.workspaceId}'`);
  assert.deepEqual(signIn, {
    event: 'sign_in',
    workspace: admin.user.workspaceId,
    role: 'staff',
    source: 'crm',
    amount: null,
  });
});

test('the first request on a new day marks that day once', async () => {
  const { admin } = await newCompany('events-new-day');
  const user = admin.user.id;
  // The session was last used yesterday and today's row is not there yet.
  query(`UPDATE crm_sessions SET last_seen_at=now()-interval '1 day' WHERE user_id='${user}'`);
  query(`DELETE FROM platform_metrics.crm_user_active_days WHERE user_id='${user}'`);
  assert.equal((await admin.request('/auth/session')).status, 200);
  assert.equal(activeDays(user), 1);
  const seen = query(`SELECT bool_and(last_seen_at>now()-interval '1 minute')
    FROM crm_sessions WHERE user_id='${user}'`);
  assert.equal(seen, 't', 'last seen moves to today, so the next request writes nothing');
  assert.equal((await admin.request('/auth/session')).status, 200);
  assert.equal(activeDays(user), 1);
});
