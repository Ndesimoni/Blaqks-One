import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { api, login } from './helpers.mjs';
import { createAgreement } from './agreements-helpers.mjs';
import { accepted, act, agreementPath, ok, terms } from './agreements-a3b-helpers.mjs';

// A3b certificate (docs/agreements-a3b.md): the same stable evidence for both companies,
// digests anyone can recompute from it, a separate display block, never for drafts.
let sender;
let recipient;
before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
});

/** Compact JSON with keys sorted at every level, as the server digests it. */
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const recompute = (agreementId, revision) =>
  sha256(
    canonical({
      agreementId,
      revision: revision.number,
      parentId: revision.parentId,
      terms: revision.terms,
      ...(revision.digestScheme === 2 ? { scheme: 2, author: revision.authorParty } : {}),
    }),
  );

async function certificate(session, id) {
  const response = await fetch(`${api}${agreementPath(session, `/${id}/certificate`)}`, {
    headers: { Cookie: session.cookie },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', /^attachment;/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  return response.json();
}

test('both companies get the same evidence, and every digest can be recomputed', async () => {
  const id = await accepted(sender, recipient);
  const mine = await certificate(sender, id);
  const theirs = await certificate(recipient, id);
  assert.deepEqual(mine.evidence, theirs.evidence, 'one evidence block for both companies');
  const { evidence, display, digestInstructions } = mine;
  assert.equal(evidence.agreement.id, id);
  assert.match(digestInstructions, /SHA-256/);
  assert.ok(evidence.revisions.length >= 1);
  for (const revision of evidence.revisions)
    assert.equal(recompute(id, revision), revision.digest, `revision ${revision.number}`);
  const accept = evidence.actions.find((action) => action.action === 'accepted');
  const current = evidence.revisions.find((r) => r.id === evidence.agreement.currentRevisionId);
  assert.equal(accept.acceptedDigest, current.digest);
  assert.equal(accept.party, 'recipient');
  assert.ok(display.generatedAt && display.agreement.parties.sender.name);
  assert.ok(display.actors.some((actor) => actor.id === accept.actorId));
  const text = JSON.stringify(evidence);
  for (const name of [sender.user.name, recipient.user.name])
    assert.ok(!text.includes(name), `the evidence block names no one (${name})`);
  assert.ok(!text.includes('generatedAt'), 'the evidence block is stable');
});

test('an amendment proposal is offered evidence for both sides', async () => {
  const id = await accepted(sender, recipient);
  const amended = terms({ money: { ...terms().money, amountFils: 64000 } });
  ok(await act(sender, id, 'amend', { terms: amended }));
  const mine = await certificate(sender, id);
  const theirs = await certificate(recipient, id);
  assert.deepEqual(mine.evidence.revisions, theirs.evidence.revisions);
  const proposed = mine.evidence.revisions.find(
    (r) => r.id === mine.evidence.agreement.proposedRevisionId,
  );
  assert.ok(proposed, 'the proposal is listed');
  assert.equal(proposed.terms.money.amountFils, 64000);
  assert.equal(recompute(id, proposed), proposed.digest);
  assert.ok(mine.evidence.events.some((event) => event.action === 'amendment_proposed'));
});

test('a draft has no certificate yet', async () => {
  const created = await createAgreement(sender, recipient);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const response = await sender.request(
    agreementPath(sender, `/${created.value.agreement.id}/certificate`),
  );
  assert.equal(response.status, 409, JSON.stringify(response.value));
});
