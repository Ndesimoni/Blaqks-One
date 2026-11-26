import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, origin, query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { newStaff, sessionStatus, signIn, updateAccount } from './account-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('the account view names the team owner and never exposes credentials', async () => {
  const admin = await login('admin-a');
  const own = await admin.request('/auth/account');
  assert.equal(own.status, 200);
  assert.equal(own.value.user.id, admin.user.id);
  assert.equal(own.value.team.workspaceId, admin.user.workspaceId);
  assert.equal(own.value.team.ownerName, 'Fixture Admin A');
  assert.ok(Number.isInteger(own.value.version));
  const staff = await newStaff(admin, 'account-view');
  const view = await staff.request('/auth/account');
  assert.equal(view.status, 200);
  assert.equal(view.value.team.ownerName, 'Fixture Admin A');
  assert.equal(view.value.team.workspaceId, admin.user.workspaceId);
  assert.equal(view.value.passwordChangedAt, null);
  assert.doesNotMatch(JSON.stringify(view.value), /argon2|password_hash|passwordHash|csrf/i);
  assert.equal((await staff.request('/auth/account', { cookie: undefined })).status, 401);
});

test('members edit only their own name and phone, with versions and CSRF', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'account-edit');
  const other = await signIn(staff.email);
  const { version } = (await staff.request('/auth/account')).value;
  for (const field of [{ email: 'x@example.test' }, { role: 'admin' }, { active: false }]) {
    const refused = await updateAccount(staff, { version, name: 'Edited', ...field });
    assert.equal(refused.status, 400, JSON.stringify(field));
  }
  assert.equal((await updateAccount(staff, { version, phone: '0501234567' })).status, 400);
  assert.equal((await updateAccount(staff, { version, name: ' ' })).status, 400);
  assert.equal((await updateAccount(staff, { version, name: 'n'.repeat(101) })).status, 400);
  assert.equal((await updateAccount(staff, { version })).status, 400);
  const body = { version, name: 'Synthetic Edited', phone: '+971509999999' };
  assert.equal((await updateAccount(staff, body, { csrf: undefined })).status, 403);
  const foreign = { headers: { Origin: `${origin}.invalid` } };
  assert.equal((await updateAccount(staff, body, foreign)).status, 403);
  const stale = await updateAccount(staff, { ...body, version: version + 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'stale');
  const saved = await updateAccount(staff, { ...body, name: '  Synthetic Edited  ' });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.user.name, 'Synthetic Edited');
  assert.equal(saved.value.user.phone, '+971509999999');
  assert.equal(saved.value.user.email, staff.email);
  assert.deepEqual(saved.value.user.permissions, staff.user.permissions);
  assert.deepEqual(saved.value.user.positions, staff.user.positions);
  assert.equal(saved.value.version, version + 1);
  assert.equal((await findMember(admin, staff.user.id)).name, 'Synthetic Edited');
  assert.equal(await sessionStatus(staff.cookie), 200);
  assert.equal(await sessionStatus(other.cookie), 200);
  assert.equal((await updateAccount(staff, body)).status, 409);
  assert.equal(
    query(
      `SELECT string_agg(action||':'||(actor_id=user_id)::text||':'||workspace_id,',') ` +
        `FROM crm_account_events WHERE user_id='${staff.user.id}'`,
    ),
    `profile_updated:true:${admin.user.workspaceId}`,
  );
  const stored = query(
    `SELECT count(*) FROM crm_account_events e WHERE row_to_json(e)::text ILIKE '%Edited%' ` +
      `OR row_to_json(e)::text LIKE '%9999999%'`,
  );
  assert.equal(stored, '0');
  const activity = query(
    `SELECT count(*) FROM crm_team_activity a WHERE row_to_json(a)::text ILIKE '%Edited%'`,
  );
  assert.equal(activity, '0');
});

test('the Super Admin edits their own details like everyone else', async () => {
  const owner = await login('owner');
  const before = (await owner.request('/auth/account')).value;
  const edited = await updateAccount(owner, {
    version: before.version,
    name: 'Fixture Owner Edit',
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.value.user.roleId, 'super-admin');
  assert.equal(edited.value.team.ownerName, 'Fixture Owner Edit');
  const restored = await updateAccount(owner, {
    version: edited.value.version,
    name: before.user.name,
    phone: before.user.phone,
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.value.user.name, 'Fixture Owner');
});

test('suspended and archived callers get 401 before any self-service', async () => {
  const admin = await login('admin-a');
  const owner = await login('owner');
  const suspended = await newStaff(admin, 'account-suspended');
  const archived = await newStaff(admin, 'account-archived');
  const version = (await suspended.request('/auth/account')).value.version;
  const member = await findMember(admin, suspended.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const review = await archiveReview(owner, admin, await findMember(admin, archived.user.id));
  assert.equal((await archive(owner, admin, review)).status, 200);
  for (const caller of [suspended, archived]) {
    assert.equal((await caller.request('/auth/account')).status, 401);
    assert.equal((await updateAccount(caller, { version, name: 'Blocked' })).status, 401);
    assert.equal((await caller.request('/auth/sessions')).status, 401);
  }
  assert.equal(
    query(`SELECT name FROM crm_users WHERE id='${suspended.user.id}'`),
    'Synthetic account-suspended',
  );
});
