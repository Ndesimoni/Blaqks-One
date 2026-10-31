import assert from 'node:assert/strict';
import test from 'node:test';
import { routeName, routePath } from '../../src/config/routes.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { connectedGroups, navIcons } from '../../src/features/server/connectedNav.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';
import { createCrmClient } from '../../src/services/crm/client.js';

const response = (status, json) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
});
const personal = (user) => connectedGroups(user).find((group) => group.key === 'personal').items;

test('My WhatsApp is for the Admin and staff with the WhatsApp grant, never the Super Admin', () => {
  const staff = { roleId: 'staff', permissions: {} };
  assert.equal(canOpenSection({ roleId: 'admin', permissions: {} }, 'My WhatsApp'), true);
  assert.equal(
    canOpenSection({ ...staff, channelAccess: { whatsapp: true } }, 'My WhatsApp'),
    true,
  );
  assert.equal(canOpenSection({ ...staff, channelAccess: { email: true } }, 'My WhatsApp'), false);
  assert.equal(canOpenSection(staff, 'My WhatsApp'), false);
  assert.equal(canOpenSection({ roleId: 'super-admin', permissions: {} }, 'My WhatsApp'), false);
  assert.deepEqual(personal({ ...staff, channelAccess: { whatsapp: true } }), [
    'My profile',
    'My WhatsApp',
    'Team activity',
  ]);
  assert.ok(personal({ roleId: 'admin', permissions: {} }).includes('My WhatsApp'));
  assert.ok(!personal({ roleId: 'super-admin', permissions: {} }).includes('My WhatsApp'));
  assert.equal(navIcons['My WhatsApp'], 'smartphone');
  assert.equal(isConnectedSection('My WhatsApp'), true);
  assert.equal(routePath('My WhatsApp'), '/my-whatsapp');
  assert.equal(routeName('/my-whatsapp'), 'My WhatsApp');
});

test('WhatsApp number calls use scoped, encoded paths and CSRF on every change', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/auth/login')
      ? response(200, { user: { id: 'member-a' }, csrfToken: 'anti-forgery' })
      : response(200, {});
  });
  await api.login('admin@example.test', 'synthetic password');
  await api.whatsappNumbers('ws/1');
  await api.whatsappSenders('ws/1');
  await api.giveWhatsappNumber('ws/1', 'member-b', '+999500000001');
  await api.disconnectWhatsappNumber('ws/1', { id: 'n 1', version: 3 });
  const [, list, senders, give, off] = calls;
  const base = '/api/crm/workspaces/ws%2F1/whatsapp-numbers';
  assert.equal(list.url, base);
  assert.equal(list.options.method, 'GET');
  assert.equal(senders.url, `${base}/senders`);
  assert.equal(give.url, base);
  assert.equal(give.options.method, 'POST');
  assert.deepEqual(JSON.parse(give.options.body), {
    memberId: 'member-b',
    phone: '+999500000001',
  });
  assert.equal(off.url, `${base}/n%201/disconnect`);
  assert.equal(off.options.method, 'POST');
  assert.deepEqual(JSON.parse(off.options.body), { version: 3 });
  for (const read of [list, senders]) assert.equal(read.options.headers['X-CSRF-Token'], undefined);
  for (const change of [give, off])
    assert.equal(change.options.headers['X-CSRF-Token'], 'anti-forgery');
});
