import assert from 'node:assert/strict';
import { test } from 'node:test';
import { login, query } from './helpers.mjs';
import { jpegWithGps, upload } from './media-helpers.mjs';
import { runSample, sampleAdmin, seed, visible } from './sample-helpers.mjs';

// Packet F2 review (L1): clearing sample data also releases photos added to sample properties.
test('clear-sample hides the stored photos of the sample records it removes', async () => {
  const { admin, email, workspace } = await sampleAdmin('sample-media-admin');
  seed(email);
  const uploaded = await upload(admin, jpegWithGps(), 'sample-front.jpg');
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.value));
  const file = uploaded.value.media.id;
  const { records } = await visible(admin, workspace);
  const [property] = records.Properties;
  const patched = await admin.request(
    `/workspaces/${workspace}/records/Properties/${property.id}`,
    {
      method: 'PATCH',
      body: {
        version: property.version,
        record: { ...property.record, media_photos: [{ name: 'sample-front.jpg', file }] },
      },
    },
  );
  assert.equal(patched.status, 200, JSON.stringify(patched.value));
  const other = await login('admin-b');
  const otherUpload = await upload(other, jpegWithGps(), 'other-workspace.jpg');
  assert.equal(otherUpload.status, 201, JSON.stringify(otherUpload.value));
  const otherFile = otherUpload.value.media.id;
  query(
    `UPDATE media.crm_media_objects SET owner_kind='record', owner_id='${property.id}',
     attached_at=now() WHERE id='${otherFile}'`,
  );
  const hidden = () =>
    query(`SELECT deleted_at IS NOT NULL FROM media.crm_media_objects WHERE id='${file}'`);
  assert.equal(hidden(), 'f');
  const cleared = runSample('clear-sample', { email, args: ['--include-edited'] });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.equal(hidden(), 't');
  assert.equal(
    query(`SELECT deleted_at IS NOT NULL FROM media.crm_media_objects WHERE id='${otherFile}'`),
    'f',
    'a repeated record ID in another workspace stays visible',
  );
});
