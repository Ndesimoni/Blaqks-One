import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { add, setAssignee } from './assignment-helpers.mjs';
import {
  MESSAGES,
  actions,
  forbidden,
  grant,
  permissionTeams,
  recordPath,
  seedRecords,
} from './permission-helpers.mjs';

let teams, records, workspace, foreign;
before(async () => {
  teams = await permissionTeams('perm-leak');
  workspace = teams.admin.user.workspaceId;
  records = await seedRecords(teams.admin, 'LK');
  foreign = await add(teams.other, 'Clients', { client_id: 'LK-FOREIGN' });
});

const send = (session, method, collection, id, body, suffix = '') =>
  session.request(`${recordPath(workspace, collection, id)}${suffix}`, { method, body });

test('a missing action gives the same 403 for visible, hidden, unknown and cross-team IDs', async () => {
  const { assigned, viewOnly } = teams;
  const mine = await add(assigned, 'Clients', { full_name: 'Held by the agent' });
  const ids = {
    visible: mine.id,
    hidden: records.Clients.id,
    unknown: randomUUID(),
    crossTeam: foreign.id,
    malformed: 'not-a-uuid',
  };
  for (const [kind, id] of Object.entries(ids)) {
    const body = { version: 1 };
    forbidden(await send(assigned, 'DELETE', 'Clients', id, body), MESSAGES.delete, kind);
    forbidden(await send(assigned, 'DELETE', 'Clients', id, {}), MESSAGES.delete, kind);
    const edit = { version: 1, record: { client_id: 'X' } };
    forbidden(await send(viewOnly, 'PATCH', 'Clients', id, edit), MESSAGES.edit, kind);
    const hand = { version: 1, assigneeId: teams.two.user.id };
    forbidden(await send(viewOnly, 'PUT', 'Clients', id, hand, '/assignee'), MESSAGES.assign, kind);
  }
  forbidden(await send(viewOnly, 'POST', 'Clients', undefined, 'oops'), MESSAGES.create);
});

test('view-only members still read records and can still be assigned them', async () => {
  const { admin, viewOnly } = teams;
  const listed = await viewOnly.request(`/workspaces/${workspace}/records`);
  assert.equal(listed.status, 200);
  assert.ok(listed.value.records.Clients.some((entry) => entry.id === records.Clients.id));
  const client = await add(admin, 'Clients', { client_id: 'LK-VIEWER' });
  const moved = await send(
    admin,
    'PUT',
    'Clients',
    client.id,
    {
      version: 1,
      assigneeId: viewOnly.user.id,
    },
    '/assignee',
  );
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  const edit = { version: 2, record: { client_id: 'LK-VIEWER', full_name: 'Edited' } };
  forbidden(await send(viewOnly, 'PATCH', 'Clients', client.id, edit), MESSAGES.edit);
});

test('parent deletes and ID changes need every referencing module (M-C)', async () => {
  const { admin, teamDelete } = teams;
  const partial = await grant(admin, teamDelete, {
    permissions: { ...teamDelete.user.permissions, schedule: false },
    actions: actions(true, { schedule: actions(false).schedule }),
  });
  assert.equal(partial.user.recordActions.Clients.delete, false);
  assert.equal(partial.user.recordActions.Properties.delete, false);
  assert.equal(partial.user.recordActions.Contacts.delete, true);
  assert.equal(partial.user.actions.relationships.deleteMain, true);
  const client = await add(admin, 'Clients', { client_id: 'LK-MC-CL' });
  forbidden(await send(partial, 'DELETE', 'Clients', client.id, { version: 1 }), MESSAGES.delete);
  const renamed = await send(partial, 'PATCH', 'Clients', client.id, {
    version: 1,
    record: { client_id: 'LK-MC-RENAMED' },
  });
  assert.equal(renamed.status, 400);
  assert.equal(renamed.value.message, 'Record IDs cannot be changed.');
  const kept = await send(partial, 'PATCH', 'Clients', client.id, {
    version: 1,
    record: { client_id: 'LK-MC-CL', full_name: 'Same ID' },
  });
  assert.equal(kept.status, 200, JSON.stringify(kept.value));
  const contact = await add(admin, 'Contacts', { contact_id: 'LK-MC-CT' });
  assert.equal((await send(partial, 'DELETE', 'Contacts', contact.id, { version: 1 })).status, 200);
  const full = await grant(admin, partial, {
    permissions: { ...partial.user.permissions, schedule: true },
  });
  const property = await add(admin, 'Properties', { property_id: 'LK-MC-PR' });
  const rename = { version: 1, record: { property_id: 'LK-MC-PR2' } };
  assert.equal((await send(full, 'PATCH', 'Properties', property.id, rename)).status, 200);
  assert.equal((await send(full, 'DELETE', 'Properties', property.id, { version: 2 })).status, 200);
});

test('permitted callers complete real writes within their grants', async () => {
  const { admin, assigned, teamKeep } = teams;
  const client = await add(assigned, 'Clients', { full_name: 'Agent client' });
  const viewing = await add(assigned, 'Viewings', { client_id: client.record.client_id });
  assert.equal(
    (await send(assigned, 'DELETE', 'Viewings', viewing.id, { version: 1 })).status,
    200,
  );
  const care = await add(teamKeep, 'Client care', { client_id: 'LK-CL' });
  assert.equal(
    (await send(teamKeep, 'DELETE', 'Client care', care.id, { version: 1 })).status,
    200,
  );
  const contact = await add(admin, 'Contacts', { contact_id: 'LK-KEEP-CT' });
  forbidden(
    await send(teamKeep, 'DELETE', 'Contacts', contact.id, { version: 1 }),
    MESSAGES.delete,
  );
  setAssignee(contact.id, teamKeep.user.id);
  forbidden(
    await send(teamKeep, 'DELETE', 'Contacts', contact.id, { version: 1 }),
    MESSAGES.delete,
  );
});
