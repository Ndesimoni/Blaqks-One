import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';
import { actions, preset } from './permission-helpers.mjs';

let admin, staff;
before(async () => {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  admin = await activate(
    await invite(owner, 'perm-audit-admin', { accountRole: 'admin', positions: [] }),
  );
  staff = await activate(await invite(admin, 'perm-audit-staff'));
});

const activity = (id) =>
  query(
    `SELECT string_agg(action, ',' ORDER BY created_at, action) FROM crm_team_activity
     WHERE member_id='${id}'`,
  );

async function update(changes) {
  const member = await findMember(admin, staff.user.id);
  const result = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.member;
}

test('team activity names access changes without recording grant contents (L-6)', async () => {
  const id = staff.user.id;
  assert.equal(activity(id), 'invited,activated');
  await update({ name: 'Renamed staff' });
  assert.equal(activity(id), 'invited,activated,updated');
  await update({ actions: actions(false) });
  assert.equal(activity(id), 'invited,activated,updated,access_changed,updated');
  await update({ actions: actions(false) });
  assert.equal(activity(id).split(',').length, 6, 'unchanged grants log only an update');
  await update({ recordScope: 'team' });
  await update({ channelAccess: { email: true, whatsapp: false } });
  assert.equal(activity(id).match(/access_changed/g).length, 3);
  const columns = query(
    `SELECT string_agg(DISTINCT key, ',' ORDER BY key) FROM crm_team_activity a,
       jsonb_object_keys(to_jsonb(a)) key WHERE member_id='${id}'`,
  );
  assert.equal(columns, 'action,actor_id,created_at,id,member_id,workspace_id');
  assert.equal(
    query(`SELECT count(*) FROM crm_team_activity a WHERE a::text ~ '(deleteMain|create|true)'`),
    '0',
  );
});

test('malformed stored actions never break the team list or sign-in (M-E)', async () => {
  const id = staff.user.id;
  await update({ recordScope: 'assigned', actions: preset() });
  for (const value of [
    '{"relationships":"yes","schedule":{"create":1,"edit":"true"}}',
    '{"properties":[true],"schedule":null}',
    '{}',
  ]) {
    query(`UPDATE crm_users SET actions='${value}' WHERE id='${id}'`);
    const listed = await admin.request(teamPath(admin));
    assert.equal(listed.status, 200, value);
    const member = listed.value.members.find((entry) => entry.id === id);
    assert.ok(
      Object.values(member.recordActions).every((a) => !a.create && !a.edit),
      value,
    );
    const session = await staffLogin(staff.user.email);
    assert.equal(session.user.recordActions.Clients.create, false, value);
    const created = await session.request(`/workspaces/${admin.user.id}/records/Clients`, {
      method: 'POST',
      body: { record: { full_name: 'Refused' } },
    });
    assert.equal(created.status, 403, value);
  }
  assert.deepEqual(
    (await admin.request(teamPath(admin))).value.members.find((entry) => entry.id === id).actions,
    {},
  );
  query(`UPDATE crm_users SET actions='${JSON.stringify(preset())}' WHERE id='${id}'`);
});
