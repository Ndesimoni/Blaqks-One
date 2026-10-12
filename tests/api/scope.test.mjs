import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, recordsPath } from './helpers.mjs';

// Each scenario file starts with a fresh rate-limit window in its isolated test database.
before(() => query('TRUNCATE crm_login_limits'));

test('workspace scope blocks forged paths, record IDs and cross-owner contact links', async () => {
  const adminA = await login();
  const adminB = await login('admin-b');
  const owner = await login('owner');
  const contact = await create(adminB, 'Contacts', {
    contact_id: 'API-B-OWNER',
    full_name: 'Owner B',
  });
  assert.equal((await adminA.request(recordsPath(adminB))).status, 403);
  assert.equal(
    (
      await adminA.request(recordsPath(adminB, 'Clients'), {
        method: 'POST',
        body: { record: { client_id: 'FORGED' } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await adminA.request(recordsPath(adminA, 'Contacts', contact.id), {
        method: 'PATCH',
        body: { record: contact.record, version: 1 },
      })
    ).status,
    404,
  );
  const badLink = await adminA.request(recordsPath(adminA, 'Properties'), {
    method: 'POST',
    body: { record: { property_id: 'API-CROSS', contact_id: 'API-B-OWNER' } },
  });
  assert.equal(badLink.status, 409);
  const own = await adminA.request('/workspaces');
  assert.deepEqual(
    own.value.workspaces.map((entry) => entry.id),
    [adminA.user.id],
  );
  const all = await owner.request('/workspaces');
  assert.ok(all.value.workspaces.some((entry) => entry.id === 'super-admin-workspace'));
  assert.equal((await owner.request(recordsPath(adminB))).status, 200);
  assert.equal((await adminA.request('/workspaces/super-admin-workspace/records')).status, 403);
});

test('linked contacts cannot be deleted or renamed and legacy IDs are scoped', async () => {
  const adminA = await login();
  const adminB = await login('admin-b');
  const contact = await create(adminA, 'Contacts', {
    contact_id: 'API-LINKED',
    full_name: 'Landlord',
  });
  await create(adminB, 'Contacts', { contact_id: 'API-LINKED', full_name: 'Separate landlord' });
  const property = await create(adminA, 'Properties', {
    property_id: 'API-PROPERTY',
    contact_id: 'API-LINKED',
    listing_title: 'Synthetic property',
  });
  const path = recordsPath(adminA, 'Contacts', contact.id);
  assert.equal(
    (await adminA.request(path, { method: 'DELETE', body: { version: 1 } })).status,
    409,
  );
  assert.equal(
    (
      await adminA.request(path, {
        method: 'PATCH',
        body: { record: { ...contact.record, contact_id: 'API-RENAMED' }, version: 1 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await adminA.request(recordsPath(adminA, 'Properties', property.id), {
        method: 'DELETE',
        body: { version: 1 },
      })
    ).status,
    200,
  );
  assert.equal(
    (await adminA.request(path, { method: 'DELETE', body: { version: 1 } })).status,
    200,
  );
});
