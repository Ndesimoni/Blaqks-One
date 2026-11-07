import assert from 'node:assert/strict';
import test from 'node:test';
import { replyState } from '../../src/features/server/inbox/composerModel.js';
import {
  failureKey,
  refusalKey,
  startRefusalKey,
} from '../../src/features/server/inbox/whatsapp/whatsappCodes.js';
import {
  consentActions,
  consentKey,
  filledText,
  replyMode,
  templateName,
  templateParts,
  templateState,
  variableProblem,
  windowLabel,
} from '../../src/features/server/inbox/whatsapp/whatsappModel.js';

// The WhatsApp composer's rules (W1b, docs/whatsapp-design.md §5 and §18).
test('template values follow WhatsApp’s rules: 1 to 200 characters on one line', () => {
  assert.equal(variableProblem('  Sara  '), '');
  assert.equal(variableProblem('   '), 'empty');
  assert.equal(variableProblem(undefined), 'empty');
  assert.equal(variableProblem('x'.repeat(200)), '');
  assert.equal(variableProblem('x'.repeat(201)), 'long');
  // Characters, not UTF-16 units, as the server counts them.
  assert.equal(variableProblem('😀'.repeat(200)), '');
  for (const value of ['two\nlines', 'a\ttab', 'four    spaces', 'bell\u0007'])
    assert.equal(variableProblem(value), 'breaks', JSON.stringify(value));
  assert.equal(variableProblem('three   spaces'), '');
});

test('a template body splits into text and numbered places, filled in one pass', () => {
  const body = 'Hello {{1}}, your viewing is on {{2}}.';
  assert.deepEqual(templateParts(body), [
    { text: 'Hello ' },
    { variable: 1 },
    { text: ', your viewing is on ' },
    { variable: 2 },
    { text: '.' },
  ]);
  assert.deepEqual(templateParts('No places.'), [{ text: 'No places.' }]);
  assert.deepEqual(templateParts(null), []);
  assert.equal(
    filledText(body, [' Sara ', 'Saturday']),
    'Hello Sara, your viewing is on Saturday.',
  );
  // A typed placeholder is shown as typed, never filled again.
  assert.equal(filledText(body, ['{{2}}', 'Sunday']), 'Hello {{2}}, your viewing is on Sunday.');
  assert.equal(filledText(body, []), 'Hello , your viewing is on .');
});

test('the agreement line names its source, and only the right people may change it', () => {
  assert.equal(
    consentKey({ state: 'opt_in', source: 'client_first' }),
    'consent.agreed_client_first',
  );
  assert.equal(consentKey({ state: 'opt_in', source: 'in_person' }), 'consent.agreed_in_person');
  assert.equal(consentKey({ state: 'opt_in', source: 'later' }), 'consent.agreed');
  assert.equal(
    consentKey({ state: 'opt_out', source: 'recorded_stop' }),
    'consent.stopped_recorded_stop',
  );
  assert.equal(consentKey({ state: 'none', source: null }), 'consent.none');
  assert.equal(consentKey(null), 'consent.none');
  // Assigned-only staff read the state alone, without its source or date.
  assert.equal(consentKey({ state: 'opt_in', source: null, at: null }), 'consent.agreed');
  assert.equal(consentKey({ state: 'opt_out', source: null, at: null }), 'consent.stopped');
  const admin = { roleId: 'admin' };
  const granted = { roleId: 'staff', channelAccess: { whatsapp: true } };
  const plain = { roleId: 'staff', channelAccess: { whatsapp: false } };
  const none = { state: 'none' };
  const stopped = { state: 'opt_out' };
  assert.deepEqual(consentActions(granted, none), { agree: true, stop: true, restore: false });
  assert.deepEqual(consentActions(plain, none), { agree: false, stop: true, restore: false });
  assert.deepEqual(consentActions(granted, { state: 'opt_in' }), {
    agree: false,
    stop: true,
    restore: false,
  });
  assert.deepEqual(consentActions(granted, stopped), { agree: false, stop: false, restore: false });
  assert.deepEqual(consentActions(admin, stopped), { agree: false, stop: false, restore: true });
});

test('the window reads as open until a Dubai time today or tomorrow, else closed', () => {
  const now = new Date('2026-11-06T08:00:00Z'); // 12:00 in Dubai
  assert.deepEqual(windowLabel({ open: true, until: '2026-11-06T18:00:00Z' }, now), {
    key: 'window.openToday',
    at: '2026-11-06T18:00:00Z',
  });
  // 21:00 UTC is already the next day in Dubai.
  assert.equal(
    windowLabel({ open: true, until: '2026-11-06T21:00:00Z' }, now).key,
    'window.openTomorrow',
  );
  assert.equal(windowLabel({ open: false, until: null }, now).key, 'window.closed');
  assert.equal(windowLabel(undefined, now).key, 'window.closed');
});

test('the Reply tab offers free text only in the window, and templates after agreement', () => {
  const open = { canSend: true, canSendText: true };
  assert.equal(replyMode(open), 'text');
  assert.equal(replyMode(open, 'template'), 'template');
  assert.equal(replyMode({ canSend: true, canSendText: false }), 'template');
  assert.equal(replyMode({ canSend: false, canSendText: true }), 'refused');
  const offered = [{ id: 'HX1', name: 'viewing_reminder' }];
  assert.equal(templateState({ state: 'none' }, offered), 'needsAgreement');
  assert.equal(templateState({ state: 'opt_in' }, []), 'noTemplates');
  assert.equal(templateState({ state: 'opt_in' }, offered), 'ready');
  assert.equal(templateName(offered, 'HX1'), 'viewing_reminder');
  assert.equal(templateName(offered, 'HX2'), '');
  assert.equal(templateName(undefined, null), '');
});

test('every server code maps to plain words, and unknown codes to a safe default', () => {
  assert.equal(refusalKey('other_number'), 'refusal.other_number');
  assert.equal(refusalKey('later_code'), 'refusal.unsupported');
  assert.equal(startRefusalKey('no_phone'), 'refusal.no_phone');
  assert.equal(startRefusalKey('conversation_held'), 'refusal.conversation_held');
  assert.equal(startRefusalKey(undefined), 'refusal.no_grant');
  assert.equal(failureKey('not_on_whatsapp'), 'failure.not_on_whatsapp');
  assert.equal(failureKey('outside_window'), 'failure.outside_window');
  assert.equal(failureKey('something_new'), 'failure.whatsapp_refused');
});

test('a WhatsApp conversation the server describes opens the WhatsApp composer', () => {
  const user = { id: 'u1', roleId: 'admin' };
  const conversation = {
    channel: 'whatsapp',
    whatsapp: { canSend: false, refusal: 'unsupported' },
  };
  assert.equal(replyState({ conversation, user, mailbox: null, health: 'off' }), 'whatsapp');
  const older = { channel: 'whatsapp' };
  assert.equal(
    replyState({ conversation: older, user, mailbox: null, health: 'connected' }),
    'comingSoon',
  );
});
