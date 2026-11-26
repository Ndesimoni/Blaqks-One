import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { teamMember } from './platform-team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const mine = (session, suffix = '') => `/workspaces/${session.user.workspaceId}/help${suffix}`;
const ask = (session, subject = 'Synthetic sign-in question') =>
  session.request(mine(session), {
    method: 'POST',
    body: { category: 'account', subject, message: 'I cannot reset my password.' },
  });
const answer = (session, id, body) =>
  session.request(`/platform/help/${id}/messages`, { method: 'POST', body: { body } });
const unread = async (session) => (await session.request(mine(session, '/summary'))).value.unread;

// BO1c (docs/blaqks-one-console.md §11): any member asks, only they and the Blaqks One team
// read it, Open → Waiting → Solved, and the member sees unread answers.
test('a member asks, Blaqks One answers, and the member reads and replies', async () => {
  const admin = await login('admin-a');
  const owner = await login('owner');
  const help = async () => (await owner.request('/platform/metrics')).value.inPeriod.help;
  const earlier = await help();
  const opened = await ask(admin);
  assert.equal(opened.status, 201, JSON.stringify(opened.value));
  const { id } = opened.value.request;
  assert.equal(opened.value.request.state, 'open');
  const queue = await owner.request('/platform/help?state=open');
  assert.equal(queue.status, 200);
  const listed = queue.value.requests.find((row) => row.id === id);
  assert.equal(listed.requesterName, admin.user.name);
  assert.equal(listed.company.id, admin.user.workspaceId);
  assert.ok(queue.value.counts.open >= 1);
  const answered = await answer(owner, id, 'Use Sign-in and security to change it.');
  assert.equal(answered.status, 201);
  assert.equal(answered.value.request.state, 'waiting');
  assert.equal(answered.value.request.assigneeId, owner.user.id, 'whoever answers first');
  assert.equal(await unread(admin), 1);
  const thread = await admin.request(mine(admin, `/${id}`));
  assert.equal(thread.value.messages.length, 2);
  assert.equal(thread.value.messages[1].side, 'platform');
  assert.equal(await unread(admin), 0, 'reading marks it read');
  const replied = await admin.request(mine(admin, `/${id}/messages`), {
    method: 'POST',
    body: { body: 'That worked, thank you.' },
  });
  assert.equal(replied.value.request.state, 'open');
  const version = replied.value.request.version;
  const stale = await owner.request(`/platform/help/${id}`, {
    method: 'PATCH',
    body: { version: version - 1, state: 'solved' },
  });
  assert.equal(stale.status, 409);
  const solved = await owner.request(`/platform/help/${id}`, {
    method: 'PATCH',
    body: { version, state: 'solved' },
  });
  assert.equal(solved.value.request.state, 'solved');
  const events = query(
    `SELECT count(*) FROM platform_metrics.crm_platform_events WHERE event LIKE 'help_request_%' ` +
      `AND workspace_id='${admin.user.workspaceId}' AND amount_fils IS NULL`,
  );
  assert.ok(Number(events) >= 3, 'opened, answered and solved are counted');
  const later = await help();
  assert.ok(later.opened > earlier.opened && later.solved >= 1, JSON.stringify(later));
  assert.equal(typeof later.medianFirstAnswerMinutes, 'number', 'the dashboard figures fill in');
});

test('only the requester and the Blaqks One team with Help requests read a request', async () => {
  const admin = await login('admin-a');
  const owner = await login('owner');
  const { id } = (await ask(admin, 'Synthetic private question')).value.request;
  const colleague = await activate(await invite(admin, 'help-colleague'));
  assert.equal((await colleague.request(mine(colleague, `/${id}`))).status, 404, 'same company');
  const other = await login('admin-b');
  assert.equal((await other.request(mine(other, `/${id}`))).status, 404);
  assert.equal((await other.request(`/workspaces/${admin.user.workspaceId}/help`)).status, 403);
  for (const session of [admin, other])
    assert.equal((await session.request('/platform/help')).status, 403);
  const analyst = await teamMember(owner, 'help-analyst', 'analyst');
  assert.equal((await analyst.request('/platform/help')).status, 403);
  const support = await teamMember(owner, 'help-support', 'support');
  assert.equal((await support.request(`/platform/help/${id}`)).status, 200);
  assert.equal((await answer(support, id, 'Looking into it.')).status, 201);
  const viewer = await teamMember(owner, 'help-viewer', 'custom', { help_requests: 'view' });
  assert.equal((await viewer.request(`/platform/help/${id}`)).status, 200);
  assert.equal((await answer(viewer, id, 'Not allowed')).status, 403);
  const row = (await owner.request(`/platform/help/${id}`)).value.request;
  const toAnalyst = await owner.request(`/platform/help/${id}`, {
    method: 'PATCH',
    body: { version: row.version, assigneeId: analyst.user.id },
  });
  assert.equal(toAnalyst.status, 400, 'only people who answer help requests');
  const people = (await owner.request('/platform/help/people')).value.people.map((p) => p.id);
  assert.ok(people.includes(support.user.id) && !people.includes(viewer.user.id));
});
