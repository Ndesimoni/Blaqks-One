import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MESSAGE,
  clientName,
  fillIn,
  insertReply,
  leftFillIns,
  safeName,
  searchReplies,
} from '../../src/features/server/inbox/saved/savedRepliesModel.js';

const values = { clientName: 'Mariam', myName: 'Aidah', company: 'Keys with Simoni' };

test('fill-ins are replaced in one pass, ignoring case, and empty ones stay as typed', () => {
  assert.equal(
    fillIn('Hi {Client Name}, {my name} from {COMPANY}.', values),
    'Hi Mariam, Aidah from Keys with Simoni.',
  );
  // A value is never read again as a fill-in or a replacement pattern.
  assert.equal(fillIn('{client name}', { clientName: '{company} $& $1' }), '{company} $& $1');
  assert.equal(fillIn('Hi {client name}', { ...values, clientName: '' }), 'Hi {client name}');
  assert.deepEqual(leftFillIns('Hi {client name}, {Client name}'), [
    '{client name}',
    '{Client name}',
  ]);
});

test('client names lose hidden marks and are left out when they look unsafe', () => {
  assert.equal(safeName('  Ali\u202e  Hassan\n'), 'Ali Hassan');
  assert.equal(safeName('x'.repeat(80)).length, 60);
  assert.equal(safeName('Ali' + '\u2028' + 'Hassan' + '\u{e0041}'), 'Ali Hassan');
  for (const unsafe of [
    'ali@bank.test',
    'Pay www.bank.test',
    'IBAN AE070331234567',
    'https://x',
    'Call +971 50 123 4567',
    'pay-now.com/x',
  ]) {
    assert.equal(safeName(unsafe), '', unsafe);
  }
  assert.equal(
    clientName({ record: { name: 'Mariam Saeed' }, contact: { name: 'M' } }),
    'Mariam Saeed',
  );
  assert.equal(clientName({ record: { unavailable: true }, contact: { name: 'Omar' } }), 'Omar');
});

test('a reply replaces an empty box or goes in at the cursor on its own line', () => {
  assert.deepEqual(insertReply('  ', 'Hello'), { text: 'Hello', caret: 5 });
  assert.deepEqual(insertReply('Hi', 'Thanks'), { text: 'Hi\nThanks', caret: 9 });
  assert.deepEqual(insertReply('Hi\n', 'Thanks'), { text: 'Hi\nThanks', caret: 9 });
  assert.deepEqual(insertReply('Hi there', 'X', 3, 8), { text: 'Hi \nX', caret: 5 });
  assert.equal(insertReply('a', 'b'.repeat(MAX_MESSAGE)), null);
});

test('search matches every word in the title or the text', () => {
  const replies = [
    { title: 'Viewing', body: 'Your viewing is confirmed' },
    { title: 'Price list', body: 'Prices for Dubai Marina' },
  ];
  assert.deepEqual(
    searchReplies(replies, ' marina PRICES ').map((r) => r.title),
    ['Price list'],
  );
  assert.equal(searchReplies(replies, '').length, 2);
});
