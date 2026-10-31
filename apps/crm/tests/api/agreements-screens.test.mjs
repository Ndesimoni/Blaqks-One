import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { newStaff } from './account-helpers.mjs';
import {
  agreementPath as path,
  command,
  createAgreement as create,
  terms,
} from './agreements-helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { login, request } from './helpers.mjs';

let sender;
let recipient;
let superAdmin;
let colleague;
let outsider;

before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  superAdmin = await login('owner');
  colleague = await newStaff(sender, 'agreement-screens-colleague');
  outsider = (await newCompany('agreement-screens')).admin;
});

const lookup = (session, email) =>
  session.request(path(session, '/recipients'), { method: 'POST', body: { email } });

test('the recipient lookup answers only for an exact email in another company', async () => {
  const found = await lookup(sender, '  ADMIN-B@crm-fixture.test ');
  assert.equal(found.status, 200, JSON.stringify(found.value));
  assert.deepEqual(Object.keys(found.value.recipient).sort(), [
    'company',
    'memberId',
    'name',
    'workspaceId',
  ]);
  assert.equal(found.value.recipient.memberId, recipient.user.id);
  assert.equal(found.value.recipient.workspaceId, recipient.user.workspaceId);
  assert.equal(found.value.recipient.name, 'Fixture Admin B');
  const misses = [colleague.email, 'owner@crm-fixture.test', 'nobody@crm-fixture.test'];
  const answers = await Promise.all(misses.map((email) => lookup(sender, email)));
  for (const answer of answers) {
    assert.deepEqual([answer.status, answer.value.code], [404, 'not_found']);
    assert.equal(answer.value.message, answers[0].value.message);
  }
  assert.equal((await lookup(sender, 'admin-b')).status, 400);
  assert.equal((await lookup(sender, 'admin-b@crm-fixture')).status, 400);
  const partial = await sender.request(path(sender, '/recipients'), {
    method: 'POST',
    body: { email: 'admin-b@crm-fixture.test', name: 'Fixture' },
  });
  assert.equal(partial.status, 400);
  const noCsrf = await request(path(sender, '/recipients'), {
    method: 'POST',
    cookie: sender.cookie,
    body: { email: 'admin-b@crm-fixture.test' },
  });
  assert.equal(noCsrf.status, 403);
  assert.equal((await lookup(superAdmin, 'admin-b@crm-fixture.test')).status, 403);
});

test('lists and reads name both parties and summarise the current revision', async () => {
  const created = await create(sender, recipient, {
    kind: 'co_broking',
    terms: terms({
      money: {
        basis: 'commission',
        amountFils: 5250000,
        senderShareBp: 4000,
        paymentExpectation: 'on_transfer',
      },
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const id = created.value.agreement.id;
  const listed = (await sender.request(path(sender))).value.agreements.find((row) => row.id === id);
  assert.equal(listed.parties.sender.name, 'Fixture Admin A');
  assert.equal(listed.parties.recipient.name, 'Fixture Admin B');
  assert.ok('company' in listed.parties.recipient);
  assert.deepEqual(listed.summary, {
    revision: 1,
    authorParty: 'sender',
    area: 'Dubai Marina',
    listingRef: 'AG-100',
    amountFils: 5250000,
    senderShareBp: 4000,
    recipientShareBp: 6000,
  });
  assert.equal(listed.summary.client, undefined, 'lists never carry client snapshots');
});

test('the receiving company sees offered revisions only, never draft-stage history', async () => {
  const created = await create(sender, recipient, { kind: 'handover_full' });
  const id = created.value.agreement.id;
  const revised = await sender.request(path(sender, `/${id}`), {
    method: 'PATCH',
    body: { expectedVersion: 1, terms: terms({ notes: 'Second draft, synthetic.' }) },
  });
  assert.equal(revised.status, 200, JSON.stringify(revised.value));
  assert.equal((await command(sender, id, 'send', { expectedVersion: 2 })).status, 200);
  const counter = await command(recipient, id, 'counter', {
    expectedVersion: 3,
    terms: terms({ notes: 'Counter-offer, synthetic.' }),
  });
  assert.equal(counter.status, 200, JSON.stringify(counter.value));
  const mine = (await sender.request(path(sender, `/${id}`))).value;
  assert.deepEqual(
    mine.revisions.map((revision) => [revision.number, revision.authorParty]),
    [
      [1, 'sender'],
      [2, 'sender'],
      [3, 'recipient'],
    ],
  );
  assert.deepEqual(
    mine.events.map((event) => event.action),
    ['created', 'revised', 'sent', 'countered'],
  );
  assert.equal(mine.revisions[2].parentNumber, 2);
  assert.match(mine.revisions[0].createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(mine.agreement.parties.recipient.name, 'Fixture Admin B');
  assert.equal(mine.agreement.summary.authorParty, 'recipient');
  const theirs = await recipient.request(path(recipient, `/${id}`));
  assert.equal(theirs.status, 200);
  assert.deepEqual(
    theirs.value.revisions.map((revision) => revision.number),
    [2, 3],
  );
  assert.deepEqual(
    theirs.value.events.map((event) => [event.action, event.party, event.revision]),
    [
      ['sent', 'sender', 2],
      ['countered', 'recipient', 3],
    ],
  );
  assert.ok(theirs.value.events.every((event) => !('actorId' in event)));
  assert.equal(theirs.value.revision.digest, mine.revisions[2].digest);
  assert.equal((await outsider.request(path(outsider, `/${id}`))).status, 404);
  const outsiderList = await outsider.request(path(outsider));
  assert.ok(!outsiderList.value.agreements.some((row) => row.id === id));
  assert.equal((await colleague.request(path(colleague, `/${id}`))).status, 404);
});
