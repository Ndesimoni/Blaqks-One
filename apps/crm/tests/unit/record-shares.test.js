import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/i18n/catalogs/index.js';
import { createTranslator } from '../../src/i18n/translate.js';
import {
  canShareRecord,
  readCandidates,
  readShare,
  readShareList,
  shareLink,
  shareLinkId,
  shareRoute,
  waitingFor,
  whatsAppText,
  whatsAppUrl,
} from '../../src/features/server/shares/shareModel.js';

// Record sharing R1 (docs/record-sharing.md, "R1 API contract").
const ID = '6f1c2a34-8b9d-4e0f-a123-456789abcdef';
const FROM = '11111111-2222-4333-8444-555555555555';
const TO = '99999999-8888-4777-8666-555555555555';
const allowed = { accept: true, decline: true, withdraw: false, stop: false };
const view = (extra = {}) => ({
  ...{ id: ID, collection: 'Properties', label: 'Canal apartment · Business Bay' },
  ...{ from: { id: FROM, name: 'Synthetic Layla' }, to: { id: TO, name: 'Synthetic Omar' } },
  ...{ status: 'pending', createdAt: '2026-10-23T08:00:00.000Z' },
  ...{ expiresAt: '2026-11-06T08:00:00.000Z', decidedAt: null, closedAt: null, allowed },
  ...extra,
});

test('share views are read strictly and frozen', () => {
  const share = readShare(view());
  assert.deepEqual(share, view());
  assert.ok(Object.isFrozen(share) && Object.isFrozen(share.allowed));
  assert.equal(readShare(view({ label: null, status: 'stopped' })).label, null);
  assert.equal(readShare(view({ label: '  ' })).label, null, 'a blank label shows as none');
  assert.equal(readShare(view({ expiresAt: undefined })).expiresAt, null);
  for (const bad of [
    view({ status: 'archived' }),
    view({ collection: 'Deals' }),
    view({ id: 'SHR-1' }),
    view({ from: { id: FROM } }),
    view({ to: { id: 'u-2', name: 'Omar' } }),
    view({ allowed: { accept: true } }),
    view({ label: 'x'.repeat(301) }),
    view({ createdAt: 'yesterday' }),
    null,
  ])
    assert.throws(() => readShare(bad), /invalid sharing information/);
});

test('share lists, candidates and waiting offers', () => {
  const list = readShareList({
    incoming: [
      view(),
      view({ collection: 'Clients', id: TO }),
      view({ id: FROM, status: 'accepted' }),
    ],
    outgoing: [],
  });
  assert.deepEqual(
    waitingFor(list, 'Properties').map((share) => share.id),
    [ID],
    'only pending offers of the page collection the caller can answer',
  );
  assert.deepEqual(waitingFor(null, 'Clients'), []);
  assert.throws(() => readShareList({ incoming: [] }));
  assert.deepEqual(readCandidates({ colleagues: [{ id: TO, name: 'Synthetic Omar' }] }), [
    { id: TO, name: 'Synthetic Omar' },
  ]);
  assert.throws(() => readCandidates({ colleagues: [{ id: TO }] }));
});

test('only the exact share link shape opens a share', () => {
  assert.equal(shareLinkId(`/shares/${ID}`), ID);
  assert.equal(shareRoute(`/shares/${ID}`), 'Shared record');
  for (const path of [
    `/shares/${ID}/`,
    `/shares/${ID}/accept`,
    `/shares/${ID.toUpperCase()}`,
    '/shares/SHR-1',
    `/clients/${ID}`,
    `//shares/${ID}`,
    '',
    undefined,
  ]) {
    assert.equal(shareLinkId(path), null, String(path));
    assert.equal(shareRoute(path), null);
  }
  assert.equal(
    shareLink('https://crm.example.test', ID),
    `https://crm.example.test/#/shares/${ID}`,
  );
  assert.throws(() => shareLink('https://crm.example.test', '../records'));
});

test('the WhatsApp text names only the sender, the type and the link', () => {
  const t = createTranslator('en', catalogs, {});
  const link = shareLink('https://crm.example.test', ID);
  const text = whatsAppText(t, 'Synthetic Layla', 'Properties', link);
  assert.equal(text, `Synthetic Layla shared a property with you in Blaqks One: ${link}`);
  assert.equal(
    whatsAppText(t, 'Synthetic Layla', 'Clients', link),
    `Synthetic Layla shared a lead with you in Blaqks One: ${link}`,
  );
  assert.match(whatsAppText(t, 'Synthetic Layla', 'Contacts', link), /shared a contact with/);
  for (const secret of ['Canal apartment', 'Business Bay', 'AED', 'Omar', '2026'])
    assert.ok(!text.includes(secret), `no ${secret}`);
  assert.throws(() => whatsAppText(t, 'Synthetic Layla', 'Deals', link));
  const url = whatsAppUrl(text);
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(url.slice('https://wa.me/?text='.length)), text);
});

test('only the holder or the company Admin is offered Share', () => {
  const entry = { id: ID, assignee: FROM };
  assert.equal(canShareRecord({ id: FROM, roleId: 'staff' }, entry), true);
  assert.equal(canShareRecord({ id: TO, roleId: 'staff' }, entry), false);
  assert.equal(canShareRecord({ id: TO, roleId: 'admin' }, entry), true);
  assert.equal(canShareRecord({ id: TO, roleId: 'super-admin' }, entry), false);
  assert.equal(canShareRecord({ id: FROM, roleId: 'staff' }, null), false, 'a copy has no entry');
});
