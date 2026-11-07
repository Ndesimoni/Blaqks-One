import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  commit,
  emptyRecords,
  fixtures,
  organisation,
  planned,
  preview,
  tokenHash,
} from './import-helpers.mjs';

let owner, admin, other, staff;
before(async () => {
  ({ owner, admin, other } = await fixtures());
  staff = await activate(await invite(admin, 'import-access-staff'));
});

test('imports belong to the owning Admin, with exact Origin and session-bound CSRF (T9)', async () => {
  const records = emptyRecords();
  for (const [actor, workspace] of [
    [owner, admin.user.id],
    [owner, organisation],
    [owner, owner.user.id],
    [other, admin.user.id],
    [staff, admin.user.id],
    [admin, organisation],
  ])
    assert.equal(
      (await preview(actor, workspace, records, 'backup-personal', { memberId: admin.user.id }))
        .status,
      403,
      `${actor.user.email} into ${workspace}`,
    );
  const plan = await planned(admin, admin.user.id, records);
  for (const actor of [owner, other, staff])
    assert.equal((await commit(actor, admin.user.id, plan.token)).status, 403);
  for (const options of [
    { csrf: undefined },
    { csrf: owner.csrf },
    { headers: { Origin: 'https://untrusted.example' } },
  ]) {
    assert.equal(
      (await preview(admin, admin.user.id, records, 'backup-personal', options)).status,
      403,
    );
    assert.equal((await commit(admin, admin.user.id, plan.token, options)).status, 403);
  }
  const response = await commit(admin, admin.user.id, plan.token);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('the organisation source lands in the Admin’s company; personal sources name a live member', async () => {
  const records = emptyRecords();
  assert.equal((await preview(admin, admin.user.id, records, organisation)).status, 200);
  assert.equal((await preview(admin, admin.user.id, records, 'legacy-aidah')).status, 200);
  const missing = await preview(admin, admin.user.id, records, 'backup-personal', {
    memberId: null,
  });
  assert.equal(missing.status, 400);
  assert.match(missing.value.message, /Choose the member/);
  const suspended = await activate(await invite(admin, 'import-access-suspended'));
  const member = await findMember(admin, suspended.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const pending = await invite(admin, 'import-access-pending');
  for (const memberId of [
    other.user.id,
    owner.user.id,
    suspended.user.id,
    pending.member.id,
    '00000000-0000-4000-8000-000000000000',
    'not-a-member-id',
  ]) {
    const refused = await preview(admin, admin.user.id, records, 'backup-personal', { memberId });
    assert.equal(refused.status, 400, memberId);
  }
  const properties = {
    ...emptyRecords(),
    Properties: [{ property_id: 'IMP-ACCESS-NO-GRANT' }],
  };
  const noGrant = await preview(admin, admin.user.id, properties, 'backup-personal', {
    memberId: staff.user.id,
  });
  assert.equal(noGrant.status, 400);
  assert.match(noGrant.value.message, /doesn't include every record type/);
  const clients = { ...emptyRecords(), Clients: [{ client_id: 'IMP-ACCESS-GRANTED' }] };
  const granted = await planned(admin, admin.user.id, clients, 'backup-personal', {
    memberId: staff.user.id,
  });
  assert.equal(
    query(`SELECT member_id FROM crm_import_plans WHERE token_hash='${tokenHash(granted.token)}'`),
    staff.user.id,
  );
});

test('tokens are bound to actor and workspace and must still be unexpired', async () => {
  const plan = await planned(admin, admin.user.id, emptyRecords());
  assert.equal((await commit(admin, other.user.id, plan.token)).status, 403);
  assert.equal((await commit(admin, admin.user.id, 'x'.repeat(43))).status, 403);
  const hash = tokenHash(plan.token);
  query(`UPDATE crm_import_plans SET actor_id='${other.user.id}' WHERE token_hash='${hash}'`);
  assert.equal((await commit(admin, admin.user.id, plan.token)).status, 403);
  query(
    `UPDATE crm_import_plans SET actor_id='${admin.user.id}',expires_at=clock_timestamp()-interval '1 second' WHERE token_hash='${hash}'`,
  );
  const expired = await commit(admin, admin.user.id, plan.token);
  assert.equal(expired.status, 400);
  assert.match(expired.value.message, /expired/i);
});
