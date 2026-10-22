import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { inboxTeams, seed } from './inbox-helpers.mjs';
import { clientWith, reply, startMessage } from './mailbox-send-helpers.mjs';
import { addAddress, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const draftPath = (session, conversation, workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/inbox/conversations/${conversation}/draft`;
const save = (session, conversation, body, baseRevision) =>
  session.request(draftPath(session, conversation), {
    method: 'PUT',
    body: { body, baseRevision },
  });
const read = async (session, conversation) =>
  (await session.request(draftPath(session, conversation))).value?.draft;

// Packet N2 (docs/saved-replies-drafts.md): private drafts that a sent reply empties.
test('a draft comes back for its writer, and a sent reply can never return as one', async () => {
  const admin = await freshAdmin('n2-draft-admin');
  assert.equal((await connectSendgrid(admin, 'n2-draft.example.test')).status, 201);
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  const client = await clientWith(admin, 'draft.client@example.test');
  const started = await startMessage(admin, client);
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const id = started.value.conversationId;
  assert.deepEqual(await read(admin, id), { body: null, revision: 0 });
  assert.equal((await save(admin, id, 'Thanks, I will', 0)).value.revision, 1);
  assert.equal((await save(admin, id, 'Older window', 0)).status, 409, 'built on an old one');
  assert.equal((await save(admin, id, 'Thanks, I will call you', 1)).value.revision, 2);
  assert.deepEqual(await read(admin, id), { body: 'Thanks, I will call you', revision: 2 });
  const sent = await reply(admin, id, 'Thanks, I will call you');
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  assert.equal(sent.value.draftRevision, 3);
  // An autosave that was already on its way is refused, so nothing is sent twice (H1).
  assert.equal((await save(admin, id, 'Thanks, I will call you', 2)).status, 409);
  assert.deepEqual(await read(admin, id), { body: null, revision: 3 });
  assert.equal((await save(admin, id, 'Next time', 3)).value.revision, 4);
  assert.equal((await save(admin, id, '   ', 4)).value.revision, 5, 'blank clears it');
  assert.deepEqual(await read(admin, id), { body: null, revision: 5 });
});

test('drafts stay with their writer and with conversations they can see', async () => {
  const { admin, agent, desk, other, workspace } = await inboxTeams('n2-draft-team');
  const shared = seed(workspace, { channel: 'email' });
  assert.equal((await save(admin, shared, 'Admin’s private words', 0)).status, 200);
  assert.deepEqual(await read(desk, shared), { body: null, revision: 0 }, 'not the Admin’s');
  assert.equal((await save(desk, shared, 'Desk’s own', 0)).value.revision, 1);
  assert.equal((await read(admin, shared)).body, 'Admin’s private words');
  // Assigned-only staff cannot see someone else's email conversation, nor its drafts.
  const held = seed(workspace, { channel: 'email', assignee: admin.user.id, state: 'open' });
  assert.equal((await agent.request(draftPath(agent, held))).status, 404);
  assert.equal((await save(agent, held, 'Sneaky', 0)).status, 404);
  assert.notEqual((await other.request(draftPath(other, shared, workspace))).status, 200);
  const owner = await login('owner');
  assert.notEqual((await owner.request(draftPath(owner, shared, workspace))).status, 200);
  for (const body of [
    { body: 'x', baseRevision: -1 },
    { body: 'x'.repeat(20001), baseRevision: 0 },
    { body: 'x', baseRevision: 0, send: true },
    { body: 5, baseRevision: 0 },
  ]) {
    const refused = await admin.request(draftPath(admin, shared), { method: 'PUT', body });
    assert.equal(refused.status, 400, JSON.stringify(body).slice(0, 60));
  }
  // At most 300 live drafts per member: a new one is refused, an existing one still saves.
  query(`WITH c AS (
      INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id,
        external_thread_id,contact_key,contact_display,match_state,state)
      SELECT gen_random_uuid(),'${workspace}','email',gen_random_uuid(),'cap-'||n,
        'cap'||n||'@example.test','cap'||n||'@example.test','unknown','new'
      FROM generate_series(1,300) n RETURNING id)
    INSERT INTO inbox.crm_inbox_drafts (conversation_id,member_id,workspace_id,body)
    SELECT id,'${desk.user.id}','${workspace}','Kept' FROM c`);
  const fresh = seed(workspace, { channel: 'email' });
  const full = await save(desk, fresh, 'One too many', 0);
  assert.deepEqual([full.status, full.value.code], [409, 'conflict']);
  assert.equal((await save(desk, shared, 'Still mine', 1)).value.revision, 2);
});
