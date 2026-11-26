import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { allowReferrals } from './agreements-helpers.mjs';
import { login } from './helpers.mjs';
import {
  accepted,
  act,
  command,
  detail,
  ok,
  paidOn,
  payments,
  referralTerms,
  terms,
} from './agreements-a3b-helpers.mjs';

let sender;
let recipient;
before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  await allowReferrals(sender);
});
const record = (session, id, amountFils) =>
  act(session, id, 'payments', { amountFils, paidOn: paidOn() });

test('referral payer records, payee confirms; confirmed entries cannot be withdrawn', async () => {
  const id = await accepted(sender, recipient, {
    kind: 'handover_referral',
    terms: referralTerms(),
  });
  const initial = await payments(sender, id);
  assert.equal(initial.summary.payer, 'recipient');
  assert.equal(initial.summary.dueFils, 2500);
  assert.equal((await record(sender, id, 100)).status, 404);
  assert.equal((await record(recipient, id, 2501)).status, 409);
  assert.equal(
    (await act(recipient, id, 'payments', { amountFils: 100, paidOn: '2999-01-01' })).status,
    400,
  );
  ok(await record(recipient, id, 1500));
  const logged = await payments(sender, id);
  const entry = logged.payments.find((item) => item.action === 'paid');
  assert.ok(entry.id);
  assert.equal(entry.actorId, recipient.user.id);
  assert.equal(logged.summary.paidFils, 1500);
  assert.equal(logged.summary.confirmedFils, 0);
  assert.equal((await act(recipient, id, `payments/${entry.id}/confirm`)).status, 404);
  ok(await act(sender, id, `payments/${entry.id}/confirm`));
  assert.equal((await payments(recipient, id)).summary.confirmedFils, 1500);
  assert.equal((await act(recipient, id, `payments/${entry.id}/withdraw`)).status, 409);
  const lowered = await act(sender, id, 'amend', { terms: referralTerms(4000) });
  if (lowered.status === 200) {
    const proposal = (await detail(recipient, id)).proposal;
    assert.equal(
      (await act(recipient, id, 'amend/accept', { revisionId: proposal.id })).status,
      409,
    );
  } else assert.equal(lowered.status, 409);
});

test('concurrent payments cannot exceed due and a withdrawal frees that amount', async () => {
  const id = await accepted(sender, recipient, {
    kind: 'handover_referral',
    terms: referralTerms(),
  });
  const version = (await detail(recipient, id)).agreement.version;
  const responses = await Promise.all(
    [1, 2].map(() =>
      command(recipient, id, 'payments', {
        expectedVersion: version,
        amountFils: 2000,
        paidOn: paidOn(),
      }),
    ),
  );
  assert.deepEqual(responses.map((row) => row.status).sort(), [200, 409]);
  const logged = await payments(recipient, id);
  assert.equal(logged.summary.paidFils, 2000);
  const entry = logged.payments.find((item) => item.action === 'paid');
  ok(await act(recipient, id, `payments/${entry.id}/withdraw`));
  assert.equal((await payments(sender, id)).summary.paidFils, 0);
  ok(await act(sender, id, 'complete'));
  ok(await record(recipient, id, 2500));
});

test('co-broking collecting party pays the opposite share, full handovers have no payments', async () => {
  const coTerms = terms({
    money: { ...terms().money, amountFils: 10001, senderShareBp: 3333, collectingParty: 'sender' },
  });
  const id = await accepted(sender, recipient, { kind: 'co_broking', terms: coTerms });
  assert.equal((await payments(sender, id)).summary.dueFils, 6668);
  assert.equal((await payments(sender, id)).summary.payer, 'sender');
  ok(await record(sender, id, 6668));
  const paid = (await payments(recipient, id)).payments.find((item) => item.action === 'paid');
  ok(await act(recipient, id, `payments/${paid.id}/confirm`));
  const full = await accepted(sender, recipient);
  assert.equal((await payments(sender, full)).summary.available, false);
  assert.equal((await record(sender, full, 1)).status, 409);
});
