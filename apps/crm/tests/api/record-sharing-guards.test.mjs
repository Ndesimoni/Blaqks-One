import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { workspacePath } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { accepted, act, held, keepCount, offer, shareRequest } from './record-sharing-helpers.mjs';
import { shareState, sharingTeams } from './record-sharing-helpers.mjs';

// R1 code security review fixes (docs/record-sharing.md, "R1 as built").
let teams;
const missing = { code: 'not_found', message: 'Record not found.' };
before(async () => {
  teams = await sharingTeams('share-guards');
});

const client = (name) =>
  held(teams.admin, teams.one, 'Clients', { full_name: `Synthetic ${name}` });
const backdate = (share) =>
  query(`SET session_replication_role = replica; UPDATE crm_record_shares SET
    created_at=now()-interval '15 days', expires_at=now()-interval '15 days'+interval '336 hours'
    WHERE id='${share.id}'`);

test('a second action on an expired share is a 409, not a server error (L1)', async () => {
  const { one, two } = teams;
  const share = await offer(one, await client('Expired Guard'), two);
  backdate(share);
  for (const attempt of ['first', 'second']) {
    const result = await act(two, share, 'accept');
    assert.equal(result.status, 409, `${attempt}: ${JSON.stringify(result.value)}`);
  }
  assert.equal(shareState(share), 'expired|-');
});

test('outsiders get the not-found before any query error (L2)', async () => {
  const { admin, owner, other } = teams;
  for (const session of [owner, other]) {
    for (const path of ['/candidates', '/candidates?collection=Clients', '?unknown=1']) {
      const result = await shareRequest(session, path, {}, admin.user.workspaceId);
      assert.equal(result.status, 404, `${path}: ${JSON.stringify(result.value)}`);
      assert.deepEqual(result.value, missing);
    }
  }
});

test('deleting a record removes its shares and copies; direct changes are refused (L5)', async () => {
  const { admin, one, two } = teams;
  const record = await client('Deleted Guard');
  const share = await accepted(one, record, two);
  assert.equal(keepCount(share), '1');
  assert.throws(() => query(`DELETE FROM crm_record_shares WHERE id='${share.id}'`));
  assert.throws(() =>
    query(`UPDATE crm_record_shares SET status='pending',closed_at=NULL WHERE id='${share.id}'`),
  );
  assert.equal(shareState(share), 'accepted|-');
  const version = Number(query(`SELECT version FROM crm_records WHERE id='${record.id}'`));
  const removed = await admin.request(workspacePath(admin, 'Clients', record.id), {
    method: 'DELETE',
    body: { version },
  });
  assert.ok([200, 204].includes(removed.status), JSON.stringify(removed.value));
  assert.equal(query(`SELECT count(*) FROM crm_record_shares WHERE id='${share.id}'`), '0');
  assert.equal(keepCount(share), '0');
});
