import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import { changePassword, newStaff, sessionStatus } from './account-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const liveSessions = (id) => query(`SELECT count(*) FROM crm_sessions WHERE user_id='${id}'`);

/** Queues a password change and `departure` behind a held workspace lock, then releases it. */
async function race(admin, staff, departure) {
  const release = await holdWorkspaceLock(admin.user.id);
  let changing, leaving;
  try {
    changing = changePassword(staff, 'Team123!', 'Raced1!pw');
    await waitForWorkspaceQueue(1);
    leaving = departure();
    await waitForWorkspaceQueue(2);
  } finally {
    await release();
  }
  const [changed, left] = await Promise.all([changing, leaving]);
  assert.equal(left.status, 200, JSON.stringify(left.value));
  assert.ok([200, 401].includes(changed.status), JSON.stringify(changed.value));
  if (changed.status === 200) {
    const cookie = changed.headers.get('set-cookie').split(';')[0];
    assert.equal(await sessionStatus(cookie), 401);
  }
  assert.equal(await sessionStatus(staff.cookie), 401);
  assert.equal(liveSessions(staff.user.id), '0');
}

test('a suspension during a password change leaves no live session', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'race-suspend');
  const member = await findMember(admin, staff.user.id);
  await race(admin, staff, () =>
    admin.request(teamPath(admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    }),
  );
});

test('an archive during a password change leaves no live session', async () => {
  const owner = await login('owner');
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'race-archive');
  const review = await archiveReview(owner, admin, await findMember(admin, staff.user.id));
  await race(admin, staff, () => archive(owner, admin, review));
});
