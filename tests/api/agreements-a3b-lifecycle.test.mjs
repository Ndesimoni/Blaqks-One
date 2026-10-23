import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createAgreement, allowReferrals } from './agreements-helpers.mjs';
import { login, query } from './helpers.mjs';
import {
  accepted,
  act,
  agreementPath,
  command,
  detail,
  ok,
  terms,
} from './agreements-a3b-helpers.mjs';

let sender;
let recipient;
before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  await allowReferrals(sender);
});

test('amendment proposal leaves accepted evidence current until the opposite party accepts it', async () => {
  const id = await accepted(sender, recipient);
  const original = await detail(sender, id);
  ok(await act(sender, id, 'amend', { terms: terms({ notes: 'Synthetic amended terms.' }) }));
  const proposed = await detail(recipient, id);
  assert.equal(proposed.agreement.state, 'accepted');
  assert.equal(proposed.revision.id, original.revision.id);
  assert.equal(proposed.revision.digest, original.revision.digest);
  assert.ok(proposed.proposal.id);
  assert.equal(proposed.proposal.terms.notes, 'Synthetic amended terms.');
  const body = { expectedVersion: proposed.agreement.version, revisionId: proposed.proposal.id };
  assert.equal((await command(sender, id, 'amend/accept', body)).status, 404);
  assert.equal(
    (await command(recipient, id, 'amend/accept', { ...body, expectedVersion: 3 })).status,
    409,
  );
  assert.equal(
    (await command(recipient, id, 'amend/accept', { ...body, revisionId: original.revision.id }))
      .status,
    409,
  );
  ok(await command(recipient, id, 'amend/accept', body));
  const final = await detail(sender, id);
  assert.equal(final.proposal, null);
  assert.equal(final.revision.id, proposed.proposal.id);
  assert.equal(final.revision.digest, proposed.proposal.digest);
  assert.equal(
    query(`SELECT accepted_digest FROM agreements.crm_agreement_actions
    WHERE revision_id='${final.revision.id}' AND action='accepted'`),
    final.revision.digest,
  );
});

test('declining an amendment preserves current terms and cancellation needs both parties', async () => {
  const id = await accepted(sender, recipient);
  const original = await detail(sender, id);
  ok(await act(sender, id, 'cancel'));
  assert.equal((await detail(sender, id)).agreement.state, 'accepted');
  ok(await act(recipient, id, 'amend', { terms: terms({ notes: 'Synthetic proposal.' }) }));
  const proposed = await detail(sender, id);
  assert.equal(proposed.lifecycle.cancellation.sender, false);
  ok(await act(sender, id, 'amend/decline', { revisionId: proposed.proposal.id }));
  assert.equal((await detail(sender, id)).revision.id, original.revision.id);
  ok(await act(recipient, id, 'cancel'));
  assert.equal((await detail(sender, id)).agreement.state, 'accepted');
  ok(await act(sender, id, 'cancel'));
  assert.equal((await detail(sender, id)).agreement.state, 'cancelled');
});

test('completion keeps evidence readable and closes amendments', async () => {
  const id = await accepted(sender, recipient);
  ok(await act(recipient, id, 'complete'));
  assert.equal((await detail(sender, id)).agreement.state, 'completed');
  assert.equal((await act(sender, id, 'amend', { terms: terms() })).status, 409);
});

test('archive hides only that Admin company list and keeps detail evidence', async () => {
  const made = ok(await createAgreement(sender, recipient), 201);
  const id = made.agreement.id;
  ok(await act(sender, id, 'send'));
  ok(await act(sender, id, 'archive'));
  const mine = ok(await sender.request(agreementPath(sender))).agreements;
  const theirs = ok(await recipient.request(agreementPath(recipient))).agreements;
  assert.ok(!mine.some((row) => row.id === id));
  assert.ok(theirs.some((row) => row.id === id));
  assert.equal((await detail(sender, id)).agreement.state, 'sent');
});
