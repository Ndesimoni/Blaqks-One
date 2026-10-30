import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendRecipient,
  createMessageDraft,
  createMessagePreview,
  hasMessagingAccess,
  MAX_RECIPIENTS,
  MAX_RECIPIENT_TEXT,
  parseRecipients,
  removeRecipient,
  validateAudience,
} from '../../src/features/messaging/model.js';
import {
  filterRecipientDirectory,
  recipientDirectory,
} from '../../src/features/messaging/recipients.js';

const user = {
  id: 'aidah',
  email: 'aidah@example.test',
  channelAccess: { email: true, whatsapp: true },
};
const draft = {
  channel: 'email',
  emailRecipients: 'first@example.test',
  whatsappRecipients: '+971501234567',
  subject: 'Viewing details',
  body: 'Please confirm your viewing.',
};

test('email recipient parsing accepts common separators and deduplicates normalized addresses', () => {
  const raw =
    'FIRST@example.test,second@example.test;\nfirst@example.test\r\n Third@example.test ; ';
  const parsed = parseRecipients(raw, 'email');
  assert.deepEqual(parsed.recipients, [
    'first@example.test',
    'second@example.test',
    'third@example.test',
  ]);
  assert.equal(parsed.duplicateCount, 1);
  assert.deepEqual(parsed.invalid, []);
  assert.equal(raw.includes('FIRST'), true);
});

test('WhatsApp recipient parsing keeps formatting spaces and requires a country code for each number', () => {
  const parsed = parseRecipients(
    '+971 (50) 123-4567;00971501234567\n+44 7700 900123,0509876543',
    'whatsapp',
  );
  assert.deepEqual(parsed.recipients, ['+971501234567', '+447700900123']);
  assert.equal(parsed.duplicateCount, 1);
  assert.deepEqual(parsed.invalid, ['0509876543']);
  assert.ok(
    validateAudience({ ...draft, channel: 'whatsapp', whatsappRecipients: '0509876543' }, user)
      .whatsappRecipients,
  );
});

test('invalid, empty and over-limit lists cannot produce a partially delivered preview', () => {
  for (const raw of [
    '',
    'valid@example.test, invalid',
    '<script>@example.test\ninvalid email',
    Array.from({ length: MAX_RECIPIENTS + 1 }, (_, index) => `client-${index}@example.test`).join(
      '\n',
    ),
  ]) {
    assert.ok(validateAudience({ ...draft, emailRecipients: raw }, user).emailRecipients);
    assert.throws(
      () => createMessagePreview({ ...draft, emailRecipients: raw }, user),
      (error) => Boolean(error.fields.emailRecipients),
    );
  }
  assert.equal(parseRecipients('x'.repeat(MAX_RECIPIENT_TEXT + 1), 'email').tooLong, true);
  const exact = Array.from(
    { length: MAX_RECIPIENTS },
    (_, index) => `client-${index}@example.test`,
  ).join('\n');
  assert.equal(
    createMessagePreview({ ...draft, emailRecipients: exact }, user).recipients.length,
    MAX_RECIPIENTS,
  );
});

test('saved-client additions avoid duplicates without silently replacing invalid typed recipients', () => {
  assert.equal(
    appendRecipient('first@example.test', 'FIRST@example.test', 'email'),
    'first@example.test',
  );
  assert.equal(
    appendRecipient('invalid', 'second@example.test', 'email'),
    'invalid\nsecond@example.test',
  );
  assert.equal(appendRecipient('first@example.test', 'invalid', 'email'), 'first@example.test');
  assert.equal(
    appendRecipient('+971 50 123 4567', '00971501234567', 'whatsapp'),
    '+971 50 123 4567',
  );
});

test('removing a recipient chip removes every normalized copy but preserves other and invalid manual entries', () => {
  const raw = 'FIRST@example.test; invalid entry,second@example.test\nfirst@example.test';
  assert.equal(
    removeRecipient(raw, 'first@example.test', 'email'),
    'invalid entry\nsecond@example.test',
  );
  assert.equal(removeRecipient(raw, 'invalid', 'email'), raw);
  assert.equal(
    removeRecipient(
      '+971 (50) 123-4567;00971501234567\n0509876543,+44 7700 900123',
      '+971501234567',
      'whatsapp',
    ),
    '0509876543\n+44 7700 900123',
  );
});

