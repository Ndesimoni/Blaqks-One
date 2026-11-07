import assert from 'node:assert/strict';
import test from 'node:test';
import { api, query } from './helpers.mjs';
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

const inboundRows = (workspace) =>
  query(`SELECT count(*) FROM media.crm_media_objects
    WHERE workspace_id='${workspace}' AND origin='inbound'`);

// Packet F3b: files clients email in (docs/media-storage.md F3 design).
test('photos and PDFs are kept privately; others, repeats and duplicates are counted', async () => {
  const domain = 'f3b-keep.example.test';
  const { admin } = await mailCompany('f3b-keep-admin', domain);
  const workspace = admin.user.workspaceId;
  const fields = mailFields({
    from: 'files.client@gmail.test',
    to: [`owner@${domain}`],
    text: 'Here are my documents.',
    headers: 'Message-ID: <files1@gmail.test>',
  });
  const files = [
    file('villa.jpg', 'image/jpeg', jpegWithGps()),
    file('Title deed.html', 'text/html', pdf()),
    file('contract.docx', 'application/msword', Buffer.from('PK\u0003\u0004word')),
    file('copy.pdf', 'application/pdf', pdf()),
  ];
  const posted = await inbound(domain, fields, { files });
  assert.equal(posted.status, 200);
  await filesStored(workspace);
  const id = conversationOf(workspace, 'files.client@gmail.test');
  const message = await lastMessage(admin, id);
  const names = message.attachments.map((item) => item.name).sort();
  assert.deepEqual(names, ['Title deed.pdf', 'villa.jpg'], 'a PDF never keeps a .html name');
  assert.equal(message.filesNotKept, 2, 'the Word file and the duplicate PDF');
  const photo = message.attachments.find((item) => item.name === 'villa.jpg');
  const url = `${api}/workspaces/${workspace}/inbox/conversations/${id}/messages/${message.id}/files/${photo.id}`;
  const served = await fetch(url, { headers: { Cookie: admin.cookie } });
  assert.equal(served.status, 200);
  assert.ok(!Buffer.from(await served.arrayBuffer()).includes('GPS'), 'location removed');
  const stored =
    query(`SELECT string_agg(DISTINCT uploaded_by::text||'|'||storage_pending::text,',')
    FROM media.crm_media_objects WHERE workspace_id='${workspace}' AND origin='inbound'`);
  assert.equal(stored, `${admin.user.id}|false`, 'kept in the company Admin’s name, stored');
  // SendGrid posting the same mail again keeps nothing new.
  assert.equal((await inbound(domain, fields, { files })).status, 200);
  assert.equal(inboundRows(workspace), '2');
});

test('unverified senders keep no files, and the daily and storage limits hold', async () => {
  const domain = 'f3b-limits.example.test';
  const { admin, connection } = await mailCompany('f3b-limits-admin', domain);
  const workspace = admin.user.workspaceId;
  const first = mailFields({
    from: 'limits.client@gmail.test',
    to: [`owner@${domain}`],
    headers: 'Message-ID: <l1@gmail.test>',
  });
  assert.equal((await inbound(domain, first)).status, 200);
  const spoofed = mailFields({
    from: 'limits.client@gmail.test',
    to: [`owner@${domain}`],
    headers: 'Message-ID: <l2@gmail.test>\r\nIn-Reply-To: <l1@gmail.test>',
    dkim: '{@evil.test : pass}',
    SPF: 'fail',
  });
  await inbound(domain, spoofed, { files: [file('invoice.pdf', 'application/pdf', pdf())] });
  const id = conversationOf(workspace, 'limits.client@gmail.test');
  const unverified = await lastMessage(admin, id);
  assert.deepEqual([unverified.attachments.length, unverified.filesNotKept], [0, 1]);
  assert.equal(inboundRows(workspace), '0');
  // 300 files from this connection today: the next one is not kept, the mail still is.
  query(`INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key,file_name,
      content_type,byte_size,sha256,origin,quota_group,quota_key,deleted_at)
    SELECT gen_random_uuid(),'${workspace}','${admin.user.id}',md5(random()::text),'old.pdf',
      'application/pdf',10,repeat('a',64),'inbound','${connection.id}',repeat('b',64),now()
    FROM generate_series(1,300)`);
  const over = mailFields({
    from: 'limits.client@gmail.test',
    to: [`owner@${domain}`],
    headers: 'Message-ID: <l3@gmail.test>\r\nIn-Reply-To: <l1@gmail.test>',
  });
  await inbound(domain, over, { files: [file('plan.pdf', 'application/pdf', pdf())] });
  const limited = await lastMessage(admin, id);
  assert.deepEqual([limited.attachments.length, limited.filesNotKept], [0, 1]);
});
