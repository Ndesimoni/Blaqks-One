import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { failure, refused } from './finance-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { PERFORMANCE_MESSAGES as M, performanceTeams } from './performance-helpers.mjs';
import { targetActivity, targetBody } from './performance-helpers.mjs';

let teams;
before(async () => {
  teams = await performanceTeams('perf-set');
});

test('targets save with versions and redacted activity', async () => {
  const { admin, put } = teams;
  const first = await put(admin, targetBody({ month: '2026-09' }));
  assert.equal(first.status, 200, JSON.stringify(first.value));
  const target = first.value.target;
  assert.match(target.updatedAt, /^\d{4}-\d\d-\d\dT/);
  const { id, updatedAt, ...fields } = target;
  assert.ok(id && updatedAt);
  assert.deepEqual(fields, {
    memberId: null,
    month: '2026-09',
    metric: 'enquiries',
    value: 10,
    version: 1,
  });
  const body = (changes) => targetBody({ month: '2026-09', ...changes });
  refused(await put(admin, body()), 409, M.stale, 'version_conflict', 'no version');
  const same = await put(admin, body({ version: 1 }));
  assert.equal(same.value.target.version, 1, 'an unchanged value keeps the version');
  const changed = await put(admin, body({ version: 1, value: 12 }));
  assert.equal(changed.value.target.version, 2);
  assert.equal(changed.value.target.value, 12);
  refused(await put(admin, body({ version: 1, value: null })), 409, M.stale, 'version_conflict');
  const cleared = await put(admin, body({ version: 2, value: null }));
  assert.equal(cleared.status, 200);
  assert.equal(cleared.value.target, null);
  const again = await put(admin, body({ value: null }));
  assert.deepEqual(again.value, { target: null }, 'clearing nothing is a no-op');
  assert.equal(targetActivity(target.id), 'created:Targets,updated:Targets,deleted:Targets');
  const actors = query(`SELECT DISTINCT actor_id FROM crm_activity WHERE record_id='${target.id}'`);
  assert.equal(actors, admin.user.id);
  refused(await put(admin, body({ version: 1 })), 409, M.stale, 'version_conflict', 'gone');
});

test('the database keeps target identity and ranges', async () => {
  const { admin, put } = teams;
  const saved = (await put(admin, targetBody({ month: '2026-08', metric: 'deals' }))).value.target;
  assert.match(
    failure(`UPDATE crm_targets SET metric='fees' WHERE id='${saved.id}'`),
    /keeps its member, month and measure/,
  );
  assert.match(
    failure(`UPDATE crm_targets SET value=1000001 WHERE id='${saved.id}'`),
    /crm_targets_value_range/,
  );
  assert.match(
    failure(`INSERT INTO crm_targets (id,workspace_id,month,metric,value,updated_by)
      SELECT gen_random_uuid(),workspace_id,month,metric,1,updated_by FROM crm_targets
      WHERE id='${saved.id}'`),
    /crm_targets_unique/,
  );
});

test('each caller reads only the targets their access allows', async () => {
  const { owner, admin, agent, lead, supervisor, viewer, put, get } = teams;
  const set = async (memberId, metric, value) => {
    const result = await put(admin, targetBody({ memberId, metric, value }));
    assert.equal(result.status, 200, JSON.stringify(result.value));
  };
  await set(null, 'enquiries', 40);
  await set(null, 'fees', 5_000_000);
  await set(agent.user.id, 'enquiries', 8);
  await set(agent.user.id, 'fees', 1_000_000);
  await set(lead.user.id, 'viewings', 6);
  await set(lead.user.id, 'fees', 900_000);
  await set(supervisor.user.id, 'deals', 2);
  const seen = async (session) => {
    const result = await get(session);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    const key = (row) => `${row.memberId === null ? 'team' : row.memberId}:${row.metric}`;
    return { keys: result.value.targets.map(key).sort(), canEdit: result.value.canEdit };
  };
  const all = await seen(admin);
  assert.equal(all.keys.length, 7);
  assert.equal(all.canEdit, true);
  assert.deepEqual(await seen(owner), { keys: all.keys, canEdit: false });
  const mine = (session, ...metrics) => metrics.map((m) => `${session.user.id}:${m}`);
  assert.deepEqual((await seen(agent)).keys, mine(agent, 'enquiries', 'fees').sort());
  assert.deepEqual((await seen(lead)).keys, mine(lead, 'viewings'), 'no finance: no fees');
  assert.deepEqual(
    (await seen(supervisor)).keys,
    [...mine(supervisor, 'deals'), 'team:enquiries'].sort(),
    'team scope without finance: no team fees',
  );
  assert.deepEqual((await seen(viewer)).keys, ['team:enquiries', 'team:fees']);
  assert.equal((await seen(agent)).canEdit, false);
  assert.deepEqual((await get(admin, '2026-11')).value.targets, []);
});

test('suspended members cannot receive new targets', async () => {
  const { admin, lead, put } = teams;
  const member = await findMember(admin, lead.user.id);
  const result = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const body = targetBody({ memberId: lead.user.id, metric: 'deals', value: 3 });
  refused(await put(admin, body), 400, M.member, 'invalid_request');
});
