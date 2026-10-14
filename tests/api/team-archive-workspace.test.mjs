import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, request, recordsPath } from './helpers.mjs';
import { activate, findMember, invite, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('Admin archival freezes the entire team and workspace without losing company records or history', async () => {
  const owner = await login('owner');
  const invited = await invite(owner, 'archive-owner-team', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invited);
  const person = await invite(admin, 'archive-owner-team-staff');
  const staff = await activate(person);
  const pending = await invite(admin, 'archive-owner-team-pending');
  const contact = await create(admin, 'Contacts', {
    contact_id: 'ARCHIVE-CONTACT',
    full_name: 'Retained landlord',
  });
  const property = await create(admin, 'Properties', {
    property_id: 'ARCHIVE-PROPERTY',
    contact_id: 'ARCHIVE-CONTACT',
  });
  const clientResponse = await staff.request(recordsPath(admin, 'Clients'), {
    method: 'POST',
    // Assigned-only staff receive a server-issued ID (assignments contract L1).
    body: { record: { full_name: 'Retained client' } },
  });
  assert.equal(clientResponse.status, 201);
  const client = clientResponse.value;
  const member = await findMember(owner, admin.user.id);
  const review = await archiveReview(owner, owner, member);
  assert.equal(review.teamCount, 2);
  assert.equal(review.recordCount, 3);
  const result = await archive(owner, owner, review);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const directory = await owner.request('/workspaces');
  assert.equal(
    directory.value.workspaces.find((item) => item.id === admin.user.id).status,
    'archived',
  );
  assert.equal((await admin.request('/auth/session')).status, 401);
  assert.equal((await staff.request('/auth/session')).status, 401);
  for (const email of [invited.email, person.email]) {
    assert.equal(
      (await request('/auth/login', { method: 'POST', body: { email, password: 'Team123!' } }))
        .status,
      401,
    );
  }
  const records = await owner.request(recordsPath(admin));
  assert.equal(records.status, 200);
  for (const [collection, entry] of [
    ['Contacts', contact],
    ['Properties', property],
    ['Clients', client],
  ]) {
    assert.deepEqual(records.value.records[collection][0], entry);
    const path = recordsPath(admin, collection, entry.id);
    assert.equal(
      (
        await owner.request(path, {
          method: 'PATCH',
          body: { version: entry.version, record: entry.record },
        })
      ).status,
      403,
    );
    assert.equal(
      (await owner.request(path, { method: 'DELETE', body: { version: entry.version } })).status,
      403,
    );
  }
  assert.equal(
    (
      await owner.request(recordsPath(admin, 'Clients'), {
        method: 'POST',
        body: { record: { client_id: 'NO-ARCHIVE-WRITE' } },
      })
    ).status,
    403,
  );
  assert.equal((await owner.request(`${teamPath(admin)}?archived=true`)).value.members.length, 2);
  assert.equal((await owner.request(teamPath(admin))).value.members.length, 0);
  assert.equal(
    (
      await owner.request(`${teamPath(admin)}/invitations`, {
        method: 'POST',
        body: {
          name: 'Blocked',
          email: 'blocked-archive@test.invalid',
          phone: '+971501234567',
          positions: ['receptionist'],
        },
      })
    ).status,
    403,
  );
  assert.ok(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token: pending.invitation.token, password: 'Team123!' },
      })
    ).status >= 400,
  );
  assert.equal(
    (await owner.request(`/workspaces/${admin.user.id}/activity`)).value.activity.length,
    3,
  );
  assert.equal(
    query(
      `SELECT count(*) FROM crm_users WHERE (id='${admin.user.id}' OR owner_id='${admin.user.id}') AND deleted_at IS NOT NULL AND NOT active`,
    ),
    '3',
  );
  assert.equal(
    query(
      `SELECT count(*) FROM crm_team_activity WHERE workspace_id='${admin.user.id}' AND action='archived'`,
    ),
    '3',
  );
});
