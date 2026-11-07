import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { invite, activate } from './team-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import {
  add,
  assigneeOf,
  assignmentTeams,
  patch,
  setAssignee,
  setScope,
} from './assignment-helpers.mjs';

let admin, one, two;
before(async () => ({ admin, one, two } = await assignmentTeams('race')));

const payload = (id) =>
  query(`SELECT payload->>'full_name' || ':' || version FROM crm_records WHERE id='${id}'`);

/** Queues `request` behind a held workspace lock, runs `change` meanwhile, then releases. */
async function behindLock(request, change) {
  const release = await holdWorkspaceLock(admin.user.id);
  let pending;
  try {
    pending = request();
    await waitForWorkspaceQueue(1);
    change();
  } finally {
    await release();
  }
  return pending;
}

test('an edit queued behind a reassignment re-checks visibility under the lock', async () => {
  const client = await add(admin, 'Clients', { client_id: 'RACE-CL', full_name: 'Before' });
  setAssignee(client.id, one.user.id);
  const edit = await behindLock(
    () => patch(one, 'Clients', client, { ...client.record, full_name: 'Lost update' }),
    () => setAssignee(client.id, two.user.id),
  );
  assert.equal(edit.status, 404);
  assert.equal(edit.value.message, 'Record not found.');
  assert.equal(payload(client.id), 'Before:1');
  assert.equal(assigneeOf(client.id), two.user.id);
  const theirs = await patch(two, 'Clients', client, { ...client.record, full_name: 'Two edits' });
  assert.equal(theirs.status, 200);
  const child = await add(two, 'Viewings', { client_id: 'RACE-CL' });
  const childEdit = await behindLock(
    () => patch(two, 'Viewings', child, { ...child.record, notes: 'Late' }),
    () => setAssignee(client.id, one.user.id),
  );
  assert.equal(childEdit.status, 404);
});

test('an edit queued behind a lost full-team grant uses the re-read scope', async () => {
  const invited = await invite(admin, 'race-manager', { positions: ['property-agent'] });
  const manager = await setScope(admin, await activate(invited), 'team');
  const client = await add(admin, 'Clients', { client_id: 'RACE-TEAM', full_name: 'Before' });
  const edit = await behindLock(
    () => patch(manager, 'Clients', client, { ...client.record, full_name: 'After' }),
    () => query(`UPDATE crm_users SET record_scope='assigned' WHERE id='${manager.user.id}'`),
  );
  assert.equal(edit.status, 404);
  assert.equal(payload(client.id), 'Before:1');
  const issued = await manager.request(`/workspaces/${admin.user.id}/records/Clients`, {
    method: 'POST',
    body: { record: { client_id: 'RACE-TYPED' } },
  });
  assert.equal(issued.status, 400);
  const created = await behindLock(
    () =>
      manager.request(`/workspaces/${admin.user.id}/records/Clients`, {
        method: 'POST',
        body: { record: { full_name: 'Queued create' } },
      }),
    () => query(`UPDATE crm_users SET active=false WHERE id='${manager.user.id}'`),
  );
  assert.equal(created.status, 403);
});
