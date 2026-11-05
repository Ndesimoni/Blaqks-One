import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PIPELINE,
  STAGES,
  blankClient,
  changedFields,
  clientBody,
  clientError,
  clientName,
  contactLinks,
  listParams,
  nextStage,
  presetTotal,
  stageTone,
} from '../../src/features/server/platformClients/clientsModel.js';

// BO1e (docs/blaqks-one-console.md §9): Blaqks One's own sales clients, never a company's.

test('stages run New to Customer in order; Lost leaves the pipeline', () => {
  assert.deepEqual(STAGES, ['new', 'contacted', 'demo_booked', 'signed_up', 'customer', 'lost']);
  assert.deepEqual(PIPELINE, STAGES.slice(0, 5));
  assert.equal(nextStage('new'), 'contacted');
  assert.equal(nextStage('contacted'), 'demo_booked');
  assert.equal(nextStage('demo_booked'), 'signed_up');
  assert.equal(nextStage('signed_up'), 'customer');
  for (const stage of ['customer', 'lost', 'unknown', undefined])
    assert.equal(nextStage(stage), null, String(stage));
  assert.equal(stageTone('lost'), 'red');
  assert.equal(stageTone('customer'), 'green');
  assert.equal(stageTone('new'), 'slate');
});

test('a phone opens Call, WhatsApp and Text in the phone apps; an address opens Email', () => {
  const links = contactLinks({ phone: '+971 50 123 4567', email: ' sara@example.test ' });
  assert.deepEqual(links, {
    call: 'tel:+971501234567',
    whatsapp: 'https://wa.me/971501234567',
    email: 'mailto:sara@example.test',
    sms: 'sms:+971501234567',
  });
  // A UAE local number gains 971; 00 is an international prefix.
  assert.equal(contactLinks({ phone: '050 123 4567' }).whatsapp, 'https://wa.me/971501234567');
  assert.equal(contactLinks({ phone: '0044 20 7946 0000' }).call, 'tel:+442079460000');
  const none = contactLinks({ phone: '12345', email: 'not an address' });
  assert.deepEqual(none, { call: '', whatsapp: '', email: '', sms: '' });
  assert.deepEqual(contactLinks(), { call: '', whatsapp: '', email: '', sms: '' });
});

test('the list asks for the chosen stage, search and Assigned filter, else everything', () => {
  assert.deepEqual(listParams(), { stage: 'all', owner: 'all' });
  assert.deepEqual(listParams({ stage: 'demo_booked', query: '  Palm  ', owner: 'me' }), {
    stage: 'demo_booked',
    owner: 'me',
    q: 'Palm',
  });
  assert.deepEqual(listParams({ stage: 'won', owner: 'everyone' }), { stage: 'all', owner: 'all' });
  assert.equal(listParams({ owner: 'unassigned' }, 'next-1').cursor, 'next-1');
  assert.equal(listParams({ query: 'x'.repeat(300) }).q.length, 100);
});

test('the footer total follows the preset: every stage for All clients', () => {
  const counts = { new: 2, contacted: 1, demo_booked: 0, signed_up: 3, customer: 4, lost: 1 };
  assert.equal(presetTotal(counts, 'all'), 11);
  assert.equal(presetTotal(counts, 'signed_up'), 3);
  assert.equal(presetTotal(null, 'all'), null);
});

test('the form needs a name, a way to reach them and the server’s phone form', () => {
  const form = { ...blankClient(), companyName: 'Palm Realty', contactName: 'Sara Khan' };
  assert.equal(clientError(blankClient()), 'error.names');
  assert.equal(clientError(form), 'error.reach');
  assert.equal(clientError({ ...form, phone: '12' }), 'error.phone');
  // The server keeps international numbers only, so a local 05… number is refused here too.
  assert.equal(clientError({ ...form, phone: '050 123 4567' }), 'error.phone');
  assert.equal(clientError({ ...form, companyName: '', phone: '+971 50 123 4567' }), '');
  assert.equal(clientError({ ...form, email: 'sara@' }), 'error.email');
  assert.equal(clientError({ ...form, email: 'sara@palm.test', stage: 'won' }), 'error.choice');
  assert.equal(
    clientError({ ...form, phone: '+971501234567', nextFollowUp: '5 May' }),
    'error.date',
  );
  assert.equal(clientError({ ...form, phone: '+971501234567', nextFollowUp: '2026-11-20' }), '');
  const body = clientBody({ ...form, companyName: ' Palm Realty ', email: 'a@b.test' });
  assert.equal(body.companyName, 'Palm Realty');
  assert.equal(body.nextFollowUp, null);
  assert.equal(body.ownerId, null);
  assert.equal(clientName({ companyName: '', contactName: 'Sara Khan' }), 'Sara Khan');
  assert.equal(clientName(form), 'Palm Realty');
});

test('an edit sends only the fields it changed', () => {
  const saved = {
    ...blankClient(),
    companyName: 'Palm Realty',
    contactName: 'Sara Khan',
    phone: '+971501234567',
    stage: 'contacted',
    ownerId: 'u-1',
    nextFollowUp: '2026-11-20',
    version: 3,
  };
  const form = { ...saved, stage: 'demo_booked', notes: ' Wants a demo ' };
  assert.deepEqual(changedFields(form, saved), { stage: 'demo_booked', notes: 'Wants a demo' });
  assert.deepEqual(changedFields({ ...saved }, saved), {});
  assert.deepEqual(changedFields({ ...saved, ownerId: '' }, saved), { ownerId: null });
});
