import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import {
  add,
  assign,
  assigneeOf,
  assignmentTeams,
  history,
  setScope,
  versionOf,
} from './assignment-helpers.mjs';

let owner, admin, other;
const agent = async (name) =>
  activate(await invite(admin, `leave-${name}`, { positions: ['property-agent'] }));
const update = async (staff, changes) => {
  const member = await findMember(admin, staff.user.id);
  const result = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
};
/** One record of each assignable collection held by `staff`. */
async function holdings(staff, prefix) {
  const records = {};
  for (const [collection, key] of [
    ['Clients', 'client_id'],
    ['Contacts', 'contact_id'],
    ['Properties', 'property_id'],
    ['Follow-ups', 'activity_id'],
  ]) {
    const entry = await add(admin, collection, { [key]: `${prefix}-${collection}` });
    const moved = await assign(admin, collection, entry, staff.user.id);
    assert.equal(moved.status, 200, JSON.stringify(moved.value));
    records[collection] = entry.id;
  }
  return records;
}
const released = (records, collections, reason, actor = admin) => {
  for (const collection of collections) {
    const id = records[collection];
    assert.equal(assigneeOf(id), '-', collection);
    assert.equal(versionOf(id), 3, collection);
    assert.match(history(id), new RegExp(`,${reason}:-:${actor.user.id}$`), collection);
  }
};

before(async () => ({ owner, admin, other } = await assignmentTeams('leave')));

test('losing a grant releases exactly the affected collections', async () => {
  const staff = await agent('grant');
  const records = await holdings(staff, 'GRANT');
  const member = await findMember(admin, staff.user.id);
  await update(staff, { permissions: { ...member.permissions, relationships: false } });
  released(records, ['Clients', 'Contacts'], 'access_removed');
  assert.equal(assigneeOf(records.Properties), staff.user.id);
  assert.equal(assigneeOf(records['Follow-ups']), staff.user.id);
  await update(staff, { positions: ['accountant'], permissions: undefined });
  released(records, ['Properties', 'Follow-ups'], 'access_removed');
  const activity = query(
    `SELECT count(*) FROM crm_activity WHERE action='assigned' AND actor_id='${admin.user.id}'
     AND record_id IN ('${Object.values(records).join("','")}')`,
  );
  assert.equal(activity, '8');
});

test('suspension and staff archive release everything; reactivation restores nothing', async () => {
  const staff = await agent('suspend');
  const records = await holdings(staff, 'SUSPEND');
  await update(staff, { active: false });
  released(records, Object.keys(records), 'departure');
  await update(staff, { active: true });
  assert.equal(assigneeOf(records.Clients), '-');
  const leaver = await agent('archive');
  const kept = await holdings(leaver, 'ARCHIVE');
  const review = await archiveReview(owner, admin, await findMember(admin, leaver.user.id));
  assert.equal((await archive(owner, admin, review)).status, 200);
  released(kept, Object.keys(kept), 'departure', owner);
});

test('scope changes and Admin suspension release nothing', async () => {
  const staff = await agent('scope');
  const records = await holdings(staff, 'SCOPE');
  const manager = await setScope(admin, staff, 'team');
  await setScope(admin, manager, 'assigned');
  assert.ok(Object.values(records).every((id) => assigneeOf(id) === staff.user.id));
  const theirs = await add(other, 'Clients', { client_id: 'SCOPE-ADMIN' });
  const member = await findMember(owner, other.user.id);
  const suspend = await owner.request(teamPath(owner, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(suspend.status, 200);
  assert.equal(assigneeOf(theirs.id), other.user.id);
});

test('a suspension racing an assignment never leaves the record with the suspended member', async () => {
  const staff = await agent('race');
  const client = await add(admin, 'Clients', { client_id: 'RACE-LEAVE' });
  const member = await findMember(admin, staff.user.id);
  const release = await holdWorkspaceLock(admin.user.id);
  let assigning, suspending;
  try {
    assigning = assign(admin, 'Clients', client, staff.user.id);
    await waitForWorkspaceQueue(1);
    suspending = admin.request(teamPath(admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    });
    await waitForWorkspaceQueue(2);
  } finally {
    await release();
  }
  const [assigned, suspended] = await Promise.all([assigning, suspending]);
  assert.equal(suspended.status, 200);
  assert.notEqual(assigneeOf(client.id), staff.user.id);
  if (assigned.status === 200) {
    assert.equal(assigneeOf(client.id), '-');
    assert.match(history(client.id), new RegExp(`reassigned:${staff.user.id}:.*,departure:-:`));
  } else {
    assert.equal(assigned.status, 400);
    assert.equal(assigneeOf(client.id), admin.user.id);
  }
});
