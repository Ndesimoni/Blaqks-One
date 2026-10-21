import assert from 'node:assert/strict';
import test from 'node:test';
import { archive, archiveReview } from './archive-helpers.mjs';
import { connect } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';
import { connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';
import { findMember } from './team-helpers.mjs';

// Owner decision 2026-10-21 (SendGrid code review L2): archiving an Admin freezes the
// company for good, so its channels are disconnected in the same transaction.
test('archiving an Admin disconnects every company channel and releases its accounts', async () => {
  const admin = await freshAdmin('channels-archive-admin');
  const workspace = admin.user.workspaceId;
  const domain = 'archive-release.example.test';
  const number = '+971500004545';
  assert.equal((await connectSendgrid(admin, domain)).status, 201);
  const line = await connect(admin, { externalAccountId: number });
  assert.equal(line.status, 201, JSON.stringify(line.value));
  const owner = await login('owner');
  const review = await archiveReview(owner, owner, await findMember(owner, admin.user.id));
  const archived = await archive(owner, owner, review);
  assert.equal(archived.status, 200, JSON.stringify(archived.value));
  const live = query(
    `SELECT count(*) FROM integrations.crm_channel_connections
     WHERE workspace_id='${workspace}' AND (state<>'disconnected' OR credential_sealed IS NOT NULL)`,
  );
  assert.equal(live, '0', 'no live connection or stored key remains');
  const history = query(
    `SELECT count(*) FROM integrations.crm_integration_events
     WHERE workspace_id='${workspace}' AND action='disconnected' AND actor_id='${owner.user.id}'`,
  );
  assert.equal(history, '2', 'each disconnect is recorded with the Super Admin as actor');
  // The domain and the number are free for the company that really owns them.
  const next = await freshAdmin('channels-archive-next');
  assert.equal((await connectSendgrid(next, domain)).status, 201);
  const again = await connect(next, { externalAccountId: number });
  assert.equal(again.status, 201, JSON.stringify(again.value));
});
