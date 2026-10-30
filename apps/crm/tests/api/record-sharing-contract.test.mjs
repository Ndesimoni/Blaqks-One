import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  act,
  accepted,
  candidateIds,
  held,
  offer,
  shares,
  shareRequest,
  sharingTeams,
} from './record-sharing-helpers.mjs';

let teams;
before(async () => {
  teams = await sharingTeams('share-contract');
});

test('holder creates an offer exposed by candidates, inbox, detail and waiting count', async () => {
  const { admin, one, two, third } = teams;
  const client = await held(admin, one, 'Clients', {
    client_id: 'SHARE-CONTRACT-CLIENT',
    full_name: 'Synthetic Chandra Example',
  });
  assert.deepEqual((await candidateIds(one, client)).sort(), [third.user.id, two.user.id].sort());
  const share = await offer(one, client, two);
  assert.equal(share.collection, 'Clients');
  assert.equal(share.label, 'Synthetic E.');
  assert.deepEqual(share.allowed, {
    accept: false,
    decline: false,
    withdraw: true,
    stop: false,
  });
  assert.equal((await shares(one)).outgoing[0].id, share.id);
  assert.equal((await shares(two)).incoming[0].id, share.id);
  assert.deepEqual((await shareRequest(two, '/waiting')).value, {
    Clients: 1,
    Properties: 0,
    Contacts: 0,
  });
  const detail = await shareRequest(two, `/${share.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.value.share.allowed.accept, true);
  assert.equal(detail.value.share.recordId, undefined);
  assert.equal((await shares(one, `?recordId=${client.id}`)).outgoing.length, 1);
});

test('receiver can decline, sender can withdraw, and holder or Admin can stop', async () => {
  const { admin, one, two } = teams;
  const records = [];
  for (const suffix of ['DECLINE', 'WITHDRAW', 'STOP-HOLDER', 'STOP-ADMIN']) {
    records.push(
      await held(admin, one, 'Clients', {
        client_id: `SHARE-${suffix}`,
        full_name: `Synthetic ${suffix}`,
      }),
    );
  }
  const declined = await offer(one, records[0], two);
  assert.equal((await act(two, declined, 'decline')).value.share.status, 'declined');
  const withdrawn = await offer(one, records[1], two);
  assert.equal((await act(one, withdrawn, 'withdraw')).value.share.status, 'withdrawn');
  const stoppedByHolder = await accepted(admin, records[2], two);
  assert.equal((await act(one, stoppedByHolder, 'stop')).value.share.status, 'stopped');
  const stoppedByAdmin = await accepted(one, records[3], two);
  assert.equal((await act(admin, stoppedByAdmin, 'stop')).value.share.status, 'stopped');
  for (const closed of [declined, withdrawn, stoppedByHolder, stoppedByAdmin]) {
    const detail = await shareRequest(admin, `/${closed.id}`);
    assert.equal(detail.value.share.label, null);
  }
});
