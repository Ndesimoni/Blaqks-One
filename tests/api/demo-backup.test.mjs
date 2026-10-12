import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { parseFullBackup } from '../../src/services/files/backup.js';
import { collections, commit, counts, fixtures, organisation, planned } from './import-helpers.mjs';

let owner;
before(async () => ({ owner } = await fixtures()));

test('the complete generated demo backup imports all supported records and labelled photos', async () => {
  const path = 'public/demo/demo-workspace-backup.json';
  const raw = await readFile(path, 'utf8');
  const backup = JSON.parse(raw);
  assert.equal(backup.demo, true);
  const data = parseFullBackup(raw);
  assert.ok(data['Follow-ups'].length > 0);
  const records = Object.fromEntries(collections.map((name) => [name, data[name]]));
  const plan = await planned(owner, organisation, records, organisation);
  assert.deepEqual(
    plan.counts,
    counts({
      Clients: 8,
      Contacts: 3,
      Properties: 13,
      'Follow-ups': 6,
      Viewings: 4,
      Shortlist: 3,
      'Interaction log': 2,
      'Client care': 1,
    }),
  );
  const result = await commit(owner, organisation, plan.token);
  assert.equal(result.status, 200);
  const saved = await owner.request(`/workspaces/${organisation}/records`);
  assert.ok(saved.value.records.Properties.every(({ record }) => record.media_photos[0].demo));
  assert.equal(await readFile(path, 'utf8'), raw);
});
