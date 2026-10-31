import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { allowReferrals } from './agreements-helpers.mjs';
import { accepted, payments, referralTerms } from './agreements-a3b-helpers.mjs';
import { login } from './helpers.mjs';
import { holdPaymentTable, waitForPaymentRead } from './agreements-payment-lock.mjs';

test('payment entries and totals keep the agreement snapshot across a concurrent commit', async () => {
  const sender = await login('admin-a');
  const recipient = await login('admin-b');
  await allowReferrals(sender);
  const id = await accepted(sender, recipient, {
    kind: 'handover_referral',
    terms: referralTerms(10000, 2500),
  });
  const before = await payments(sender, id);
  assert.deepEqual(before.payments, []);
  assert.equal(before.summary.dueFils, 2500);
  assert.equal(before.summary.paidFils, 0);
  const release = await holdPaymentTable();
  const pending = payments(sender, id);
  // Observe rejection immediately too, avoiding an unhandled promise while polling PostgreSQL.
  pending.catch(() => {});
  try {
    await waitForPaymentRead();
    const paymentId = randomUUID();
    await release(`INSERT INTO agreements.crm_agreement_payments
      (id,agreement_id,revision_id,action,amount_fils,paid_on,party,actor_id)
      SELECT '${paymentId}',id,current_revision_id,'paid',1500,
        (clock_timestamp() AT TIME ZONE 'Asia/Dubai')::date,'recipient','${recipient.user.id}'
      FROM agreements.crm_agreements WHERE id='${id}';
      UPDATE agreements.crm_agreements SET version=version+1,updated_at=now() WHERE id='${id}';`);
    assert.deepEqual(
      await pending,
      before,
      'one response must use the snapshot acquired before the payment',
    );
    const after = await payments(sender, id);
    assert.equal(after.payments.length, 1);
    assert.equal(after.payments[0].id, paymentId);
    assert.equal(after.payments[0].actorId, recipient.user.id);
    assert.equal(after.summary.paidFils, after.payments[0].amountFils);
    assert.equal(after.summary.paidFils, 1500);
    assert.equal(after.summary.confirmedFils, 0);
    assert.equal(after.summary.outstandingFils, 1000);
  } finally {
    await release();
    await pending.catch(() => {});
  }
});
