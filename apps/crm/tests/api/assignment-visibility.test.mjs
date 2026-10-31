import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { activate, invite } from './team-helpers.mjs';
import {
  add,
  assignmentTeams,
  list,
  setAssignee,
  setScope,
  workspacePath,
} from './assignment-helpers.mjs';

const idKeys = {
  Clients: 'client_id',
  Contacts: 'contact_id',
  Properties: 'property_id',
  'Follow-ups': 'activity_id',
  Viewings: 'viewing_id',
  Shortlist: 'match_id',
  'Interaction log': 'log_id',
  'Client care': 'care_id',
};
let admin, one, two;
const legacy = (body, collection) =>
  body.records[collection].map(({ record }) => record[idKeys[collection]]).sort();

before(async () => {
  ({ admin, one, two } = await assignmentTeams('visible'));
  const held = async (collection, record, holder) => {
    const entry = await add(admin, collection, record);
    if (holder !== undefined) setAssignee(entry.id, holder?.user.id);
    return entry;
  };
  await held('Clients', { client_id: 'V-CL-ONE', full_name: 'One client' }, one);
  const secret = { client_id: 'V-CL-TWO', full_name: 'Two client', phone: '+971500000002' };
  await held('Clients', { ...secret, email: 'two@client.test', notes: 'private' }, two);
  await held('Clients', { client_id: 'V-CL-REF', full_name: 'Hidden referrer' });
  await held('Clients', { client_id: 'V-CL-MINE', referred_by_client_id: 'V-CL-REF' }, one);
  await held('Contacts', { contact_id: 'V-CT-OWNER', full_name: 'Landlord' });
  await held('Contacts', { contact_id: 'V-CT-HIDDEN', full_name: 'Hidden landlord' });
  await held('Properties', { property_id: 'V-PR-ONE', contact_id: 'V-CT-OWNER' }, one);
  await held('Properties', { property_id: 'V-PR-TWO', listing_title: 'Two listing' }, two);
  await held('Follow-ups', { activity_id: 'V-FU-ONE', client_id: 'V-CL-ONE' });
  await held('Follow-ups', { activity_id: 'V-FU-TASK', client_id: 'V-CL-TWO' }, one);
  const viewing = { client_id: 'V-CL-TWO', property_id: 'V-PR-ONE' };
  await held('Viewings', {
    viewing_id: 'V-VW-OTHER',
    ...viewing,
    appointment_date_time: '2026-11-02 10:00',
  });
  await held('Viewings', {
    viewing_id: 'V-VW-MINE',
    client_id: 'V-CL-ONE',
    property_id: 'V-PR-ONE',
  });
  await held('Shortlist', { match_id: 'V-MT-ONE', client_id: 'V-CL-ONE', property_id: 'V-PR-TWO' });
});

test('assigned-only staff list only visible rows, with projections limited to allowed fields', async () => {
  const body = await list(one);
  assert.equal(body.scope, 'assigned');
  assert.deepEqual(Object.keys(body.records).sort(), Object.keys(idKeys).sort());
  assert.deepEqual(legacy(body, 'Clients'), ['V-CL-MINE', 'V-CL-ONE']);
  assert.deepEqual(legacy(body, 'Contacts'), ['V-CT-OWNER']);
  assert.deepEqual(legacy(body, 'Properties'), ['V-PR-ONE']);
  assert.deepEqual(legacy(body, 'Follow-ups'), ['V-FU-ONE', 'V-FU-TASK']);
  assert.deepEqual(legacy(body, 'Viewings'), ['V-VW-MINE']);
  assert.deepEqual(legacy(body, 'Shortlist'), ['V-MT-ONE']);
  assert.ok(body.records.Clients.every((entry) => entry.assignee === one.user.id));
  assert.ok(body.records.Viewings.every((entry) => entry.assignee === null));
  assert.deepEqual(body.references, {
    Clients: [{ client_id: 'V-CL-REF', full_name: 'Hidden referrer' }],
    Properties: [{ property_id: 'V-PR-TWO', listing_title: 'Two listing' }],
    Contacts: [],
  });
  assert.deepEqual(body.taskClients, [
    {
      client_id: 'V-CL-TWO',
      full_name: 'Two client',
      phone: '+971500000002',
      email: 'two@client.test',
    },
  ]);
  assert.deepEqual(body.listingViewings, [
    {
      property_id: 'V-PR-ONE',
      appointment_date_time: '2026-11-02 10:00',
      agent: { id: two.user.id, name: two.user.name },
    },
  ]);
  const other = await list(two);
  assert.deepEqual(legacy(other, 'Clients'), ['V-CL-TWO']);
  assert.deepEqual(legacy(other, 'Viewings'), ['V-VW-OTHER']);
  assert.deepEqual(legacy(other, 'Follow-ups'), ['V-FU-TASK']);
  assert.deepEqual(other.listingViewings, []);
  assert.deepEqual(other.taskClients, []);
});

test('team scope sees the whole workspace and receives no projections', async () => {
  const body = await list(admin);
  assert.equal(body.scope, 'team');
  assert.equal(body.records.Clients.length, 4);
  assert.equal(body.records.Viewings.length, 2);
  assert.deepEqual(body.references, { Clients: [], Properties: [], Contacts: [] });
  assert.deepEqual(body.taskClients, []);
  assert.deepEqual(body.listingViewings, []);
});

test('full-team staff remain limited to their granted collections', async () => {
  const invited = await invite(admin, 'visible-manager', { positions: ['receptionist'] });
  const manager = await setScope(admin, await activate(invited), 'team');
  assert.equal(manager.user.recordScope, 'team');
  assert.equal(manager.user.permissions.properties, false);
  const body = await list(manager);
  assert.equal(body.scope, 'team');
  assert.equal(body.records.Clients.length, 4);
  assert.equal(body.records['Follow-ups'].length, 2);
  for (const collection of ['Properties', 'Shortlist']) {
    assert.deepEqual(body.records[collection], [], collection);
  }
  assert.deepEqual(body.references.Properties, []);
  assert.deepEqual(body.listingViewings, []);
  const blocked = await manager.request(workspacePath(manager, 'Properties'), {
    method: 'POST',
    body: { record: { property_id: 'V-PR-MANAGER' } },
  });
  assert.equal(blocked.status, 403);
  const typed = await add(manager, 'Clients', { client_id: 'V-CL-MANAGER' });
  assert.equal(typed.record.client_id, 'V-CL-MANAGER');
  assert.equal(typed.assignee, manager.user.id);
});
