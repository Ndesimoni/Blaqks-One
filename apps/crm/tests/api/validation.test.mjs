import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, recordsPath, request } from './helpers.mjs';

// Each scenario file starts with a fresh rate-limit window in its isolated test database.
before(() => query('TRUNCATE crm_login_limits'));

test('writes require origin and CSRF and refuse client-supplied ownership', async () => {
  const session = await login();
  const path = recordsPath(session, 'Clients');
  const body = { record: { client_id: 'API-VALIDATION' } };
  assert.equal(
    (await session.request(path, { method: 'POST', body, csrf: undefined })).status,
    403,
  );
  assert.equal(
    (
      await session.request(path, {
        method: 'POST',
        body,
        headers: { Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  for (const field of ['workspace_id', 'owner_id', 'actor_id', 'approved_by', 'published']) {
    assert.equal(
      (
        await session.request(path, {
          method: 'POST',
          body: { record: { ...body.record, [field]: session.user.id } },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await session.request(path, {
        method: 'POST',
        body: { ...body, workspace_id: session.user.id },
      })
    ).status,
    400,
  );
});

test('invalid shapes, amounts and media cannot enter records', async () => {
  const session = await login();
  for (const record of [
    [],
    null,
    { client_id: 7 },
    { client_id: 'API-BAD', full_name: {} },
    { client_id: 'API-BAD', maximum_budget_aed: -1 },
    { client_id: 'API-BAD', minimum_budget_aed: 200, maximum_budget_aed: 100 },
  ]) {
    assert.equal(
      (
        await session.request(recordsPath(session, 'Clients'), {
          method: 'POST',
          body: { record },
        })
      ).status,
      400,
    );
  }
  for (const record of [
    { property_id: 'API-BAD', listing_title: {} },
    { property_id: 'API-BAD', media_photos: 'invalid' },
    { property_id: 'API-BAD', media_photos: [{ src: 'javascript:alert(1)' }] },
    { property_id: 'API-BAD', media_photos: [{ src: 'data:image/svg+xml;base64,PHN2Zz4=' }] },
  ]) {
    assert.equal(
      (
        await session.request(recordsPath(session, 'Properties'), {
          method: 'POST',
          body: { record },
        })
      ).status,
      400,
    );
  }
  // A missing or blank ID on create is issued by the server (assignments contract L1).
  for (const record of [{}, { client_id: ' ' }]) {
    const issued = await create(session, 'Clients', record);
    assert.match(issued.record.client_id, /^CL-\d{3,9}$/);
  }
  assert.equal(
    (
      await session.request(recordsPath(session, 'Unsupported'), {
        method: 'POST',
        body: { record: { client_id: 'API-NO' } },
      })
    ).status,
    400,
  );
});

test('simultaneous edits allow one winner and keep the other from overwriting it', async () => {
  const session = await login();
  const record = await create(session, 'Clients', { client_id: 'API-RACE', full_name: 'Original' });
  const results = await Promise.all(
    ['First edit', 'Second edit'].map((name) =>
      session.request(recordsPath(session, 'Clients', record.id), {
        method: 'PATCH',
        body: { version: 1, record: { ...record.record, full_name: name } },
      }),
    ),
  );
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
  const winner = results.find((response) => response.status === 200).value;
  const list = await session.request(recordsPath(session));
  assert.deepEqual(
    list.value.records.Clients.find((row) => row.id === record.id),
    winner,
  );
});

test('repeated failed login attempts are limited before expensive authentication', async () => {
  let last;
  for (let attempt = 0; attempt < 11; attempt++) {
    last = await request('/auth/login', {
      method: 'POST',
      body: { email: 'limited@crm-fixture.test', password: 'invalid-password' },
    });
  }
  assert.equal(last.status, 429);
});
