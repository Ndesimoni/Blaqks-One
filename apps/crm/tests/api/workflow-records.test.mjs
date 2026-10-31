import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { setScope } from './assignment-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const path = (workspace, collection, id) =>
  `/workspaces/${workspace}/records/${encodeURIComponent(collection)}${id ? `/${id}` : ''}`;

test('client workflow records require same-workspace links and protect linked clients', async () => {
  const admin = await login('admin-a');
  const other = await login('admin-b');
  const client = await create(admin, 'Clients', { client_id: 'WF-CLIENT', full_name: 'Link' });
  await create(admin, 'Properties', { property_id: 'WF-PROPERTY', listing_title: 'Villa' });
  await create(other, 'Clients', { client_id: 'WF-FOREIGN', full_name: 'Other team' });
  const viewing = await create(admin, 'Viewings', {
    viewing_id: 'WF-VIEW',
    client_id: ' WF-CLIENT ',
    property_id: 'WF-PROPERTY',
    client_feedback: 'Synthetic feedback',
  });
  assert.equal(viewing.record.client_id, 'WF-CLIENT');
  await create(admin, 'Interaction log', {
    log_id: 'WF-LOG',
    client_id: 'WF-CLIENT',
    property_id_optional: '',
  });
  for (const record of [
    { activity_id: 'WF-MISSING', client_id: 'WF-NOBODY' },
    { activity_id: 'WF-CROSS', client_id: 'WF-FOREIGN' },
    { activity_id: 'WF-PROP', client_id: 'WF-CLIENT', property_id: 'WF-NONE' },
  ]) {
    const response = await admin.request(path(admin.user.id, 'Follow-ups'), {
      method: 'POST',
      body: { record },
    });
    assert.equal(response.status, 409, JSON.stringify(record));
  }
  const blocked = await admin.request(path(admin.user.id, 'Clients', client.id), {
    method: 'DELETE',
    body: { version: 1 },
  });
  assert.equal(blocked.status, 409);
  const unsupported = await admin.request(path(admin.user.id, 'Deals'), {
    method: 'POST',
    body: { record: { deal_id: 'WF-DEAL' } },
  });
  assert.equal(unsupported.status, 400);
  const list = await admin.request(`/workspaces/${admin.user.id}/records`);
  assert.equal(list.value.records.Viewings[0].record.viewing_id, 'WF-VIEW');
  assert.deepEqual(list.value.records['Client care'], []);
  const audit = query(
    `SELECT collection FROM crm_activity WHERE record_id='${viewing.id}' AND action='created'`,
  );
  assert.equal(audit, 'Viewings');
});

test('scheduling staff manage workflow records without seeing relationship records', async () => {
  const admin = await login('admin-a');
  await create(admin, 'Clients', { client_id: 'WF-STAFF-CLIENT', full_name: 'Private' });
  const scheduler = await activate(
    await invite(admin, 'workflow-scheduler', {
      permissions: { schedule: true },
    }),
  );
  // Full-team access lets a scheduler work on any team client without the relationships grant.
  const staff = await setScope(admin, scheduler, 'team');
  const workspace = admin.user.id;
  const saved = await staff.request(path(workspace, 'Follow-ups'), {
    method: 'POST',
    body: { record: { activity_id: 'WF-STAFF-FU', client_id: 'WF-STAFF-CLIENT' } },
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.value));
  const list = await staff.request(`/workspaces/${workspace}/records`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.value.records.Clients, []);
  assert.deepEqual(list.value.records.Shortlist, []);
  assert.ok(list.value.records['Follow-ups'].some((row) => row.id === saved.value.id));
  for (const collection of ['Clients', 'Shortlist']) {
    const denied = await staff.request(path(workspace, collection), {
      method: 'POST',
      body: { record: { client_id: 'WF-DENIED', match_id: 'WF-DENIED' } },
    });
    assert.equal(denied.status, 403, collection);
  }
});
