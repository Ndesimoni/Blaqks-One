import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { parseFullBackup } from '../../src/services/files/backup.js';
import { activate, invite } from './team-helpers.mjs';
import {
  collections,
  commit,
  counts,
  fixtures,
  organisation,
  planned,
  preview,
} from './import-helpers.mjs';

let owner, admin;
before(async () => {
  ({ owner } = await fixtures());
  const invited = await invite(owner, 'demo-backup-admin', { accountRole: 'admin', positions: [] });
  admin = await activate(invited);
});

// The organisation's browser set imports into a company Admin's own workspace (BO1a, Q3).
test('the complete generated demo backup imports all supported records and labelled photos', async () => {
  const path = 'apps/crm/public/demo/demo-workspace-backup.json';
  const raw = await readFile(path, 'utf8');
  const backup = JSON.parse(raw);
  assert.equal(backup.demo, true);
  const data = parseFullBackup(raw);
  assert.ok(data['Follow-ups'].length > 0);
  const records = Object.fromEntries(collections.map((name) => [name, data[name]]));
  for (const workspace of [organisation, admin.user.id])
    assert.equal((await preview(owner, workspace, records, organisation)).status, 403);
  const plan = await planned(admin, admin.user.id, records, organisation);
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
  const result = await commit(admin, admin.user.id, plan.token);
  assert.equal(result.status, 200);
  const saved = await admin.request(`/workspaces/${admin.user.id}/records`);
  assert.ok(saved.value.records.Properties.every(({ record }) => record.media_photos[0].demo));
  assert.equal(await readFile(path, 'utf8'), raw);
});
