import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import {
  companyBody,
  events,
  newCompany,
  putCompany,
  readCompany,
  snapshot,
} from './company-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('concurrent company saves have one winner and one stale response with one details event', async () => {
  const { admin } = await newCompany('save-race');
  const results = await Promise.all([
    putCompany(admin, companyBody({ displayName: 'Synthetic First Company' })),
    putCompany(admin, companyBody({ displayName: 'Synthetic Second Company' })),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(results.find((result) => result.status === 409).value.code, 'stale');
  const winner = results.find((result) => result.status === 200).value;
  assert.equal(winner.version, 2);
  assert.deepEqual(await readCompany(admin), winner);
  assert.deepEqual(
    events(admin.user.workspaceId).map((row) => row.action),
    ['created', 'details_updated'],
  );
});

test('a writer authenticated before owner suspension rechecks the live owner after the workspace lock', async () => {
  const { owner, admin } = await newCompany('suspend-race');
  const workspace = admin.user.workspaceId;
  const before = snapshot(workspace);
  const member = await findMember(owner, admin.user.id);
  const release = await holdWorkspaceLock(workspace);
  let writing;
  try {
    writing = putCompany(admin, companyBody());
    await waitForWorkspaceQueue(1);
    const suspended = await owner.request(teamPath(owner, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    });
    assert.equal(suspended.status, 200, JSON.stringify(suspended.value));
  } finally {
    await release();
  }
  assert.equal((await writing).status, 403);
  assert.equal(snapshot(workspace), before);
  assert.equal((await admin.request(`/workspaces/${workspace}/company`)).status, 401);
  assert.equal((await putCompany(admin, companyBody())).status, 401);
});

test('company metadata and events survive archival and already-authenticated queued writes cannot change them', async () => {
  const { owner, admin } = await newCompany('archive-race');
  const workspace = admin.user.workspaceId;
  const first = await putCompany(admin, companyBody());
  assert.equal(first.status, 200);
  const before = snapshot(workspace);
  const member = await findMember(owner, admin.user.id);
  const review = await archiveReview(owner, owner, member);
  const release = await holdWorkspaceLock(workspace);
  let archiving, writing;
  try {
    archiving = archive(owner, owner, review);
    await waitForWorkspaceQueue(1);
    writing = putCompany(
      admin,
      companyBody({ version: 2, displayName: 'Must not survive archive' }),
    );
    await waitForWorkspaceQueue(2);
  } finally {
    await release();
  }
  const removed = await archiving;
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.equal((await writing).status, 403);
  assert.equal(snapshot(workspace), before);
  assert.equal((await putCompany(admin, companyBody({ version: 2 }))).status, 401);
  const directory = await owner.request('/workspaces');
  const row = directory.value.workspaces.find((item) => item.id === workspace);
  assert.equal(row.status, 'archived');
  assert.equal(row.name, 'Synthetic Company');
  assert.equal((await owner.request(`/workspaces/${workspace}/company`)).status, 403);
});

test('a failed company history insert rolls back the details, setup state and version together', async () => {
  const { admin } = await newCompany('rollback');
  const workspace = admin.user.workspaceId;
  const before = snapshot(workspace);
  query(`CREATE FUNCTION kws_company_event_failure() RETURNS trigger AS $$ BEGIN
    IF NEW.workspace_id='${workspace}' AND NEW.action='details_updated' THEN
      RAISE EXCEPTION 'Synthetic company history failure';
    END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER kws_company_event_failure BEFORE INSERT ON crm_company_events
    FOR EACH ROW EXECUTE FUNCTION kws_company_event_failure()`);
  try {
    assert.equal((await putCompany(admin, companyBody())).status, 503);
    assert.equal(snapshot(workspace), before);
  } finally {
    query(`DROP TRIGGER kws_company_event_failure ON crm_company_events;
      DROP FUNCTION kws_company_event_failure()`);
  }
  const retried = await putCompany(admin, companyBody());
  assert.equal(retried.status, 200, JSON.stringify(retried.value));
  assert.equal(retried.value.version, 2);
  assert.deepEqual(
    events(workspace).map((row) => row.action),
    ['created', 'details_updated'],
  );
});
