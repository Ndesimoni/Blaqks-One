import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import {
  activityCount,
  commit,
  emptyRecords,
  planned,
  preview,
  recordCount,
} from './import-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('archived companies reject pending import commits and replay without changing records or audit', async () => {
  const owner = await login('owner');
  const invitation = await invite(owner, 'archive-import-owner', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invitation);
  const successful = await planned(admin, admin.user.id, {
    ...emptyRecords(),
    Clients: [{ client_id: 'ARCHIVE-IMPORTED' }],
  });
  assert.equal((await commit(admin, admin.user.id, successful.token)).status, 200);
  const pending = await planned(admin, admin.user.id, {
    ...emptyRecords(),
    Clients: [{ client_id: 'ARCHIVE-PENDING-IMPORT' }],
  });
  const review = await archiveReview(owner, owner, await findMember(owner, admin.user.id));
  assert.equal((await archive(owner, owner, review)).status, 200);
  const historyCount = activityCount(admin.user.id);
  // The archive signed the Admin out; Blaqks One never imports into a company (BO1a).
  assert.equal((await commit(admin, admin.user.id, pending.token)).status, 401);
  assert.equal((await commit(owner, admin.user.id, pending.token)).status, 403);
  assert.equal((await commit(owner, admin.user.id, successful.token)).status, 403);
  assert.equal((await preview(owner, admin.user.id, emptyRecords())).status, 403);
  assert.equal(recordCount(admin.user.id, 'ARCHIVE-PENDING-IMPORT'), 0);
  assert.equal(recordCount(admin.user.id, 'ARCHIVE-IMPORTED'), 1);
  assert.equal(activityCount(admin.user.id), historyCount);
  assert.equal(
    query(`SELECT count(*) FROM crm_import_plans WHERE workspace_id='${admin.user.id}'`),
    '2',
  );
});
