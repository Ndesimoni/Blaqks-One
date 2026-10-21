import assert from 'node:assert/strict';
import test from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import { clientWith, settled, startMessage } from './mailbox-send-helpers.mjs';
import { conversationsOf, inbound, mailCompany, mailFields } from './sendgrid-inbound-helpers.mjs';
import { connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const read = async (session, id) =>
  (await session.request(`/workspaces/${session.user.workspaceId}/inbox/conversations/${id}`))
    .value;

// Packet E3c: incoming company mail through SendGrid Inbound Parse (design §6).
test('replies join their thread once, and new mail is routed by its address', async () => {
  const domain = 'e3c-mail.example.test';
  const { admin, agent } = await mailCompany('sendgrid-inbound-admin', domain);
  const workspace = admin.user.workspaceId;
  // The Channels list and My mailbox report what is set up (E3d).
  const listed = (await admin.request(channelPath(admin))).value.channels;
  const company = listed.find((row) => row.provider === 'sendgrid');
  assert.deepEqual([company.deliveryUpdates, company.incomingMail], [true, true]);
  const mine = (await agent.request(`/workspaces/${workspace}/mailbox`)).value.companyEmail;
  assert.deepEqual(mine, {
    connected: true,
    address: `agent@${domain}`,
    displayName: 'Synthetic Agent',
  });
  const started = await startMessage(admin, await clientWith(admin, 'reply.client@gmail.test'));
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const answer = mailFields({
    from: 'Reply Client <reply.client@gmail.test>',
    to: [`owner@${domain}`],
    subject: 'Re: Your viewing',
    text: 'Yes, Saturday works.',
    headers: `Message-ID: <r1@gmail.test>\r\nIn-Reply-To: <${message.id}@${domain}>`,
  });
  const posted = await inbound(domain, answer, { attachments: 1 });
  assert.equal(posted.status, 200);
  assert.deepEqual([posted.input.send_raw, posted.input.spam_check], [false, true]);
  assert.equal((await inbound(domain, answer)).status, 200, 'a repeat adds nothing');
  const thread = await read(admin, conversationId);
  const received = thread.messages.filter((item) => item.direction === 'inbound');
  assert.equal(received.length, 1);
  assert.equal(received[0].body, 'Yes, Saturday works.');
  assert.equal(received[0].hasMedia, true);
  // An unverified reply still joins its known thread, flagged.
  const unsigned = mailFields({
    from: 'reply.client@gmail.test',
    to: [`owner@${domain}`],
    text: 'Also Sunday?',
    headers: `Message-ID: <r2@gmail.test>\r\nReferences: <${message.id}@${domain}> <r1@gmail.test>`,
    dkim: '{@gmail.test : fail}',
    SPF: 'fail',
  });
  assert.equal((await inbound(domain, unsigned)).status, 200);
  const later = (await read(admin, conversationId)).messages.at(-1);
  assert.deepEqual([later.body, later.senderUnverified], ['Also Sunday?', true]);
  // New verified mail goes to the member whose address it was sent to, else Unassigned.
  const toAgent = mailFields({ from: 'buyer@mail.test', to: [`agent@${domain}`] });
  await inbound(domain, { ...toAgent, headers: 'Message-ID: <n1@mail.test>' });
  assert.equal(conversationsOf(workspace, 'buyer@mail.test'), `1|${agent.user.id}|new`);
  const toInfo = mailFields({ from: 'seller@mail.test', to: [`sales@${domain}`] });
  await inbound(domain, { ...toInfo, headers: 'Message-ID: <n2@mail.test>' });
  assert.equal(conversationsOf(workspace, 'seller@mail.test'), '1|-|new');
});

test('unverified, spam, reports, own mail and forged posts never open a thread', async () => {
  const domain = 'e3c-refuse.example.test';
  const { admin, connection } = await mailCompany('sendgrid-refuse-admin', domain);
  const workspace = admin.user.workspaceId;
  const base = { to: [`owner@${domain}`] };
  const cases = [
    mailFields({ ...base, from: 'client@gmail.test', dkim: '{@evil.test : pass}', SPF: 'none' }),
    mailFields({ ...base, from: 'spammy@mail.test', spam_score: '9.5' }),
    mailFields({ ...base, from: 'MAILER-DAEMON@mx.test' }),
    mailFields({ ...base, from: `agent@${domain}` }),
    mailFields({ from: 'elsewhere@mail.test', to: ['owner@other.example.test'] }),
  ];
  for (const fields of cases) assert.equal((await inbound(domain, fields)).status, 200);
  const opened = query(
    `SELECT count(*) FROM inbox.crm_inbox_conversations WHERE workspace_id='${workspace}'`,
  );
  assert.equal(opened, '0');
  const good = mailFields({ ...base, from: 'real@mail.test' });
  assert.equal((await inbound(domain, good, { signWith: 'other' })).status, 401);
  const stale = Math.floor(Date.now() / 1000) - 600;
  assert.equal((await inbound(domain, good, { timestamp: stale })).status, 401);
  assert.equal(conversationsOf(workspace, 'real@mail.test'), '0|-|-');
  // An existing Parse setting for a domain is never taken over (review L7).
  const preset = 'e3c-preset.example.test';
  await fetch(`${process.env.CRM_TEST_SENDGRID}/test/parse-preset?domain=${preset}`, {
    method: 'POST',
  });
  const other = await connectSendgrid(await freshAdmin('sendgrid-preset-admin'), preset);
  assert.deepEqual([other.status, other.value.incomingMail], [201, false]);
  // Disconnect removes the Parse setting at SendGrid and forgets its key.
  const off = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: connection.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal((await inbound(domain, good)).error, 'no parse setting');
});

test('one signed domain cannot crowd out real mail, and known clients always get through', async () => {
  const domain = 'e3c-budget.example.test';
  const { admin } = await mailCompany('sendgrid-budget-admin', domain);
  const workspace = admin.user.workspaceId;
  const flood = (n) => mailFields({ from: `sender${n}@flood.test`, to: [`owner@${domain}`] });
  for (let n = 0; n < 26; n += 1) {
    const fields = { ...flood(n), headers: `Message-ID: <f${n}@flood.test>` };
    assert.equal((await inbound(domain, fields)).status, 200);
  }
  const opened = query(`SELECT count(*) FROM inbox.crm_inbox_conversations
    WHERE workspace_id='${workspace}' AND contact_key LIKE '%@flood.test'`);
  assert.equal(opened, '25', 'at most 25 new threads a day from one sender domain');
  // A Client of the company is never held back by the budget, but must still be verified.
  await clientWith(admin, 'known@flood.test');
  const known = mailFields({ from: 'known@flood.test', to: [`owner@${domain}`] });
  await inbound(domain, { ...known, headers: 'Message-ID: <k1@flood.test>' });
  assert.equal(conversationsOf(workspace, 'known@flood.test').split('|')[0], '1');
  await clientWith(admin, 'linked@mail.test');
  const forged = mailFields({ from: 'linked@mail.test', to: [`owner@${domain}`], dkim: '{}' });
  await inbound(domain, { ...forged, SPF: 'fail', headers: 'Message-ID: <x1@mail.test>' });
  assert.equal(conversationsOf(workspace, 'linked@mail.test'), '0|-|-');
});
