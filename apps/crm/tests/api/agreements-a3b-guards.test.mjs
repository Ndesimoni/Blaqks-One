import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { newStaff } from './account-helpers.mjs';
import { dealTeams, createDeal, heldClient } from './finance-deals-helpers.mjs';
import { offer } from './agreements-handover-helpers.mjs';
import { login } from './helpers.mjs';
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
let colleague;
let owner;
const payload = (name, revisionId, version) => ({
  expectedVersion: version,
  ...(name === 'amend' ? { terms: terms() } : {}),
  ...(name.startsWith('amend/') ? { revisionId } : {}),
  ...(name === 'payments' ? { amountFils: 1, paidOn: '2026-01-01' } : {}),
});
before(async () => {
  sender = await login('admin-a');
  recipient = await login('admin-b');
  owner = await login('owner');
  colleague = await newStaff(sender, 'a3b-colleague');
});

test('new commands and evidence refuse a nonparticipant, wrong workspace and Super Admin', async () => {
  const id = await accepted(sender, recipient);
  const revisionId = (await detail(sender, id)).revision.id;
  for (const [session, status] of [
    [colleague, 404],
    [owner, 403],
  ]) {
    for (const name of [
      'amend',
      'amend/accept',
      'amend/decline',
      'complete',
      'cancel',
      'archive',
      'payments',
    ]) {
      const answer = await command(session, id, name, payload(name, revisionId, 3));
      assert.equal(answer.status, status, `${name}: ${JSON.stringify(answer.value)}`);
    }
    for (const resource of ['certificate', 'payments']) {
      assert.equal(
        (await session.request(agreementPath(session, `/${id}/${resource}`))).status,
        status,
      );
    }
  }
  const foreign = await recipient.request(agreementPath(sender, `/${id}/certificate`));
  assert.equal(foreign.status, 403);
});

test('in-company evidence can be read but all new agreement mutations keep the Deals origin lock', async () => {
  const { admin, agent, second } = await dealTeams('a3b-origin');
  const handover = await offer(
    admin,
    agent,
    await createDeal(agent, await heldClient(agent)),
    second,
  );
  const id = handover.agreementId;
  const revisionId = (await detail(agent, id)).revision.id;
  for (const name of [
    'amend',
    'amend/accept',
    'amend/decline',
    'complete',
    'cancel',
    'archive',
    'payments',
  ]) {
    const answer = await command(agent, id, name, payload(name, revisionId, 2));
    assert.equal(answer.status, 409, `${name}: ${JSON.stringify(answer.value)}`);
    assert.match(answer.value.message, /Use Deals/);
  }
  ok(await admin.request(agreementPath(admin, `/${id}/certificate`)));
  assert.equal((await act(second, id, 'complete')).status, 409);
});
