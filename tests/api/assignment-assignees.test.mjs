import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import {
  add,
  assign,
  assignees,
  assignmentTeams,
  history,
  versionOf,
} from './assignment-helpers.mjs';

let owner, admin, other, one, two, reception, suspended, archived, stranger;
const INELIGIBLE = 'Choose an active team member with access to this record type.';

before(async () => {
  ({ owner, admin, other, one, two } = await assignmentTeams('eligible'));
  reception = await activate(await invite(admin, 'eligible-reception'));
  suspended = await activate(
    await invite(admin, 'eligible-suspended', { positions: ['property-agent'] }),
  );
  const member = await findMember(admin, suspended.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200);
  archived = await activate(
    await invite(admin, 'eligible-archived', { positions: ['property-agent'] }),
  );
  const review = await archiveReview(owner, admin, await findMember(admin, archived.user.id));
  assert.equal((await archive(owner, admin, review)).status, 200);
  stranger = await activate(
    await invite(other, 'eligible-stranger', { positions: ['property-agent'] }),
  );
});

const names = (result) => result.value.assignees.map((person) => person.id);

test('assignee options list active teammates with the grant plus the owner, as id and name only', async () => {
  const properties = await assignees(admin, 'Properties');
  assert.equal(properties.status, 200);
  assert.deepEqual(names(properties).sort(), [admin.user.id, one.user.id, two.user.id].sort());
  assert.ok(properties.value.assignees.every((person) => Object.keys(person).join() === 'id,name'));
  const clients = names(await assignees(admin, 'Clients'));
  assert.ok(clients.includes(reception.user.id));
  for (const hidden of [suspended, archived, stranger, owner]) {
    assert.ok(!clients.includes(hidden.user.id));
  }
  assert.deepEqual(names(await assignees(one, 'Follow-ups')).sort(), [...clients].sort());
  assert.deepEqual(
    names(await assignees(owner, 'Properties', admin.user.id)).sort(),
    names(properties).sort(),
  );
  const organisation = names(await assignees(owner, 'Clients'));
  assert.ok(organisation.includes(owner.user.id));
  for (const collection of ['Viewings', 'Deals', '']) {
    assert.equal((await assignees(admin, collection)).status, 400, collection);
  }
  assert.equal((await assignees(reception, 'Properties')).status, 403);
  assert.equal((await assignees(stranger, 'Clients', admin.user.id)).status, 403);
});

test('assignments only reach active teammates holding the grant', async () => {
  const property = await add(admin, 'Properties', { property_id: 'EL-PR' });
  const outcomes = new Set();
  for (const person of [suspended, archived, stranger, reception, other]) {
    const result = await assign(admin, 'Properties', property, person.user.id);
    assert.equal(result.status, 400, person.user.email);
    outcomes.add(JSON.stringify(result.value));
  }
  const unknown = await assign(
    admin,
    'Properties',
    property,
    '00000000-0000-4000-8000-000000000001',
  );
  outcomes.add(JSON.stringify(unknown.value));
  assert.deepEqual(
    [...outcomes],
    [JSON.stringify({ code: 'invalid_request', message: INELIGIBLE })],
  );
  assert.equal(versionOf(property.id), 1);
  assert.equal(history(property.id), `created:${admin.user.id}:${admin.user.id}`);
  const moved = await assign(admin, 'Properties', property, one.user.id, {
    body: { note: ' Keys at reception ' },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  assert.equal(moved.value.entry.assignee, one.user.id);
  assert.equal(moved.value.entry.version, 2);
  assert.equal(
    query(`SELECT note FROM crm_assignment_notes WHERE record_id='${property.id}'`),
    'Keys at reception',
  );
  const same = await assign(admin, 'Properties', moved.value.entry, one.user.id, {
    body: { note: 'Again' },
  });
  assert.equal(same.status, 200);
  assert.equal(same.value.entry.version, 2);
  assert.equal(history(property.id).split(',').length, 2);
  assert.equal(
    query(`SELECT count(*) FROM crm_assignment_notes WHERE record_id='${property.id}'`),
    '1',
  );
  const contact = await add(admin, 'Contacts', { contact_id: 'EL-CT' });
  assert.equal((await assign(admin, 'Contacts', contact, reception.user.id)).status, 200);
});
