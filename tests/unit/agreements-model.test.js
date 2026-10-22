import test from 'node:test';
import assert from 'node:assert/strict';
import { routeName, routePath } from '../../src/config/routes.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';
import {
  allowedActions,
  counterparty,
  direction,
  displayState,
  filterByTab,
  partyOf,
  responder,
  shareFils,
  shareOf,
  stateTone,
  turn,
} from '../../src/features/server/agreements/agreementModel.js';

const agreement = (changes = {}) => ({
  id: 'a1',
  state: 'sent',
  expired: false,
  senderWorkspaceId: 'ws-a',
  senderMemberId: 'm-a',
  recipientWorkspaceId: 'ws-b',
  recipientMemberId: 'm-b',
  parties: {
    sender: { name: 'Synthetic Sender', company: 'Company A' },
    recipient: { name: 'Synthetic Recipient', company: null },
  },
  ...changes,
});

const actions = (changes, authorParty, party) =>
  allowedActions({ agreement: agreement(changes), authorParty, party });

test('a draft is revised and sent by its sender only', () => {
  assert.deepEqual(actions({ state: 'draft' }, 'sender', 'sender'), ['revise', 'send']);
  assert.deepEqual(actions({ state: 'draft' }, 'sender', 'recipient'), []);
  assert.deepEqual(actions({ state: 'draft' }, 'sender', null), []);
});

test('whoever did not write the sent revision answers it; the sender may always revoke', () => {
  assert.deepEqual(actions({}, 'sender', 'recipient'), ['accept', 'decline', 'counter']);
  assert.deepEqual(actions({}, 'sender', 'sender'), ['revoke']);
  // After a counter-offer the sender answers and may still withdraw the agreement.
  assert.deepEqual(actions({}, 'recipient', 'sender'), ['accept', 'decline', 'counter', 'revoke']);
  assert.deepEqual(actions({}, 'recipient', 'recipient'), []);
});

test('an expired offer cannot be answered but its sender can still revoke it', () => {
  assert.deepEqual(actions({ expired: true }, 'sender', 'recipient'), []);
  assert.deepEqual(actions({ expired: true }, 'sender', 'sender'), ['revoke']);
});

test('closed agreements and non-party Admins have no actions', () => {
  for (const state of ['accepted', 'declined', 'revoked', 'completed', 'cancelled'])
    for (const party of ['sender', 'recipient'])
      assert.deepEqual(actions({ state }, 'sender', party), [], `${state} ${party}`);
  assert.deepEqual(actions({}, 'sender', null), []);
  assert.deepEqual(allowedActions({ agreement: null, party: 'sender' }), []);
});

test('direction, tabs, sides and the counterparty follow the caller company', () => {
  const sent = agreement();
  const incoming = agreement({ id: 'a2', senderWorkspaceId: 'ws-c', recipientWorkspaceId: 'ws-a' });
  assert.equal(direction(sent, 'ws-a'), 'sent');
  assert.equal(direction(incoming, 'ws-a'), 'incoming');
  const list = [sent, incoming];
  assert.deepEqual(
    filterByTab(list, 'incoming', 'ws-a').map((row) => row.id),
    ['a2'],
  );
  assert.deepEqual(
    filterByTab(list, 'sent', 'ws-a').map((row) => row.id),
    ['a1'],
  );
  assert.equal(filterByTab(list, 'all', 'ws-a').length, 2);
  assert.equal(counterparty(sent, 'ws-a').name, 'Synthetic Recipient');
  assert.equal(counterparty(sent, 'ws-b').name, 'Synthetic Sender');
  assert.deepEqual(counterparty({}, 'ws-a'), {});
});

test('the named party is matched on both workspace and member', () => {
  const row = agreement();
  assert.equal(partyOf(row, { id: 'm-a', workspaceId: 'ws-a' }), 'sender');
  assert.equal(partyOf(row, { id: 'm-b', workspaceId: 'ws-b' }), 'recipient');
  assert.equal(partyOf(row, { id: 'admin-a', workspaceId: 'ws-a' }), null);
  assert.equal(partyOf(row, { id: 'm-a', workspaceId: 'ws-b' }), null);
});

test('shares, responders, shown states, tones and turns', () => {
  const money = { senderShareBp: 4000, recipientShareBp: 6000 };
  assert.equal(shareOf(money, 'sender'), 4000);
  assert.equal(shareOf(money, 'recipient'), 6000);
  assert.equal(shareOf(undefined, 'sender'), undefined);
  assert.equal(shareFils(5_250_000, 4000), 2_100_000);
  assert.equal(shareFils(1, 5000), 1);
  assert.equal(shareFils(1, 4999), 0);
  assert.equal(shareFils(undefined, 4000), null);
  assert.equal(responder('sender'), 'recipient');
  assert.equal(responder('recipient'), 'sender');
  assert.equal(responder(undefined), 'recipient');
  assert.equal(displayState(agreement(), 'sender'), 'sent');
  assert.equal(displayState(agreement(), 'recipient'), 'countered');
  assert.equal(displayState(agreement({ expired: true }), 'sender'), 'expired');
  assert.equal(displayState(agreement({ state: 'accepted' }), 'sender'), 'accepted');
  assert.equal(stateTone('accepted'), 'green');
  assert.equal(stateTone('countered'), 'amber');
  assert.equal(stateTone('revoked'), 'red');
  assert.equal(stateTone('unknown'), 'slate');
  assert.equal(turn(agreement({ state: 'draft' }), 'sender', 'sender'), 'yourDraft');
  assert.equal(turn(agreement(), 'recipient', 'sender'), 'yourAnswer');
  assert.equal(turn(agreement(), 'sender', 'sender'), 'theirAnswer');
  assert.equal(turn(agreement(), null, 'sender'), 'waiting');
  assert.equal(turn(agreement({ expired: true }), 'recipient', 'sender'), 'expired');
  assert.equal(turn(agreement({ state: 'accepted' }), 'recipient', 'sender'), 'closed');
});

test('every company member opens Agreements; the Super Admin sees no terms', () => {
  assert.equal(routeName(routePath('Agreements')), 'Agreements');
  assert.equal(isConnectedSection('Agreements'), true);
  for (const roleId of ['admin', 'staff'])
    assert.equal(canOpenSection({ roleId, permissions: {} }, 'Agreements'), true, roleId);
  assert.equal(canOpenSection({ roleId: 'super-admin', permissions: {} }, 'Agreements'), false);
});
