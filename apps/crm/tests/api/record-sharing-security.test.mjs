import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { setScope, workspacePath } from './assignment-helpers.mjs';
import {
  accepted,
  candidateIds,
  copy,
  held,
  offer,
  shareRequest,
  sharingTeams,
} from './record-sharing-helpers.mjs';

let teams;
const missing = { code: 'not_found', message: 'Record not found.' };
before(async () => {
  teams = await sharingTeams('share-security');
});

test('non-parties, other companies and the Super Admin get the same not-found shape', async () => {
  const { admin, owner, one, two, third, other } = teams;
  const client = await held(admin, one, 'Clients', {
    client_id: 'SHARE-SECRET',
    full_name: 'Synthetic Secret Person',
  });
  const share = await offer(one, client, two);
  const attempts = [
    shareRequest(third, `/${share.id}`),
    shareRequest(third, `/${share.id}/accept`, { method: 'POST' }),
    shareRequest(other, `/${share.id}`, {}, admin.user.workspaceId),
    shareRequest(owner, `/${share.id}`, {}, admin.user.workspaceId),
    shareRequest(two, `/${randomUUID()}`),
  ];
  for (const result of await Promise.all(attempts)) {
    assert.equal(result.status, 404, JSON.stringify(result.value));
    assert.deepEqual(result.value, missing);
  }
});

test('only holder or Admin sends, and receiver failures use one denial', async () => {
  const { admin, one, two, third, other } = teams;
  const client = await held(admin, one, 'Clients', {
    client_id: 'SHARE-SENDER-RULE',
    full_name: 'Synthetic Sender Rule',
  });
  const manager = await setScope(admin, third, 'team');
  const refused = await shareRequest(manager, '', {
    method: 'POST',
    body: { collection: 'Clients', recordId: client.id, toId: two.user.id },
  });
  assert.equal(refused.status, 403);
  assert.equal(refused.value.message, "Only the record's holder or your Admin can share it.");
  assert.deepEqual(await candidateIds(one, client), [two.user.id]);
  const shapes = new Set();
  for (const toId of [one.user.id, manager.user.id, other.user.id, randomUUID()]) {
    const result = await shareRequest(one, '', {
      method: 'POST',
      body: { collection: 'Clients', recordId: client.id, toId },
    });
    assert.equal(result.status, 403);
    shapes.add(JSON.stringify(result.value));
  }
  assert.deepEqual(
    [...shapes],
    [
      JSON.stringify({
        code: 'forbidden',
        message: "This colleague can't receive this record.",
      }),
    ],
  );
});

test('accepted client copy is redacted, badged and non-writable', async () => {
  const { admin, one, two } = teams;
  await held(admin, one, 'Clients', {
    client_id: 'SHARE-COPY-REF',
    full_name: 'Synthetic Withheld Referrer',
  });
  const client = await held(admin, one, 'Clients', {
    client_id: 'SHARE-COPY',
    full_name: 'Synthetic Copy Person',
    phone: '+971501111111',
    email: 'copy@example.test',
    notes: 'withheld note',
    referred_by_client_id: 'SHARE-COPY-REF',
    record_check: 'withheld check',
    last_contact_auto: 'withheld computed value',
  });
  await accepted(one, client, two);
  const seen = await copy(two, 'Clients', client.id);
  assert.equal(seen.entry.assignee, null);
  assert.equal(seen.entry.record.phone, '+971501111111');
  assert.equal(seen.entry.record.email, 'copy@example.test');
  for (const key of ['notes', 'referred_by_client_id', 'record_check', 'last_contact_auto']) {
    assert.equal(seen.entry.record[key], undefined, key);
  }
  assert.equal(seen.kept.reason, 'colleague');
  assert.deepEqual(
    [seen.kept.dealId, seen.kept.kind, seen.kept.referralShareBp],
    [null, null, null],
  );
  const edit = await two.request(workspacePath(two, 'Clients', client.id), {
    method: 'PATCH',
    body: { version: client.version, record: { client_id: 'SHARE-COPY', notes: 'edit' } },
  });
  assert.equal(edit.status, 404);
  assert.deepEqual(edit.value, missing);
  const child = await two.request(workspacePath(two, 'Viewings'), {
    method: 'POST',
    body: { record: { client_id: 'SHARE-COPY' } },
  });
  assert.equal(child.status, 409, JSON.stringify(child.value));
  assert.equal(child.value.code, 'link_missing');
});
