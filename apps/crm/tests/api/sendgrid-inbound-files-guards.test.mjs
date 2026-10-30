import assert from 'node:assert/strict';
import test from 'node:test';
import { query } from './helpers.mjs';
import { jpegWithGps, pdf } from './media-helpers.mjs';
import {
  conversationOf,
  filesStored,
  inbound,
  lastMessage,
  mailCompany,
  mailFields,
  mailFile as file,
} from './sendgrid-inbound-helpers.mjs';

const MIB20 = 20 * 1024 * 1024;
const seed = (workspace, admin, count, columns) =>
  query(`INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key,file_name,
      content_type,byte_size,sha256,origin,quota_group,quota_key)
    SELECT gen_random_uuid(),'${workspace}','${admin}',md5(random()::text),'old.pdf',
      'application/pdf',${MIB20},repeat('a',64),${columns} FROM generate_series(1,${count})`);
/** One mail with one file from `from`; answers the stored message once the file settles. */
const mailWith = async (admin, domain, from, headers, bytes) => {
  const fields = mailFields({ from, to: [`owner@${domain}`], headers });
  assert.equal(
    (await inbound(domain, fields, { files: [file('plan.pdf', 'application/pdf', bytes)] })).status,
    200,
  );
  await filesStored(admin.user.workspaceId);
  return lastMessage(admin, conversationOf(admin.user.workspaceId, from));
};

// Packet F3b review L5 (docs/media-storage.md F3b as built).
test('spam replies and unreadable parts keep no files; a client file is never sent on', async () => {
  const domain = 'f3b-guards.example.test';
  const { admin } = await mailCompany('f3b-guards-admin', domain);
  const workspace = admin.user.workspaceId;
  const first = mailFields({
    from: 'guards.client@gmail.test',
    to: [`owner@${domain}`],
    headers: 'Message-ID: <g1@gmail.test>',
  });
  const files = [file('plan.pdf', 'application/pdf', pdf())];
  assert.equal((await inbound(domain, first, { files, broken: 1 })).status, 200);
  await filesStored(workspace);
  const id = conversationOf(workspace, 'guards.client@gmail.test');
  const kept = await lastMessage(admin, id);
  assert.deepEqual([kept.attachments.length, kept.filesNotKept], [1, 1], 'the nameless part');
  const spam = mailFields({
    from: 'guards.client@gmail.test',
    to: [`owner@${domain}`],
    headers: 'Message-ID: <g2@gmail.test>\r\nIn-Reply-To: <g1@gmail.test>',
    spam_score: '9.5',
  });
  const photo = [file('villa.jpg', 'image/jpeg', jpegWithGps())];
  assert.equal((await inbound(domain, spam, { files: photo })).status, 200);
  const flagged = await lastMessage(admin, id);
  assert.notEqual(flagged.id, kept.id, 'the spam reply still reaches the conversation');
  assert.deepEqual([flagged.attachments.length, flagged.filesNotKept], [0, 1]);
  // The Admin owns the kept file, yet it was never their own upload to send.
  const reply = await admin.request(`/workspaces/${workspace}/inbox/conversations/${id}/messages`, {
    method: 'POST',
    body: { body: 'Your plan back', attachments: [kept.attachments[0].id] },
  });
  assert.equal(reply.status, 400, JSON.stringify(reply.value));
});

test('each sender’s daily share and the company’s storage headroom hold', async () => {
  const domain = 'f3b-share.example.test';
  const { admin, connection } = await mailCompany('f3b-share-admin', domain);
  const workspace = admin.user.workspaceId;
  const heavy = 'heavy.client@gmail.test';
  // 100 MB from this sender today, already counted under the company-tied sender key.
  const key = `encode(sha256(convert_to('${workspace}'||E'\\n'||'${heavy}','UTF8')),'hex')`;
  seed(workspace, admin.user.id, 5, `'inbound','${connection.id}',${key}`);
  const plan = (n) => Buffer.concat([pdf(), Buffer.from(`% ${n}\n`)]);
  const refused = await mailWith(admin, domain, heavy, 'Message-ID: <s1@gmail.test>', plan(1));
  assert.deepEqual([refused.attachments.length, refused.filesNotKept], [0, 1]);
  const light = 'light.client@gmail.test';
  const allowed = await mailWith(admin, domain, light, 'Message-ID: <s2@gmail.test>', plan(2));
  assert.deepEqual([allowed.attachments.length, allowed.filesNotKept], [1, 0], 'others still');
  // Company files near 80% of its 5 GB: a client cannot fill the rest.
  seed(workspace, admin.user.id, 205, `'upload',NULL,NULL`);
  const third = 'third.client@gmail.test';
  const full = await mailWith(admin, domain, third, 'Message-ID: <s3@gmail.test>', plan(3));
  assert.deepEqual([full.attachments.length, full.filesNotKept], [0, 1]);
});
