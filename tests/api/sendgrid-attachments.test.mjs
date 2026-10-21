import assert from 'node:assert/strict';
import test from 'node:test';
import { api, query } from './helpers.mjs';
import { connectMailbox } from './mailbox-helpers.mjs';
import { clientWith, sendAgain, settled, startMessage } from './mailbox-send-helpers.mjs';
import { jpegWithGps, pdf, upload } from './media-helpers.mjs';
import { addAddress, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const sendgrid = process.env.CRM_TEST_SENDGRID;
const sentTo = async (to) =>
  (await (await fetch(`${sendgrid}/test/state`)).json()).sent.filter((item) => item.to === to);
const uploaded = async (session, bytes, name) => {
  const result = await upload(session, bytes, name);
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.media.id;
};
const fileUrl = (session, conversation, message, file) =>
  `/workspaces/${session.user.workspaceId}/inbox/conversations/${conversation}/messages/${message}/files/${file}`;

// Packet F3a: email attachments through company email (docs/media-storage.md F3 design).
test('files go out with the email, named by their real type, and stay with the message', async () => {
  const admin = await freshAdmin('f3a-send-admin');
  assert.equal((await connectSendgrid(admin, 'f3a-send.example.test')).status, 201);
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  const photo = await uploaded(admin, jpegWithGps(), 'villa.png');
  const plan = await uploaded(admin, pdf(), 'floor plan.html');
  const client = await clientWith(admin, 'files.client@example.test');
  const started = await startMessage(admin, client, { attachments: [photo, plan] });
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const { conversationId, message } = started.value;
  assert.equal(message.attachments.length, 2);
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const [mail] = await sentTo('files.client@example.test');
  const names = mail.mail.attachments.map((file) => `${file.filename}|${file.type}`).sort();
  assert.deepEqual(names, ['floor plan.pdf|application/pdf', 'villa.jpg|image/jpeg']);
  assert.ok(
    Buffer.from(
      mail.mail.attachments.find((file) => file.type === 'application/pdf').content,
      'base64',
    )
      .toString()
      .startsWith('%PDF'),
  );
  // The thread lists them and serves them only to people who may see the conversation.
  const url = fileUrl(admin, conversationId, message.id, plan);
  const served = await fetch(`${api}${url}`, { headers: { Cookie: admin.cookie } });
  assert.equal(served.status, 200);
  assert.match(served.headers.get('content-disposition'), /floor plan\.pdf/);
  const rival = await freshAdmin('f3a-send-rival');
  const foreign = await fetch(
    `${api}${url.replace(admin.user.workspaceId, rival.user.workspaceId)}`,
    {
      headers: { Cookie: rival.cookie },
    },
  );
  assert.equal(foreign.status, 404);
  // Only the author's own fresh uploads, at most 10 and none twice.
  const theirs = await uploaded(rival, pdf(), 'theirs.pdf');
  const refused = [[theirs], [photo], [plan, plan], Array(11).fill(plan)];
  for (const attachments of refused) {
    const result = await admin.request(
      `/workspaces/${admin.user.workspaceId}/inbox/conversations/${conversationId}/messages`,
      { method: 'POST', body: { body: 'More files', attachments } },
    );
    assert.equal(result.status, 400, JSON.stringify(attachments));
  }
});

test('Send again keeps the files, a removed file stops the send, Google refuses files', async () => {
  const admin = await freshAdmin('f3a-again-admin');
  assert.equal((await connectSendgrid(admin, 'f3a-again.example.test')).status, 201);
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  const file = await uploaded(admin, pdf(), 'brochure.pdf');
  const started = await startMessage(admin, await clientWith(admin, 'crash.files@example.test'), {
    attachments: [file],
  });
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'unknown');
  query(`UPDATE media.crm_media_objects SET deleted_at=now() WHERE id='${file}'`);
  const again = await sendAgain(admin, conversationId, message.id);
  assert.equal(again.status, 201, JSON.stringify(again.value));
  const repeat = await settled(admin, conversationId, again.value.message.id);
  assert.deepEqual([repeat.status, repeat.failureReason], ['failed', 'attachment_missing']);
  // A Google mailbox cannot send files yet, and says so before anything is queued.
  const google = await freshAdmin('f3a-google-admin');
  await connectMailbox(google, 'f3a-google@keys-fixture.test');
  const gfile = await uploaded(google, pdf(), 'g.pdf');
  const gstart = await startMessage(google, await clientWith(google, 'g.client@example.test'), {
    attachments: [gfile],
  });
  assert.equal(gstart.status, 409);
  assert.match(gstart.value.message, /company email/);
});
