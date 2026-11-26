import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { add, assignmentTeams, setAssignee, workspacePath } from './assignment-helpers.mjs';

let admin, other, one, hidden, foreign, mine;
const notFound = JSON.stringify({ code: 'not_found', message: 'Record not found.' });
const shape = ({ status, value }) => `${status} ${JSON.stringify(value)}`;

before(async () => {
  ({ admin, other, one } = await assignmentTeams('matrix'));
  mine = await add(admin, 'Clients', { client_id: 'H1-MINE', full_name: 'Held' });
  setAssignee(mine.id, one.user.id);
  hidden = {
    Clients: await add(admin, 'Clients', { client_id: 'H1-HIDDEN', full_name: 'Hidden' }),
    Viewings: await add(admin, 'Viewings', { viewing_id: 'H1-VW', client_id: 'H1-HIDDEN' }),
  };
  await add(other, 'Clients', { client_id: 'H1-HIDDEN', full_name: 'Other team' });
  foreign = {
    Clients: await add(other, 'Clients', { client_id: 'H1-CROSS' }),
    Viewings: await add(other, 'Viewings', { viewing_id: 'H1-VW', client_id: 'H1-HIDDEN' }),
  };
});

const targets = (collection) => ({
  hidden: hidden[collection].id,
  unknown: randomUUID(),
  cross: foreign[collection].id,
});

test('hidden, unknown and other-team records give identical update responses', async () => {
  const bodies = {
    Clients: [
      hidden.Clients.record,
      { client_id: 'H1-HIDDEN', referred_by_client_id: 'H1-MINE' },
      { client_id: 'H1-RENAMED' },
    ],
    Viewings: [
      hidden.Viewings.record,
      { viewing_id: 'H1-VW', client_id: 'H1-MINE' },
      { viewing_id: 'H1-VW' },
    ],
  };
  for (const [collection, records] of Object.entries(bodies)) {
    for (const record of records) {
      for (const version of [1, 7]) {
        const seen = new Set();
        for (const [kind, id] of Object.entries(targets(collection))) {
          const result = await one.request(workspacePath(one, collection, id), {
            method: 'PATCH',
            body: { version, record },
          });
          assert.equal(result.status, 404, `${collection} ${kind}`);
          seen.add(shape(result));
        }
        assert.deepEqual([...seen], [`404 ${notFound}`]);
      }
    }
  }
  const stale = await one.request(workspacePath(one, 'Clients', mine.id), {
    method: 'PATCH',
    body: { version: 7, record: mine.record },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'version_conflict');
});

test('hidden, unknown and other-team records give identical delete responses', async () => {
  for (const collection of ['Clients', 'Viewings']) {
    for (const version of [1, 7]) {
      const seen = new Set();
      for (const id of Object.values(targets(collection))) {
        const result = await one.request(workspacePath(one, collection, id), {
          method: 'DELETE',
          body: { version },
        });
        seen.add(shape(result));
      }
      assert.equal(seen.size, 1, [...seen].join(' | '));
      const expected =
        collection === 'Clients'
          ? `403 ${JSON.stringify({ code: 'forbidden', message: 'Ask your Admin to delete this record.' })}`
          : `404 ${notFound}`;
      assert.deepEqual([...seen], [expected]);
    }
  }
  assert.equal((await admin.request(workspacePath(admin))).value.records.Viewings.length, 1);
});

test('creating with a hidden link is indistinguishable from a missing one', async () => {
  for (const [collection, field, record] of [
    ['Viewings', 'client_id', {}],
    ['Follow-ups', 'client_id', {}],
    ['Properties', 'contact_id', {}],
    ['Clients', 'referred_by_client_id', { full_name: 'New' }],
  ]) {
    const hiddenId = collection === 'Properties' ? 'H1-CT-HIDDEN' : 'H1-HIDDEN';
    if (collection === 'Properties') await add(admin, 'Contacts', { contact_id: hiddenId });
    const seen = new Set();
    for (const target of [hiddenId, 'H1-NOWHERE', 'H1-CROSS']) {
      const result = await one.request(workspacePath(one, collection), {
        method: 'POST',
        body: { record: { ...record, [field]: target } },
      });
      assert.equal(result.status, 409, `${collection} ${target}`);
      assert.equal(result.value.code, 'link_missing');
      seen.add(shape(result));
    }
    assert.equal(seen.size, 1, collection);
  }
  const allowed = await one.request(workspacePath(one, 'Viewings'), {
    method: 'POST',
    body: { record: { client_id: 'H1-MINE' } },
  });
  assert.equal(allowed.status, 201, JSON.stringify(allowed.value));
});
