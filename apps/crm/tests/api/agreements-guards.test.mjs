import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { newStaff } from './account-helpers.mjs';
import {
  agreementPath as path,
  command,
  createAgreement as create,
  sentAgreement,
  terms,
} from './agreements-helpers.mjs';
import { login, query } from './helpers.mjs';

let sender;
let recipient;
let superAdmin;
let colleague;

before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  superAdmin = await login('owner');
  colleague = await newStaff(sender, 'agreement-colleague');
});

const everyCommand = (session, id, version) => [
  command(session, id, 'send', { expectedVersion: version }),
  command(session, id, 'accept', { expectedVersion: version }),
  command(session, id, 'decline', { expectedVersion: version }),
  command(session, id, 'revoke', { expectedVersion: version }),
  command(session, id, 'counter', { expectedVersion: version, terms: terms() }),
  session.request(path(session, `/${id}`), {
    method: 'PATCH',
    body: { expectedVersion: version, terms: terms() },
  }),
];

test('same-company and Super Admin recipients are refused with a clear 400', async () => {
  const sameCompany = await create(sender, colleague);
  assert.equal(sameCompany.status, 400, JSON.stringify(sameCompany.value));
  assert.match(sameCompany.value.message, /another company/);
  const operator = await create(sender, superAdmin);
  assert.equal(operator.status, 400, JSON.stringify(operator.value));
});

test('non-parties get the same not-found as a missing agreement, in any state', async () => {
  const created = await create(sender, recipient);
  const id = created.value.agreement.id;
  for (const response of await Promise.all(everyCommand(recipient, id, 1))) {
    assert.equal(response.status, 404, JSON.stringify(response.value));
  }
  for (const response of await Promise.all(everyCommand(colleague, id, 1))) {
    assert.equal(response.status, 404, JSON.stringify(response.value));
  }
  assert.equal((await colleague.request(path(colleague, `/${id}`))).status, 404);
  const malformed = await sender.request(path(sender, '/not-an-id'));
  assert.deepEqual([malformed.status, malformed.value?.code], [404, 'not_found']);
  const malformedSend = await command(sender, 'not-an-id', 'send', { expectedVersion: 1 });
  assert.equal(malformedSend.status, 404);
});

test('stale versions are refused and expired agreements cannot be answered or revived', async () => {
  const id = await sentAgreement(sender, recipient);
  const stale = await command(recipient, id, 'accept', { expectedVersion: 3 });
  assert.deepEqual([stale.status, stale.value.code], [409, 'version_conflict']);
  query(`UPDATE agreements.crm_agreements SET expires_at=now()-interval '1 minute',
         version=version+1 WHERE id='${id}'`);
  for (const name of ['accept', 'decline']) {
    const answer = await command(recipient, id, name, { expectedVersion: 3 });
    assert.equal(answer.status, 409, `${name}: ${JSON.stringify(answer.value)}`);
  }
  const revived = await command(recipient, id, 'counter', { expectedVersion: 3, terms: terms() });
  assert.equal(revived.status, 409, JSON.stringify(revived.value));
  assert.equal(
    query(`SELECT count(*) FROM agreements.crm_agreement_revisions WHERE agreement_id='${id}'`),
    '1',
  );
  const revoked = await command(sender, id, 'revoke', { expectedVersion: 3 });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.value));
});

test('a draft whose frozen expiry is under an hour away must be revised before sending', async () => {
  const soon = new Date(Date.now() + 3_600_000 + 2_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const created = await create(sender, recipient, { terms: terms({ expiresAt: soon }) });
  assert.equal(created.status, 201, JSON.stringify(created.value));
  await delay(3_000);
  const id = created.value.agreement.id;
  const sent = await command(sender, id, 'send', { expectedVersion: 1 });
  assert.equal(sent.status, 409, JSON.stringify(sent.value));
  const revised = await sender.request(path(sender, `/${id}`), {
    method: 'PATCH',
    body: { expectedVersion: 1, terms: terms() },
  });
  assert.equal(revised.status, 200, JSON.stringify(revised.value));
  const resent = await command(sender, id, 'send', { expectedVersion: 2 });
  assert.equal(resent.status, 200, JSON.stringify(resent.value));
});
