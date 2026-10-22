import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jpegWithGps, pdf } from './media-helpers.mjs';
import * as backfillHelpers from './media-backfill-helpers.mjs';
import * as fixtures from './media-backfill-fixtures.mjs';

// F2 backfill: the trusted command moves inline property photos and floor plans into storage.
const { backfill, snapshot, payload, version, movedFiles } = backfillHelpers;
const { workspaceReport, recordFile } = backfillHelpers;
const { admin, workspace, recordsPath, otherWorkspace, demo, animation } = fixtures;
const { villa, huge, other, ids, expectedLeft } = fixtures;

test('a dry run reports what would move and changes nothing', () => {
  const before = snapshot(ids);
  const run = backfill('--workspace', workspace);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.report.mode, 'dry-run');
  const ours = workspaceReport(run.report, workspace);
  assert.equal(ours.archived, false);
  assert.deepEqual([ours.records, ours.entries], [1, 2]);
  assert.ok(ours.bytes > 0 && ours.bytes < jpegWithGps().length + pdf().length);
  assert.deepEqual(ours.left, expectedLeft);
  for (const secret of ['Synthetic', 'base64', 'GPS', 'Demo villa']) {
    assert.ok(!run.stdout.includes(secret) && !run.stderr.includes(secret), secret);
  }
  const everywhere = backfill();
  assert.equal(everywhere.status, 0, everywhere.stderr);
  workspaceReport(everywhere.report, workspace);
  workspaceReport(everywhere.report, otherWorkspace);
  assert.equal(snapshot(ids), before, 'no record changed');
  assert.equal(movedFiles(workspace), 0, 'nothing was stored');
});

test('--apply moves inline files into storage, cleaned, served by the record route', async () => {
  const before = payload(villa.id);
  const [otherBefore, hugeBefore] = [snapshot([other.id]), snapshot([huge.id])];
  const run = backfill('--workspace', workspace, '--apply');
  assert.equal(run.status, 0, run.stderr);
  const ours = workspaceReport(run.report, workspace);
  assert.deepEqual([run.report.mode, ours.records, ours.entries], ['apply', 1, 2]);
  assert.deepEqual([ours.changed_meanwhile, ours.failed, ours.left], [[], [], expectedLeft]);
  assert.equal(version(villa.id), villa.version + 1, 'one version step');
  const after = payload(villa.id);
  const [photo, labelled, unsupported] = after.media_photos;
  const [floorplan] = after.media_floorplans;
  assert.deepEqual(Object.keys(photo).sort(), ['added', 'file', 'name', 'type']);
  assert.deepEqual(
    [photo.name, photo.type, photo.added],
    ['Synthetic front.jpg', 'image/jpeg', '2026-01-02'],
  );
  assert.deepEqual(Object.keys(floorplan).sort(), ['file', 'name', 'type']);
  assert.deepEqual([floorplan.name, floorplan.type], ['Synthetic plan.pdf', 'application/pdf']);
  assert.deepEqual([labelled, unsupported], [demo, animation], 'left exactly as they were');
  const rest = (value) => ({ ...value, media_photos: null, media_floorplans: null });
  assert.deepEqual(rest(after), rest(before), 'only the media fields changed');
  const image = await recordFile(admin, workspace, villa.id, photo.file);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  const text = image.bytes.toString('latin1');
  assert.ok(!text.includes('Exif') && !text.includes('GPS'), 'photo metadata removed');
  const document = await recordFile(admin, workspace, villa.id, floorplan.file);
  assert.equal(document.status, 200);
  assert.match(document.headers.get('content-disposition'), /^attachment/);
  assert.deepEqual(document.bytes, pdf());
  assert.equal(movedFiles(workspace), 2);
  assert.equal(snapshot([other.id]), otherBefore, 'another company is untouched');
  assert.equal(snapshot([huge.id]), hugeBefore, 'the oversized photo stays inline');
});

test('a second run changes nothing, and a member can still save the record', async () => {
  const before = snapshot(ids);
  const run = backfill('--workspace', workspace, '--apply');
  assert.equal(run.status, 0, run.stderr);
  const ours = workspaceReport(run.report, workspace);
  assert.deepEqual([ours.records, ours.entries, ours.bytes], [0, 0, 0]);
  assert.deepEqual(ours.left, expectedLeft, 'still reported, still inline');
  assert.equal(snapshot(ids), before);
  assert.equal(movedFiles(workspace), 2);
  const record = payload(villa.id);
  const saved = await admin.request(`${recordsPath}/${villa.id}`, {
    method: 'PATCH',
    body: { version: version(villa.id), record },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const file = record.media_photos[0].file;
  assert.equal((await recordFile(admin, workspace, villa.id, file)).status, 200);
});

test('bad options and unknown workspaces are refused before any change', () => {
  const unknown = backfill('--force');
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Usage: media-backfill/);
  const missing = backfill('--workspace', 'no-such-workspace-for-backfill');
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No workspace has the ID/);
});
