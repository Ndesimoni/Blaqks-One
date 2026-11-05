import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('renewal preserves membership, invalidates old links and requires owner scope and current version', async () => {
  const owner = await login();
  const other = await login('admin-b');
  const invited = await invite(owner, 'renewal-staff');
  const member = await findMember(owner, invited.member.id);
  const path = `${teamPath(owner, member.id)}/invitations`;
  assert.equal(
    (
      await other.request(path, {
        method: 'POST',
        body: { version: member.version },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.request(path, {
        method: 'POST',
        body: { version: member.version },
        csrf: undefined,
      })
    ).status,
    403,
  );
  const renewed = await owner.request(path, {
    method: 'POST',
    body: { version: member.version },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.member.id, member.id);
  assert.notEqual(renewed.value.invitation.token, invited.invitation.token);
  assert.equal(
    (
      await owner.request(path, {
        method: 'POST',
        body: { version: member.version },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/auth/invitations/inspect', {
        method: 'POST',
        body: { token: invited.invitation.token },
      })
    ).status,
    400,
  );
  const staff = await activate({ ...renewed.value, email: invited.email });
  const latest = await findMember(owner, staff.user.id);
  assert.equal(
    (
      await owner.request(path, {
        method: 'POST',
        body: { version: latest.version },
      })
    ).status,
    409,
  );
});

test('cancelling a pending invitation blocks activation and renewal restores only the link', async () => {
  const owner = await login();
  const invited = await invite(owner, 'cancelled-renewal');
  const member = await findMember(owner, invited.member.id);
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: memberUpdate(member, { active: false }),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token: invited.invitation.token, password: 'Team123!' },
      })
    ).status,
    400,
  );
  const latest = await findMember(owner, member.id);
  assert.equal(latest.invitationPending, true);
  assert.equal(latest.active, false);
  const renewed = await owner.request(`${teamPath(owner, member.id)}/invitations`, {
    method: 'POST',
    body: { version: latest.version },
  });
  assert.equal(renewed.status, 200);
  assert.equal(renewed.value.member.active, false);
  await activate({ ...renewed.value, email: invited.email });
});
