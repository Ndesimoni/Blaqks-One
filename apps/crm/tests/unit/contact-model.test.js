import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactOptions,
  linkedConversation,
  phoneDigits,
} from '../../src/features/server/inbox/contactModel.js';

// Clearly fictional people, as the connected record entries hold them.
const entries = {
  Clients: [
    {
      id: 'c-1',
      record: {
        client_id: 'CL-1',
        full_name: 'Synthetic Layla',
        phone: '+971 50 000 0101',
        email: 'layla@example.test',
      },
    },
    { id: 'c-2', record: { client_id: 'CL-2', full_name: 'No address', phone: '050 000 0102' } },
  ],
  Contacts: [{ id: 'k-1', record: { contact_id: 'CT-1', full_name: 'Owner', email: 'bad' } }],
};
const admin = { roleId: 'admin' };
const staff = { roleId: 'staff', channelAccess: { email: false, whatsapp: false } };

test('phones become international digits for a call or WhatsApp', () => {
  assert.equal(phoneDigits('+971 50 000 0101'), '971500000101');
  assert.equal(phoneDigits('050 000 0102'), '971500000102');
  assert.equal(phoneDigits('00971500000103'), '971500000103');
  for (const value of ['', null, '12345', 'ask reception']) assert.equal(phoneDigits(value), '');
});

test('a client, a contact or a record about a client offers what the member may use', () => {
  const client = contactOptions({
    module: 'Clients',
    record: { client_id: 'CL-1' },
    entries,
    user: admin,
  });
  assert.deepEqual(
    [client.person.id, client.call, client.email, client.whatsapp],
    ['c-1', '971500000101', true, '971500000101'],
  );
  const log = contactOptions({
    module: 'Interaction log',
    record: { client_id: 'CL-2' },
    entries,
    user: admin,
  });
  assert.deepEqual([log.person.name, log.call, log.email], ['No address', '971500000102', false]);
  const contact = contactOptions({
    module: 'Contacts',
    record: { contact_id: 'CT-1' },
    entries,
    user: admin,
  });
  assert.deepEqual(
    [contact.person.collection, contact.call, contact.email],
    ['Contacts', '', false],
  );
  // Staff without the email or WhatsApp grant may still call.
  const own = contactOptions({
    module: 'Follow-ups',
    record: { client_id: 'CL-1' },
    entries,
    user: staff,
  });
  assert.deepEqual([own.call, own.email, own.whatsapp], ['971500000101', false, '']);
});

test('kept copies, unknown clients and other records offer nothing', () => {
  const none = { person: null, call: '', email: false, whatsapp: '' };
  const keptFor = (collection, record) => record.client_id === 'CL-1';
  assert.deepEqual(
    contactOptions({
      module: 'Clients',
      record: { client_id: 'CL-1' },
      entries,
      keptFor,
      user: admin,
    }),
    none,
  );
  assert.deepEqual(
    contactOptions({ module: 'Viewings', record: { client_id: 'CL-9' }, entries, user: admin }),
    none,
  );
  assert.deepEqual(
    contactOptions({ module: 'Properties', record: { client_id: 'CL-1' }, entries, user: admin }),
    none,
  );
  assert.deepEqual(contactOptions({ module: 'Viewings', record: {}, entries, user: admin }), none);
});

test("Email opens the person's newest linked conversation, never spam", () => {
  const person = { collection: 'Clients', id: 'c-1' };
  const rows = [
    { id: 'spam', state: 'spam', linked: { collection: 'Clients', recordId: 'c-1' } },
    { id: 'other', state: 'open', linked: { collection: 'Clients', recordId: 'c-2' } },
    { id: 'hidden', state: 'open', linked: { collection: 'Clients', recordId: null } },
    { id: 'newest', state: 'resolved', linked: { collection: 'Clients', recordId: 'c-1' } },
    { id: 'older', state: 'open', linked: { collection: 'Clients', recordId: 'c-1' } },
  ];
  assert.equal(linkedConversation(rows, person), 'newest');
  assert.equal(linkedConversation(rows, { collection: 'Contacts', id: 'c-1' }), '');
  assert.equal(linkedConversation(undefined, person), '');
});
