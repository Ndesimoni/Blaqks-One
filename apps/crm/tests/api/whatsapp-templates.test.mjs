import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { login } from './helpers.mjs';
import { revoke } from './whatsapp-helpers.mjs';
import {
  clientWith,
  sendingCompany,
  setTemplates,
  startState,
  templates,
} from './whatsapp-send-helpers.mjs';

// WhatsApp templates (W1b, docs/whatsapp-design.md §8 and §18): read from Twilio on connect,
// on Refresh and daily; only approved text templates reach the composer.
let company;
const path = (session, suffix = '') =>
  `/workspaces/${company.admin.user.workspaceId}/whatsapp-templates${suffix}`;
const refresh = (session, body = {}) =>
  session.request(path(session, '/refresh'), { method: 'POST', body });

before(async () => {
  company = await sendingCompany('wa-templates');
});

test('connecting reads the templates; only approved text templates are offered', async () => {
  assert.equal(company.made.value.templates, 'synced');
  const listed = await templates(company.admin);
  assert.equal(listed.sync, 'ok');
  assert.ok(listed.syncedAt && listed.syncedAt === listed.checkedAt);
  const byName = Object.fromEntries(listed.templates.map((item) => [item.name, item]));
  assert.deepEqual(Object.keys(byName).sort(), ['new_listing', 'price_update', 'viewing_reminder']);
  assert.match(byName.viewing_reminder.id, /^HX[0-9a-f]{32}$/);
  assert.equal(byName.viewing_reminder.variables, 2);
  assert.equal(byName.viewing_reminder.category, 'UTILITY');
  assert.equal(
    byName.viewing_reminder.body,
    'Hello {{1}}, this is a reminder of your viewing on {{2}}.',
  );
  assert.deepEqual(
    ['viewing_reminder', 'new_listing', 'price_update'].map((name) => [
      byName[name].approval,
      byName[name].offered,
    ]),
    [
      ['approved', true],
      ['approved', true],
      ['pending', false],
    ],
  );
  const client = await clientWith(company.agent);
  const offered = (await startState(company.agent, client)).value.templates;
  assert.deepEqual(offered.map((item) => item.name).sort(), ['new_listing', 'viewing_reminder']);
  assert.deepEqual(Object.keys(offered[0]).sort(), [
    'body',
    'category',
    'id',
    'language',
    'name',
    'variables',
  ]);
});

test('only the owning Admin lists or refreshes, and Refresh takes an empty body', async () => {
  const owner = await login('owner');
  const outsider = await login('admin-a');
  for (const session of [company.agent, owner, outsider]) {
    assert.equal((await session.request(path(session))).status, 403);
    assert.equal((await refresh(session)).status, 403);
  }
  assert.equal((await refresh(company.admin, { force: true })).status, 400);
});

test('Refresh replaces the set: a template leaving approved disappears at once', async () => {
  await setTemplates(company.sid, [
    { name: 'viewing_reminder', status: 'paused', category: 'UTILITY', body: 'Hi {{1}}.' },
    { name: 'new_listing', status: 'approved', category: 'MARKETING', body: 'New listing.' },
    { name: 'card_offer', status: 'approved', type: 'twilio/card' },
    { name: 'named_vars', status: 'approved', body: 'Hi {{name}}.' },
    { name: 'follow_up', status: 'approved', category: 'UTILITY', body: 'Hi {{1}}, any news?' },
  ]);
  const refreshed = await refresh(company.admin);
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.value));
  const byName = Object.fromEntries(refreshed.value.templates.map((item) => [item.name, item]));
  assert.equal(byName.price_update, undefined, 'a template Twilio no longer lists is forgotten');
  assert.deepEqual(
    [byName.viewing_reminder.approval, byName.viewing_reminder.offered],
    ['paused', false],
  );
  assert.deepEqual([byName.card_offer.kind, byName.card_offer.offered], ['other', false]);
  assert.equal(byName.named_vars.offered, false);
  assert.equal(byName.follow_up.variables, 1);
  const client = await clientWith(company.agent);
  const offered = (await startState(company.agent, client)).value.templates;
  assert.deepEqual(offered.map((item) => item.name).sort(), ['follow_up', 'new_listing']);
});

test('each company sees only its own account’s templates', async () => {
  const other = await sendingCompany('wa-templates-other');
  const mine = (await templates(company.admin)).templates.map((item) => item.id);
  const theirs = (await templates(other.admin)).templates.map((item) => item.id);
  assert.equal(theirs.length, 3);
  assert.ok(theirs.every((id) => !mine.includes(id)));
});

test('a refused token marks the account for reconnecting and keeps the templates', async () => {
  const before = (await templates(company.admin)).templates.length;
  await revoke(company.sid);
  const refused = await refresh(company.admin);
  assert.equal(refused.status, 400);
  const reconnect =
    "Twilio no longer accepts the company's Auth Token. Reconnect the Twilio account.";
  assert.equal(refused.value.message, reconnect);
  const channels = (await company.admin.request(channelPath(company.admin))).value.channels;
  const twilio = channels.find((item) => item.provider === 'twilio');
  assert.equal(twilio.state, 'reconnect_required');
  assert.equal((await templates(company.admin)).templates.length, before);
});
