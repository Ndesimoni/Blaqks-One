import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  changeLimit,
  changeLimitOk,
  rawInvite,
  seatUsage,
  stateSnapshot,
} from './team-limit-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const updateMember = (admin, member, changes) =>
  admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });

test('pending invitations consume seats and cancellation releases one', async () => {
  const { admin } = await newCompany('seat-pending');
  const first = await invite(admin, 'seat-pending-one');
  await invite(admin, 'seat-pending-two');
  assert.deepEqual(await seatUsage(admin), { used: 3, limit: 3, version: 1 });
  const blocked = await rawInvite(admin, 'seat-pending-blocked');
  assert.equal(blocked.status, 409);
  assert.equal(blocked.value.code, 'team_limit_reached');
  const member = await findMember(admin, first.member.id);
  assert.equal((await updateMember(admin, member, { active: false })).status, 200);
  assert.equal((await seatUsage(admin)).used, 2);
  assert.equal((await rawInvite(admin, 'seat-pending-released')).status, 201);
});

test('activation and renewal retain their already reserved seat at capacity', async () => {
  const { admin } = await newCompany('seat-held');
  const first = await invite(admin, 'seat-held-first');
  const second = await invite(admin, 'seat-held-second');
  assert.equal((await activate(first)).user.roleId, 'staff');
  const member = await findMember(admin, second.member.id);
  const renewed = await admin.request(`${teamPath(admin, member.id)}/invitations`, {
    method: 'POST',
    body: { version: member.version },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.deepEqual(await seatUsage(admin), { used: 3, limit: 3, version: 1 });
});

test('limits cannot drop below usage and a full company blocks restoration', async () => {
  const { owner, admin } = await newCompany('seat-floor');
  await activate(await invite(admin, 'seat-floor-active'));
  const second = await activate(await invite(admin, 'seat-floor-suspended'));
  const workspace = admin.user.workspaceId;
  const tooLow = await changeLimit(owner, workspace, 2, 1);
  assert.equal(tooLow.status, 409);
  assert.equal(tooLow.value.code, 'seat_limit_too_low');
  let member = await findMember(admin, second.user.id);
  assert.equal((await updateMember(admin, member, { active: false })).status, 200);
  assert.deepEqual(await changeLimitOk(owner, admin, 2), { used: 2, limit: 2, version: 2 });
  member = await findMember(admin, member.id);
  const restored = await updateMember(admin, member, { active: true });
  assert.equal(restored.status, 409);
  assert.equal(restored.value.code, 'team_limit_reached');
});

test('a failed limit-history insert rolls back the limit and version', async () => {
  const { owner, admin } = await newCompany('seat-rollback');
  const workspace = admin.user.workspaceId;
  const before = stateSnapshot(workspace);
  query(`CREATE FUNCTION kws_limit_event_failure() RETURNS trigger AS $$ BEGIN
    IF NEW.workspace_id='${workspace}' THEN RAISE EXCEPTION 'Synthetic limit event failure';
    END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER kws_limit_event_failure BEFORE INSERT ON crm_company_limit_events
    FOR EACH ROW EXECUTE FUNCTION kws_limit_event_failure()`);
  try {
    assert.equal((await changeLimit(owner, workspace, 4, 1)).status, 503);
    assert.equal(stateSnapshot(workspace), before);
  } finally {
    query(`DROP TRIGGER kws_limit_event_failure ON crm_company_limit_events;
      DROP FUNCTION kws_limit_event_failure()`);
  }
  assert.equal((await changeLimit(owner, workspace, 4, 1)).status, 200);
});
