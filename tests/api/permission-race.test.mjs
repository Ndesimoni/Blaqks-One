import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import { add, assign, bulkAssign, patch, remove, versionOf } from './assignment-helpers.mjs';
import { MESSAGES, forbidden, permissionTeams } from './permission-helpers.mjs';

let teams;
before(async () => {
  teams = await permissionTeams('perm-race');
});

/** Queues `request` behind a held workspace lock, revokes `path` meanwhile, then releases. */
async function revokedWhileQueued(member, path, request) {
  const release = await holdWorkspaceLock(teams.admin.user.id);
  let pending;
  try {
    pending = request();
    await waitForWorkspaceQueue(1);
    query(
      `UPDATE crm_users SET actions=jsonb_set(actions,'{${path}}','false') WHERE id='${member.user.id}'`,
    );
  } finally {
    await release();
  }
  return pending;
}

const restore = (member, path) =>
  query(
    `UPDATE crm_users SET actions=jsonb_set(actions,'{${path}}','true') WHERE id='${member.user.id}'`,
  );

test('edits, deletes and single hand-ons re-check the live grant under the lock', async () => {
  const { admin, teamDelete, two } = teams;
  const client = await add(admin, 'Clients', { client_id: 'RACE-A2-CL', full_name: 'Before' });
  const edit = await revokedWhileQueued(teamDelete, 'relationships,edit', () =>
    patch(teamDelete, 'Clients', client, { client_id: 'RACE-A2-CL', full_name: 'After' }),
  );
  forbidden(edit, MESSAGES.edit);
  restore(teamDelete, 'relationships,edit');
  const moved = await revokedWhileQueued(teamDelete, 'relationships,assign', () =>
    assign(teamDelete, 'Clients', client, two.user.id),
  );
  forbidden(moved, MESSAGES.assign);
  restore(teamDelete, 'relationships,assign');
  const deleted = await revokedWhileQueued(teamDelete, 'relationships,deleteMain', () =>
    remove(teamDelete, 'Clients', client.id),
  );
  forbidden(deleted, MESSAGES.delete);
  restore(teamDelete, 'relationships,deleteMain');
  const created = await revokedWhileQueued(teamDelete, 'schedule,create', () =>
    teamDelete.request(`/workspaces/${admin.user.id}/records/Follow-ups`, {
      method: 'POST',
      body: { record: { client_id: 'RACE-A2-CL' } },
    }),
  );
  forbidden(created, MESSAGES.create);
  restore(teamDelete, 'schedule,create');
  assert.equal(versionOf(client.id), 1);
});

test('bulk moves re-check Assign for every collection under the lock', async () => {
  const { admin, teamKeep, two } = teams;
  const task = await add(admin, 'Follow-ups', { activity_id: 'RACE-A2-FU' });
  const records = [{ collection: 'Follow-ups', id: task.id, version: 1 }];
  const moved = await revokedWhileQueued(teamKeep, 'schedule,assign', () =>
    bulkAssign(teamKeep, { toId: two.user.id, records }),
  );
  forbidden(moved, MESSAGES.assign);
  assert.equal(versionOf(task.id), 1);
  restore(teamKeep, 'schedule,assign');
  const retried = await bulkAssign(teamKeep, { toId: two.user.id, records });
  assert.equal(retried.status, 200, JSON.stringify(retried.value));
});
