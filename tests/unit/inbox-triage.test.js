import assert from 'node:assert/strict';
import test from 'node:test';
import { draftNotes, linkCandidates } from '../../src/features/server/inbox/triageModel.js';
import {
  addWord,
  isArabic,
  toBody,
  toDraft,
} from '../../src/features/server/inboxRules/useInboxRules.js';

test('lead notes start from the sender’s own first messages', () => {
  const notes = draftNotes([
    { direction: 'inbound', body: ' Is the 2BR in JVC free? ' },
    { direction: 'outbound', body: 'Yes it is.' },
    { direction: 'inbound', body: 'Budget is 95k.' },
    { direction: 'inbound', body: '' },
  ]);
  assert.equal(notes, 'Is the 2BR in JVC free?\nBudget is 95k.');
  assert.equal(draftNotes([{ direction: 'inbound', body: 'x'.repeat(3000) }]).length, 2000);
});

test('link candidates search visible clients and contacts by every word', () => {
  const entries = {
    Clients: [
      {
        id: 'c1',
        record: { client_id: 'CL-1', full_name: 'Omar Siddiqui', phone: '+971500000001' },
      },
    ],
    Contacts: [{ id: 'k1', record: { contact_id: 'CT-1', full_name: 'Omar Building Manager' } }],
  };
  assert.equal(linkCandidates(entries, '').length, 2);
  assert.deepEqual(
    linkCandidates(entries, 'omar 0001').map((row) => [row.collection, row.id]),
    [['Clients', 'c1']],
  );
  assert.deepEqual(
    linkCandidates(entries, 'ct-1').map((row) => row.id),
    ['k1'],
  );
  assert.equal(linkCandidates(entries, 'nobody').length, 0);
});

test('property words go to the right language once, and rules save in the API shape', () => {
  assert.equal(isArabic('شقة'), true);
  assert.equal(isArabic('villa'), false);
  assert.deepEqual(addWord(['villa'], ' Rent '), ['villa', 'rent']);
  assert.deepEqual(addWord(['villa'], 'VILLA'), ['villa']);
  assert.deepEqual(addWord(['villa'], '   '), ['villa']);
  const rules = {
    leadMode: 'suggest',
    autoSources: [],
    wordsEn: ['villa'],
    wordsAr: [],
    version: 3,
  };
  const draft = { ...toDraft(rules), automatic: true };
  assert.equal(toDraft(rules).automatic, false);
  assert.deepEqual(toBody(draft, 3), {
    expectedVersion: 3,
    leadMode: 'suggest',
    autoSources: ['ad', 'listing', 'form', 'portal'],
    wordsEn: ['villa'],
    wordsAr: [],
  });
});
