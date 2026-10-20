import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { channelPath as path, connect, connection } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';

let admin;
let id;

before(async () => {
  admin = await login('admin-b');
  const response = await connect(admin, {
    label: 'Lifecycle line',
    externalAccountId: '+971500000099',
  });
  assert.equal(response.status, 201, JSON.stringify(response.value));
  id = response.value.connection.id;
});

test('reconnect needs the current version and re-seals the credential', async () => {
  const stale = await admin.request(path(admin, `/${id}/reconnect`), {
    method: 'POST',
    body: { expectedVersion: 99, credential: 'new-synthetic-secret' },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'version_conflict');
  const renewed = await admin.request(path(admin, `/${id}/reconnect`), {
    method: 'POST',
    body: { expectedVersion: 1, credential: 'new-synthetic-secret' },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.connection.version, 2);
  assert.equal(renewed.value.connection.state, 'connected');
  const sealed = query(
    `SELECT bool_and(position('new-synthetic-secret' IN encode(credential_sealed,'escape'))=0)::text
     FROM integrations.crm_channel_connections WHERE id='${id}'`,
  );
  assert.equal(sealed, 'true');
});

test('disconnect is idempotent, clears the credential and keeps history', async () => {
  const first = await admin.request(path(admin, `/${id}`), {
    method: 'DELETE',
    body: { expectedVersion: 2 },
  });
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.equal(first.value.connection.state, 'disconnected');
  assert.equal(first.value.connection.health, 'off');
  assert.equal(first.value.connection.version, 3);
  const second = await admin.request(path(admin, `/${id}`), {
    method: 'DELETE',
    body: { expectedVersion: 3 },
  });
  assert.equal(second.status, 200);
  assert.equal(second.value.connection.version, 3);
  const stored = query(
    `SELECT (credential_sealed IS NULL)::text||'|'||
       (SELECT count(*) FROM integrations.crm_integration_events
        WHERE connection_id='${id}' AND action='disconnected')
     FROM integrations.crm_channel_connections WHERE id='${id}'`,
  );
  assert.equal(stored, 'true|1');
  const after = await admin.request(path(admin, `/${id}/reconnect`), {
    method: 'POST',
    body: { expectedVersion: 3, credential: 'synthetic-secret' },
  });
  assert.equal(after.status, 404);
});

test('a disconnected account can be connected again by any company', async () => {
  const again = await connect(admin, {
    label: 'Lifecycle line',
    externalAccountId: '+971500000099',
  });
  assert.equal(again.status, 201, JSON.stringify(again.value));
  assert.notEqual(again.value.connection.id, id);
  const page = { channel: 'facebook', provider: 'meta', externalAccountId: 'page-synthetic-0042' };
  const first = await connect(admin, { ...page, label: 'Synthetic page' });
  assert.equal(first.status, 201, JSON.stringify(first.value));
  const other = await login('admin-a');
  assert.equal((await connect(other, { ...page, label: 'Synthetic page' })).status, 409);
  const released = await admin.request(path(admin, `/${first.value.connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: 1 },
  });
  assert.equal(released.status, 200);
  const taken = await connect(other, { ...page, label: 'Synthetic page' });
  assert.equal(taken.status, 201, JSON.stringify(taken.value));
});

test('credentials are sealed exactly as typed, never trimmed', async () => {
  const padded = await connect(admin, {
    channel: 'instagram',
    provider: 'meta',
    externalAccountId: 'ig-synthetic-0007',
    credential: ' synthetic-credential ',
  });
  assert.equal(padded.status, 400);
  assert.ok(!JSON.stringify(padded.value).includes('synthetic-credential'));
});

test('malformed payloads are refused without echoing values', async () => {
  const unknown = await admin.request(path(admin), {
    method: 'POST',
    body: { connection: { ...connection(), extra: 'value' } },
  });
  assert.equal(unknown.status, 400);
  assert.ok(!JSON.stringify(unknown.value).includes('synthetic-credential'));
  const badChannel = await connect(admin, { channel: 'telegram', externalAccountId: '+9715' });
  assert.equal(badChannel.status, 400);
  const unsafe = await connect(admin, { externalAccountId: 'bad value' });
  assert.equal(unsafe.status, 400);
});
