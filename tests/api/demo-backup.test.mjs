import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { parseFullBackup } from '../../src/services/files/backup.js';
import { commit, fixtures, organisation, planned } from './import-helpers.mjs';

let owner;
before(async () => ({ owner } = await fixtures()));

test('the complete generated demo backup imports all supported records and labelled photos', async () => {
  const path = 'public/demo/demo-workspace-backup.json';
  const raw = await readFile(path, 'utf8');
  const backup = JSON.parse(raw);
  assert.equal(backup.demo, true);
  const data = parseFullBackup(raw);
  assert.ok(data['Follow-ups'].length > 0);
  const records = Object.fromEntries(
    ['Clients', 'Contacts', 'Properties'].map((name) => [name, data[name]]),
  );
  const plan = await planned(owner, organisation, records, organisation);
  assert.deepEqual(plan.counts, { Clients: 8, Contacts: 3, Properties: 13 });
  const result = await commit(owner, organisation, plan.token);
  assert.equal(result.status, 200);
  const saved = await owner.request(`/workspaces/${organisation}/records`);
  assert.ok(saved.value.records.Properties.every(({ record }) => record.media_photos[0].demo));
  assert.equal(await readFile(path, 'utf8'), raw);
});
