import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  add,
  assigneeOf,
  assignmentTeams,
  history,
  patch,
  remove,
  setAssignee,
} from './assignment-helpers.mjs';

let admin, one, two, mine, theirs, spare;
const held = async (record, holder) => {
  const entry = await add(admin, 'Clients', record);
  setAssignee(entry.id, holder.user.id);
  return entry;
};

before(async () => {
  ({ admin, one, two } = await assignmentTeams('rules'));
  mine = await held({ client_id: 'R-CL-MINE' }, one);
  spare = await held({ client_id: 'R-CL-SPARE' }, one);
  theirs = await held({ client_id: 'R-CL-THEIRS', full_name: 'Two' }, two);
});

test('records start with their creator or owner and record that in history', async () => {
  const created = await add(one, 'Clients', { full_name: 'Staff created' });
  assert.match(created.record.client_id, /^CL-\d{3}$/);
  assert.equal(created.assignee, one.user.id);
  assert.equal(history(created.id), `created:${one.user.id}:${one.user.id}`);
  const owned = await add(admin, 'Contacts', { contact_id: 'R-CT-ADMIN' });
  assert.equal(owned.assignee, admin.user.id);
  const linked = await add(one, 'Follow-ups', { client_id: 'R-CL-MINE' });
  assert.equal(linked.assignee, null);
  assert.equal(history(linked.id), '');
  const loose = await add(one, 'Follow-ups', { notes: 'Call the landlord' });
  assert.equal(loose.assignee, one.user.id);
  const typed = await one.request(`/workspaces/${admin.user.id}/records/Clients`, {
    method: 'POST',
    body: { record: { client_id: 'R-TYPED' } },
  });
  assert.equal(typed.status, 400);
  assert.equal(typed.value.message, 'Record IDs are issued by the server.');
  const orphan = await one.request(`/workspaces/${admin.user.id}/records/Viewings`, {
    method: 'POST',
    body: { record: {} },
  });
  assert.equal(orphan.status, 400);
  assert.equal(orphan.value.message, 'Choose one of your clients for this record.');
});

test('assigned-only staff cannot delete parents but may delete their activity records', async () => {
  const bare = await add(one, 'Properties', { listing_title: 'No dependents' });
  const busy = await add(one, 'Properties', { listing_title: 'Hidden dependent' });
  await add(admin, 'Viewings', {
    viewing_id: 'R-VW-HIDDEN',
    client_id: 'R-CL-THEIRS',
    property_id: busy.record.property_id,
  });
  const denied = new Set();
  for (const [collection, id] of [
    ['Properties', bare.id],
    ['Properties', busy.id],
    ['Clients', mine.id],
    ['Clients', theirs.id],
  ]) {
    const result = await remove(one, collection, id);
    denied.add(`${result.status} ${JSON.stringify(result.value)}`);
  }
  assert.deepEqual(
    [...denied],
    [
      `403 ${JSON.stringify({ code: 'forbidden', message: 'Ask your Admin to delete this record.' })}`,
    ],
  );
  const viewing = await add(one, 'Viewings', { client_id: 'R-CL-MINE' });
  assert.equal((await remove(one, 'Viewings', viewing.id)).status, 200);
  assert.equal((await remove(admin, 'Properties', bare.id)).status, 200);
});

test('assigned-only updates keep IDs and only move children between held clients', async () => {
  const renamed = await patch(one, 'Clients', mine, { client_id: 'R-CL-RENAMED' });
  assert.equal(renamed.status, 400);
  assert.equal(renamed.value.message, 'Record IDs cannot be changed.');
  const care = await add(one, 'Client care', { client_id: 'R-CL-MINE' });
  const moved = await patch(one, 'Client care', care, { ...care.record, client_id: 'R-CL-THEIRS' });
  assert.equal(moved.status, 409);
  assert.equal(moved.value.code, 'link_missing');
  const cleared = await patch(one, 'Client care', care, { ...care.record, client_id: '' });
  assert.equal(cleared.status, 400);
  assert.equal(cleared.value.message, 'Choose one of your clients for this record.');
  const kept = await patch(one, 'Client care', care, { ...care.record, client_id: 'R-CL-SPARE' });
  assert.equal(kept.status, 200, JSON.stringify(kept.value));
  assert.equal(kept.value.record.client_id, 'R-CL-SPARE');
});

test('a direct assignee keeps but cannot move a task on another holder’s client', async () => {
  const task = await add(admin, 'Follow-ups', {
    activity_id: 'R-FU-TASK',
    client_id: 'R-CL-THEIRS',
  });
  setAssignee(task.id, one.user.id);
  const same = await patch(one, 'Follow-ups', task, { ...task.record, notes: 'Called' });
  assert.equal(same.status, 200, JSON.stringify(same.value));
  for (const client_id of ['R-CL-MINE', '']) {
    const moved = await patch(one, 'Follow-ups', same.value, { ...same.value.record, client_id });
    assert.equal(moved.status, 403, client_id);
    assert.equal(moved.value.message, "Only the client's holder can move this follow-up.");
  }
  const owned = await add(admin, 'Follow-ups', { activity_id: 'R-FU-OWN', client_id: 'R-CL-MINE' });
  assert.equal(owned.assignee, null);
  const detached = await patch(one, 'Follow-ups', owned, { ...owned.record, client_id: '' });
  assert.equal(detached.status, 200, JSON.stringify(detached.value));
  assert.equal(detached.value.version, 2);
  assert.equal(detached.value.assignee, one.user.id);
  assert.equal(assigneeOf(owned.id), one.user.id);
  assert.equal(history(owned.id), `reassigned:${one.user.id}:${one.user.id}`);
  assert.equal((await patch(two, 'Follow-ups', owned, owned.record, 2)).status, 404);
});
