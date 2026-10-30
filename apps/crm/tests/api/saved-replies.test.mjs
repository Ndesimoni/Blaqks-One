import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { staffMember } from './mailbox-helpers.mjs';
import { freshAdmin } from './sendgrid-helpers.mjs';

const path = (session, workspace = session.user.workspaceId, suffix = '') =>
  `/workspaces/${workspace}/inbox/saved-replies${suffix}`;
const add = (session, scope, title, body = 'Hi {client name}, thanks for your enquiry.') =>
  session.request(path(session), { method: 'POST', body: { scope, title, body } });
const edit = (session, item, changes, workspace) =>
  session.request(path(session, workspace, `/${item.id}`), {
    method: 'PATCH',
    body: { expectedVersion: item.version, title: item.title, body: item.body, ...changes },
  });
const remove = (session, item) =>
  session.request(path(session, undefined, `/${item.id}/remove`), {
    method: 'POST',
    body: { expectedVersion: item.version },
  });
const list = async (session) => (await session.request(path(session))).value;

// Packet N2 (docs/saved-replies-drafts.md): company replies by the Admin, private ones by all.
test('the Admin keeps company replies; every member keeps private ones nobody else sees', async () => {
  const admin = await freshAdmin('n2-saved-admin');
  const agent = await staffMember(admin, 'n2-saved-agent', false);
  const company = await add(admin, 'company', 'Viewing confirmed');
  assert.equal(company.status, 201, JSON.stringify(company.value));
  assert.equal((await add(admin, 'mine', 'My sign-off', 'Regards, {my name}')).status, 201);
  assert.equal((await add(agent, 'company', 'Not mine to add')).status, 403);
  const own = await add(agent, 'mine', 'Viewing confirmed', 'See you at {company}.');
  assert.equal(own.status, 201, 'the same title in another list is fine');
  const seen = await list(agent);
  assert.deepEqual(
    [seen.company.map((item) => item.title), seen.mine.map((item) => item.title)],
    [['Viewing confirmed'], ['Viewing confirmed']],
  );
  assert.equal(seen.mine[0].body, 'See you at {company}.');
  assert.equal(seen.canManageCompany, false);
  const adminView = await list(admin);
  assert.deepEqual(
    adminView.mine.map((item) => item.title),
    ['My sign-off'],
  );
  assert.equal(adminView.canManageCompany, true);
  // A member may use company replies but not change them, and others' private ones do not
  // exist: both read as not found (security review M3).
  const shared = company.value.savedReply;
  assert.equal((await edit(agent, shared, { title: 'Changed' })).status, 404);
  assert.equal((await edit(agent, adminView.mine[0], { title: 'Mine now' })).status, 404);
  assert.equal((await remove(agent, adminView.mine[0])).status, 404);
  const changed = await edit(admin, shared, { body: 'Your viewing is confirmed, {client name}.' });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  assert.equal(changed.value.savedReply.version, 2);
  assert.equal((await edit(admin, shared, { title: 'Old copy' })).status, 409, 'stale version');
  const twin = await add(admin, 'company', 'VIEWING CONFIRMED');
  assert.deepEqual([twin.status, twin.value.code], [409, 'conflict']);
  assert.equal((await remove(admin, changed.value.savedReply)).status, 204);
  assert.deepEqual((await list(agent)).company, []);
});

test('other companies, the Super Admin, bad bodies and full lists are refused', async () => {
  const admin = await freshAdmin('n2-guard-admin');
  const rival = await freshAdmin('n2-guard-rival');
  const item = (await add(admin, 'company', 'Price list')).value.savedReply;
  const theirs = await rival.request(path(rival, admin.user.workspaceId));
  assert.notEqual(theirs.status, 200, 'another company cannot list them');
  assert.equal((await edit(rival, item, { title: 'Taken' })).status, 404);
  const owner = await login('owner');
  assert.notEqual((await owner.request(path(owner, admin.user.workspaceId))).status, 200);
  for (const body of [
    { scope: 'company', title: 'A', body: 'B', ownerUserId: rival.user.id },
    { scope: 'team', title: 'A', body: 'B' },
    { scope: 'mine', title: 'Two\nlines', body: 'B' },
    { scope: 'mine', title: 'A', body: 'x'.repeat(5001) },
  ]) {
    const refused = await admin.request(path(admin), { method: 'POST', body });
    assert.equal(refused.status, 400, JSON.stringify(body));
  }
  query(`INSERT INTO inbox.crm_inbox_saved_replies
      (id,workspace_id,owner_user_id,title,body,created_by,updated_by)
    SELECT gen_random_uuid(),'${admin.user.workspaceId}','${admin.user.id}','Seed '||n,'Text',
      '${admin.user.id}','${admin.user.id}' FROM generate_series(1,100) n`);
  const full = await add(admin, 'mine', 'One too many');
  assert.deepEqual(
    [full.status, full.value.message],
    [409, 'This list is full. Remove a saved reply first.'],
  );
  assert.equal((await add(admin, 'company', 'Company still has room')).status, 201);
});
