import assert from 'node:assert/strict';
import { test } from 'node:test';
import { query } from './helpers.mjs';
import { jpegWithGps } from './media-helpers.mjs';
import { sampleAdmin } from './sample-helpers.mjs';
import * as backfillHelpers from './media-backfill-helpers.mjs';

// F2 backfill review (L6): storage failures and archived companies change nothing.
const { backfill, backfillWith, dataUrl, snapshot, workspaceReport } = backfillHelpers;
const { allFiles, hiddenFiles, movedFiles } = backfillHelpers;

/** A fresh company with one property holding a synthetic inline photo. */
async function inlineCompany(prefix) {
  const company = await sampleAdmin(prefix);
  const created = await company.admin.request(
    `/workspaces/${company.workspace}/records/Properties`,
    {
      method: 'POST',
      body: {
        record: {
          listing_title: 'Synthetic guard listing',
          media_photos: [{ name: 'Front', src: dataUrl('image/jpeg', jpegWithGps()) }],
        },
      },
    },
  );
  assert.equal(created.status, 201, JSON.stringify(created.value));
  return { ...company, record: created.value };
}

test('unreachable storage fails the record, changes nothing and hides the reservation', async () => {
  const { workspace, record } = await inlineCompany('media-backfill-storage');
  const before = snapshot([record.id]);
  const unreachable = { CRM_MEDIA_ENDPOINT: 'http://127.0.0.1:9' };
  const run = backfillWith(unreachable, '--workspace', workspace, '--apply');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.report.storage.host, '127.0.0.1:9', 'the report names the target');
  const ours = workspaceReport(run.report, workspace);
  assert.deepEqual([ours.records, ours.entries, ours.failed], [0, 0, [record.id]]);
  assert.deepEqual(ours.left, []);
  assert.equal(snapshot([record.id]), before, 'the inline photo is untouched');
  assert.equal(movedFiles(workspace), 0, 'nothing visible');
  assert.equal(hiddenFiles(workspace), 1, 'the reservation is hidden for the sweep');
  const retry = backfill('--workspace', workspace, '--apply');
  assert.equal(retry.status, 0, retry.stderr);
  assert.deepEqual(workspaceReport(retry.report, workspace).failed, [], 'a later run moves it');
  assert.equal(movedFiles(workspace), 1);
});

test('an archived company is reported and never changed', async () => {
  const { workspace, record } = await inlineCompany('media-backfill-archived');
  query(
    `UPDATE crm_users SET active=false, deleted_at=now()
     WHERE id=(SELECT owner_id FROM crm_workspaces WHERE id='${workspace}')`,
  );
  const before = snapshot([record.id]);
  for (const args of [[], ['--apply']]) {
    const run = backfill('--workspace', workspace, ...args);
    assert.equal(run.status, 0, run.stderr);
    const ours = workspaceReport(run.report, workspace);
    assert.deepEqual([ours.archived, ours.records, ours.entries, ours.left], [true, 0, 0, []]);
  }
  assert.equal(snapshot([record.id]), before);
  assert.equal(allFiles(workspace), 0, 'nothing reserved or stored');
});
