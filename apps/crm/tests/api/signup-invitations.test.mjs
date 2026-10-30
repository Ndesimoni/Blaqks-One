import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { details, digest, email, resetSignup } from './signup-helpers.mjs';

before(resetSignup);

const body = (address) => ({
  name: 'Synthetic Invite',
  email: address,
  phone: '+971501234567',
  positions: ['receptionist'],
  accountRole: 'staff',
});

test('invitation email collisions return the fixed domain contract', async () => {
  const owner = await login('owner');
  const response = await owner.request('/workspaces/super-admin-workspace/team/invitations', {
    method: 'POST',
    body: body('admin-a@crm-fixture.test'),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(response.value, {
    message: 'The invitation could not be created.',
    code: 'invitation_unavailable',
  });
});

test('each workspace can create at most twenty invitations per day', async () => {
  const owner = await login('owner');
  const key = digest('team:invitation:day:super-admin-workspace');
  query(
    `INSERT INTO crm_login_limits(key_hash,attempts,window_seconds) VALUES('${key}',20,86400) ` +
      `ON CONFLICT(key_hash) DO UPDATE SET attempts=20,window_started=now(),window_seconds=86400`,
  );
  const response = await owner.request('/workspaces/super-admin-workspace/team/invitations', {
    method: 'POST',
    body: body(email('invitation-budget')),
  });
  assert.equal(response.status, 429);
  assert.equal(response.value.code, 'rate_limited');
});
