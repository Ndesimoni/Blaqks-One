import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  agreementPath as path,
  command,
  createAgreement as create,
  terms,
} from './agreements-helpers.mjs';
import { login, query, request } from './helpers.mjs';

let sender;
let recipient;
let superAdmin;
let id;

before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  superAdmin = await login('owner');
});

test('a draft freezes one sealed revision and stays with the sending company', async () => {
  const response = await create(sender, recipient);
  assert.equal(response.status, 201, JSON.stringify(response.value));
  id = response.value.agreement.id;
  assert.equal(response.value.agreement.state, 'draft');
  assert.equal(response.value.agreement.senderWorkspaceId, sender.user.workspaceId);
  assert.equal(response.value.agreement.recipientMemberId, recipient.user.id);
  const stored = query(
    `SELECT count(*)||'|'||bool_and(digest ~ '^[a-f0-9]{64}$')::text||'|'||
       max(terms->'parties'->'recipient'->>'memberId')
     FROM agreements.crm_agreement_revisions WHERE agreement_id='${id}'`,
  );
  assert.equal(stored, `1|true|${recipient.user.id}`);
  const mine = await sender.request(path(sender));
  assert.ok(mine.value.agreements.some((row) => row.id === id));
  const theirs = await recipient.request(path(recipient));
  assert.ok(!theirs.value.agreements.some((row) => row.id === id));
  assert.equal((await recipient.request(path(recipient, `/${id}`))).status, 404);
  assert.equal((await superAdmin.request(path(superAdmin, `/${id}`))).status, 403);
});

test('send and accept require the named participant and the CSRF token', async () => {
  const noCsrf = await request(path(sender, `/${id}/send`), {
    method: 'POST',
    cookie: sender.cookie,
    body: { expectedVersion: 1 },
  });
  assert.equal(noCsrf.status, 403);
  const draftAccept = await command(recipient, id, 'accept', { expectedVersion: 1 });
  assert.equal(draftAccept.status, 404);
  const senderAccept = await command(sender, id, 'accept', { expectedVersion: 1 });
  assert.equal(senderAccept.status, 404);
  const sent = await command(sender, id, 'send', { expectedVersion: 1 });
  assert.equal(sent.status, 200, JSON.stringify(sent.value));
  assert.deepEqual([sent.value.state, sent.value.version], ['sent', 2]);
  const detail = await recipient.request(path(recipient, `/${id}`));
  assert.equal(detail.status, 200);
  assert.equal(detail.value.party, 'recipient');
  assert.equal(detail.value.revision.terms.money.recipientShareBp, 10000);
  const accepted = await command(recipient, id, 'accept', { expectedVersion: 2 });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.state, 'accepted');
  assert.equal(accepted.value.digest, detail.value.revision.digest);
  const revoke = await command(sender, id, 'revoke', { expectedVersion: 3 });
  assert.equal(revoke.status, 409);
  assert.equal(
    query(
      `SELECT count(*)||'|'||max(verification) FROM agreements.crm_agreement_actions
       WHERE agreement_id='${id}' AND action='accepted'`,
    ),
    '1|member',
  );
});

test('accepted evidence rejects edits, and the database refuses state rollbacks', async () => {
  const edit = await sender.request(path(sender, `/${id}`), {
    method: 'PATCH',
    body: { expectedVersion: 3, terms: terms() },
  });
  assert.equal(edit.status, 409);
  assert.equal(
    query(`SELECT count(*) FROM agreements.crm_agreement_revisions WHERE agreement_id='${id}'`),
    '1',
  );
  assert.throws(() =>
    query(`UPDATE agreements.crm_agreements SET state='revoked',version=version+1
           WHERE id='${id}'`),
  );
});

test('a counter-offer adds a revision and hands acceptance to the sender', async () => {
  const draft = await create(sender, recipient, {
    kind: 'handover_referral',
    terms: terms({
      money: {
        basis: 'commission',
        amountFils: 5250000,
        senderShareBp: 2500,
        paymentExpectation: 'on_transfer',
      },
    }),
  });
  assert.equal(draft.status, 201, JSON.stringify(draft.value));
  const counterId = draft.value.agreement.id;
  assert.equal((await command(sender, counterId, 'send', { expectedVersion: 1 })).status, 200);
  const counterTerms = terms({
    money: {
      basis: 'commission',
      amountFils: 5250000,
      senderShareBp: 1500,
      paymentExpectation: 'on_receipt',
    },
  });
  const counter = await command(recipient, counterId, 'counter', {
    expectedVersion: 2,
    terms: counterTerms,
  });
  assert.equal(counter.status, 200, JSON.stringify(counter.value));
  assert.equal(counter.value.revision.number, 2);
  const recipientAccept = await command(recipient, counterId, 'accept', { expectedVersion: 3 });
  assert.equal(recipientAccept.status, 404);
  const senderAccept = await command(sender, counterId, 'accept', { expectedVersion: 3 });
  assert.equal(senderAccept.status, 200, JSON.stringify(senderAccept.value));
  assert.equal(
    query(
      `SELECT author_party FROM agreements.crm_agreement_revisions
       WHERE agreement_id='${counterId}' AND number=2`,
    ),
    'recipient',
  );
});
