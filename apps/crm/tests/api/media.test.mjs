import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { download, jpegWithGps, motionPhoto, pdf, upload } from './media-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

const admin = await login('admin-a');
const chat = (session, suffix = '') => `/workspaces/${session.user.workspaceId}/chat${suffix}`;
const general = async (session) =>
  (await session.request(chat(session))).value.rooms.find((room) => room.name === 'general').id;
const post = (session, room, body) =>
  session.request(chat(session, `/rooms/${room}/messages`), { method: 'POST', body });

test('uploads are typed from their bytes, cleaned and size-limited', async () => {
  const photo = await upload(admin, jpegWithGps(), 'Villa front.jpg');
  assert.equal(photo.status, 201, JSON.stringify(photo.value));
  assert.equal(photo.value.media.contentType, 'image/jpeg');
  assert.equal(photo.value.media.name, 'Villa front.jpg');
  const svg = await upload(
    admin,
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    'x.jpg',
  );
  assert.equal(svg.status, 400);
  const html = await upload(admin, Buffer.from('<html><script>alert(1)</script>'), 'a.pdf');
  assert.equal(html.status, 400);
  const huge = Buffer.concat([jpegWithGps(), Buffer.alloc(11 * 1024 * 1024)]);
  assert.equal((await upload(admin, huge)).status, 400);
  assert.equal((await upload(admin, jpegWithGps(), 'x.jpg', { csrf: false })).status, 403);
});

test('a chat photo reaches the room without its GPS data; other people get nothing', async () => {
  const staff = await activate(await invite(admin, 'media-chat'));
  const room = await general(admin);
  const media = (await upload(admin, jpegWithGps(), 'Viewing.jpg')).value.media;
  const sent = await post(admin, room, { body: 'Photo from the viewing', attachments: [media.id] });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  const message = sent.value.message;
  assert.equal(message.attachments[0].id, media.id);
  const seen = await download(staff, room, message.id, media.id);
  assert.equal(seen.status, 200);
  assert.equal(seen.headers.get('content-type'), 'image/jpeg');
  assert.equal(seen.headers.get('x-content-type-options'), 'nosniff');
  assert.match(seen.headers.get('content-disposition'), /^inline;/);
  assert.ok(!seen.bytes.toString('latin1').includes('GPS'), 'GPS was removed before storage');
  const other = await login('admin-b');
  const foreign = await download(other, room, message.id, media.id);
  assert.ok([403, 404].includes(foreign.status));
  const reused = await post(staff, room, { body: 'Mine now', attachments: [media.id] });
  assert.equal(reused.status, 400, 'files attach only once, by their uploader');
});

test('files in a private conversation stay private; PDFs download', async () => {
  const [first, second] = [
    await activate(await invite(admin, 'media-dm-a')),
    await activate(await invite(admin, 'media-dm-b')),
  ];
  const room = (
    await first.request(chat(first, '/direct'), {
      method: 'POST',
      body: { memberId: second.user.id },
    })
  ).value.room.id;
  const file = (await upload(first, pdf(), 'Offer.pdf')).value.media;
  const sent = (await post(first, room, { body: '', attachments: [file.id] })).value.message;
  assert.equal(sent.body, '');
  const ok = await download(second, room, sent.id, file.id);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-disposition'), /^attachment;/);
  assert.equal((await download(admin, room, sent.id, file.id)).status, 404);
  assert.equal((await post(first, room, { body: '  ' })).status, 400, 'text or a file is needed');
});

test('deleting a message removes its files; unattached uploads are swept', async () => {
  const room = await general(admin);
  const media = (await upload(admin, jpegWithGps())).value.media;
  const sent = (await post(admin, room, { body: 'Wrong photo', attachments: [media.id] })).value
    .message;
  await admin.request(chat(admin, `/rooms/${room}/messages/${sent.id}`), { method: 'DELETE' });
  assert.equal((await download(admin, room, sent.id, media.id)).status, 404);
  const pending = (await upload(admin, jpegWithGps())).value.media;
  query(
    `UPDATE media.crm_media_objects SET created_at=now()-interval '25 hours' WHERE id='${pending.id}'`,
  );
  let removed = '';
  for (let tries = 0; tries < 50 && removed !== '2'; tries += 1) {
    removed = query(
      `SELECT count(*) FROM media.crm_media_objects WHERE id IN ('${pending.id}','${media.id}')
       AND storage_removed_at IS NOT NULL`,
    );
    if (removed !== '2') await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(removed, '2', 'the sweep removed both from storage');
});

test('a motion photo loses its appended picture and its GPS', async () => {
  const room = await general(admin);
  const media = (await upload(admin, motionPhoto(), 'Motion.jpg')).value.media;
  const sent = (await post(admin, room, { body: 'Motion', attachments: [media.id] })).value.message;
  const stored = await download(admin, room, sent.id, media.id);
  const text = stored.bytes.toString('latin1');
  assert.ok(!text.includes('Exif') && !text.includes('GPS'));
  assert.equal(stored.bytes.length, motionPhoto().indexOf(Buffer.from([0xff, 0xd9])) + 2);
});

test('one member cannot fill the company with unsent files', async () => {
  const hoarder = await activate(await invite(admin, 'media-hoarder'));
  const fill = (id) =>
    `INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key,file_name,
       content_type,byte_size,sha256) VALUES (gen_random_uuid(),'${admin.user.workspaceId}',
       '${id}',md5(random()::text),'filler.pdf','application/pdf',20000000,repeat('a',64))`;
  for (let index = 0; index < 11; index += 1) query(fill(hoarder.user.id));
  const blocked = await upload(hoarder, jpegWithGps());
  assert.deepEqual([blocked.status, blocked.value.code], [429, 'media_quota']);
  assert.equal((await upload(admin, jpegWithGps())).status, 201, 'others still upload');
  query(`DELETE FROM media.crm_media_objects WHERE uploaded_by='${hoarder.user.id}'`);
});
