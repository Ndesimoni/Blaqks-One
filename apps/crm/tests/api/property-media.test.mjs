import assert from 'node:assert/strict';
import test from 'node:test';
import { api, create, login, recordsPath } from './helpers.mjs';
import { jpegWithGps, pdf, upload } from './media-helpers.mjs';

// Packet F2: property photos and floor plans as private stored files.
const admin = await login('admin-a');

const fileUrl = (session, id, file) =>
  `${api}/workspaces/${session.user.workspaceId}/records/Properties/${id}/files/${file}`;
const fetchFile = async (session, id, file) =>
  (await fetch(fileUrl(session, id, file), { headers: { Cookie: session.cookie } })).status;
const stored = async (session, name, bytes = jpegWithGps()) =>
  (await upload(session, bytes, name)).value.media.id;

test('a property keeps its photos and floor plans as protected stored files', async () => {
  const [photo, thumb, plan] = [
    await stored(admin, 'front.jpg'),
    await stored(admin, 'front-small.jpg'),
    await stored(admin, 'plan.pdf', pdf()),
  ];
  const property = await create(admin, 'Properties', {
    listing_title: 'Synthetic stored-photo villa',
    media_photos: [{ name: 'front.jpg', type: 'image/jpeg', file: photo, thumb }],
    media_floorplans: [{ name: 'plan.pdf', type: 'application/pdf', file: plan }],
  });
  for (const file of [photo, thumb, plan]) {
    assert.equal(await fetchFile(admin, property.id, file), 200);
  }
  const other = await login('admin-b');
  assert.ok([403, 404].includes(await fetchFile(other, property.id, photo)));
  const unrelated = await stored(admin, 'not-attached.jpg');
  assert.equal(await fetchFile(admin, property.id, unrelated), 404, 'only its own files');
  const update = await admin.request(recordsPath(admin, 'Properties', property.id), {
    method: 'PATCH',
    body: {
      version: property.version,
      record: { ...property.record, media_photos: [], media_floorplans: [] },
    },
  });
  assert.equal(update.status, 200, JSON.stringify(update.value));
  assert.equal(await fetchFile(admin, property.id, photo), 404, 'removed photos are gone');
});

test('a property cannot take files someone else uploaded', async () => {
  const other = await login('admin-b');
  const theirs = await stored(other, 'theirs.jpg');
  const response = await admin.request(recordsPath(admin, 'Properties'), {
    method: 'POST',
    body: {
      record: { listing_title: 'Borrowed', media_photos: [{ name: 'x.jpg', file: theirs }] },
    },
  });
  assert.equal(response.status, 400);
  const forged = await admin.request(recordsPath(admin, 'Properties'), {
    method: 'POST',
    body: {
      record: { listing_title: 'Odd', media_photos: [{ name: 'x', file: theirs, url: 'x' }] },
    },
  });
  assert.equal(forged.status, 400);
});

test('deleting a property removes its files; inline photos still work', async () => {
  const photo = await stored(admin, 'gone.jpg');
  const property = await create(admin, 'Properties', {
    listing_title: 'Synthetic short-lived listing',
    media_photos: [{ name: 'gone.jpg', file: photo }],
  });
  const removed = await admin.request(recordsPath(admin, 'Properties', property.id), {
    method: 'DELETE',
    body: { version: property.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.equal(await fetchFile(admin, property.id, photo), 404);
  const inline = await create(admin, 'Properties', {
    listing_title: 'Synthetic inline listing',
    media_photos: [{ name: 'old.jpg', src: 'data:image/jpeg;base64,AAA=' }],
  });
  assert.equal(inline.record.media_photos[0].src, 'data:image/jpeg;base64,AAA=');
});