test('saved recipient categories follow shared client/lead profiles and existing Contacts types without duplicate delivery identities', () => {
  const clients = [
    {
      client_id: 'CL-1',
      full_name: 'Maya Client',
      email: 'MAYA@example.test',
      phone: '+971 50 123 4567',
    },
  ];
  const contacts = [
    {
      contact_id: 'CT-1',
      full_name: 'Maya Landlord',
      contact_type: ' landlord ',
      email: 'maya@example.test',
      phone: '00971501234567',
    },
    {
      contact_id: 'CT-2',
      full_name: 'Contact Client',
      contact_type: 'Client',
      email: 'contact@example.test',
      phone: '+447700900123',
    },
    {
      contact_id: 'CT-3',
      full_name: 'Imported Supplier',
      contact_type: 'Supplier',
      email: 'supplier@example.test',
    },
    { contact_id: 'CT-4', full_name: 'Missing Details', contact_type: 'Landlord' },
    {
      contact_id: 'CT-5',
      full_name: 'Invalid Details',
      contact_type: 'Landlord',
      email: 'invalid',
      phone: '0501234567',
    },
  ];
  const before = JSON.stringify({ clients, contacts });
  const directory = recipientDirectory(clients, contacts, 'email');
  assert.equal(directory.length, 5);
  const shared = directory.find((entry) => entry.address === 'maya@example.test');
  assert.deepEqual(shared.categories, ['Clients', 'Leads', 'Landlords']);
  assert.deepEqual(shared.names, ['Maya Client', 'Maya Landlord']);
  assert.equal(filterRecipientDirectory(directory, '', 'Clients').length, 2);
  assert.equal(filterRecipientDirectory(directory, '', 'Leads').length, 1);
  assert.equal(filterRecipientDirectory(directory, '', 'Landlords').length, 3);
  assert.equal(directory.find((entry) => entry.name === 'Missing Details').available, false);
  assert.equal(directory.find((entry) => entry.name === 'Invalid Details').available, false);
  assert.ok(
    filterRecipientDirectory(directory).some((entry) => entry.name === 'Imported Supplier'),
  );
  const phones = recipientDirectory(clients, contacts, 'whatsapp');
  assert.equal(phones.filter((entry) => entry.address === '+971501234567').length, 1);
  assert.equal(phones.find((entry) => entry.name === 'Imported Supplier').available, false);
  assert.equal(JSON.stringify({ clients, contacts }), before);
  assert.deepEqual(recipientDirectory(), []);
});

test('recipient search combines categories with names, email and formatted phone aliases across merged records', () => {
  const directory = recipientDirectory(
    [{ full_name: 'Olivia Carter', email: 'olivia@example.test', phone: '+971 (50) 123-4567' }],
    [
      {
        full_name: 'Olivia Holdings',
        contact_type: 'Landlord',
        email: 'OLIVIA@example.test',
        phone: '00971501234567',
      },
    ],
    'email',
  );
  for (const search of [
    '  CARTER  ',
    'holdings',
    'OLIVIA@EXAMPLE',
    '+971 50 123',
    '00971501234567',
    '501234567',
  ]) {
    assert.equal(filterRecipientDirectory(directory, search, 'Landlords').length, 1);
  }
  assert.deepEqual(filterRecipientDirectory(directory, 'not found', 'Clients'), []);
  assert.deepEqual(filterRecipientDirectory(directory, 'olivia', 'Other contacts'), []);
});

test('client defaults honor channel permission and keep email and WhatsApp audiences independent', () => {
  const client = { email: 'client@example.test', phone: '+971501234567' };
  assert.equal(createMessageDraft(user, client).channel, 'whatsapp');
  assert.equal(createMessageDraft(user, { ...client, phone: '' }).channel, 'email');
  const restricted = { ...user, channelAccess: { email: true, whatsapp: false } };
  const initial = createMessageDraft(restricted, client, 'whatsapp');
  assert.equal(initial.channel, 'email');
  assert.equal(initial.whatsappRecipients, client.phone);
  assert.equal(initial.emailRecipients, client.email);
  const payload = createMessagePreview({ ...draft, channel: 'whatsapp' }, user);
  assert.deepEqual(payload.recipients, ['+971501234567']);
  assert.equal(payload.subject, '');
  assert.equal(draft.subject, 'Viewing details');
});

test('preview completion rechecks permissions and outputs individual messages without claiming delivery', () => {
  assert.equal(hasMessagingAccess(user), true);
  const revoked = { ...user, channelAccess: { email: false, whatsapp: false } };
  assert.equal(hasMessagingAccess(revoked), false);
  assert.throws(
    () => createMessagePreview(draft, revoked),
    (error) => Boolean(error.fields.channel),
  );
  assert.throws(
    () => createMessagePreview({ ...draft, subject: '', body: '' }, user),
    (error) => Boolean(error.fields.subject && error.fields.body),
  );
  const preview = createMessagePreview(
    { ...draft, emailRecipients: 'first@example.test,second@example.test,FIRST@example.test' },
    user,
  );
  assert.deepEqual(preview.recipients, ['first@example.test', 'second@example.test']);
  assert.equal(preview.status, 'preview');
  assert.equal(preview.deliveryMode, 'individual');
  assert.equal(preview.sender, user.email);
  assert.equal('sentAt' in preview, false);
});
