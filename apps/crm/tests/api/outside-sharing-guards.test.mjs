import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { accepted, listing, outsideTeams, send, stored } from './outside-sharing-helpers.mjs';

// R2a database guards (migrations 0067–0068), a backstop below the Rust checks.
let teams;
before(async () => {
  teams = await outsideTeams('outside-guards');
});

const refused = (sql, pattern, label) => assert.throws(() => query(sql), pattern, label);

test('evidence is insert-only and shares are never deleted', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const where = `WHERE id='${share.id}'`;
  refused(`DELETE FROM agreements.crm_listing_shares ${where}`, /kept as evidence/);
  refused(
    `UPDATE agreements.crm_listing_snapshots SET facts='{}'
    WHERE id=(SELECT snapshot_id FROM agreements.crm_listing_shares ${where})`,
    /insert-only/,
  );
  refused(
    `DELETE FROM agreements.crm_listing_share_events WHERE share_id='${share.id}'`,
    /insert-only/,
  );
  refused(
    `UPDATE agreements.crm_listing_share_events SET reason='x'
    WHERE share_id='${share.id}'`,
    /insert-only/,
  );
});

test('a share is decided once and its identity is frozen', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const where = `WHERE id='${share.id}'`;
  for (const change of [
    `status='pending',accepted_digest=NULL,decided_at=NULL`,
    `note='changed'`,
    `to_id='${teams.colleague.user.id}'`,
    `view_ends_at=view_ends_at-interval '1 day'`,
    `view_ends_at=now()+interval '200 days'`,
    `accepted_digest=repeat('c',64)`,
  ])
    refused(
      `UPDATE agreements.crm_listing_shares SET ${change} ${where}`,
      /decided once|check/i,
      change,
    );
  query(`UPDATE agreements.crm_listing_shares SET status='stopped',closed_at=now() ${where}`);
  refused(
    `UPDATE agreements.crm_listing_shares SET status='ended',end_reason='end_date'
    ${where}`,
    /decided once/,
    'closed shares stay closed',
  );
  assert.equal(stored(share), 'stopped|-');
});

test('a share starts pending between live members of two different companies', async () => {
  const share = await send(teams.one, await listing(teams), teams.agent);
  const copy = (changes) =>
    `INSERT INTO agreements.crm_listing_shares (id,snapshot_id,workspace_id,source_record_id,
      from_id,recipient_workspace_id,to_id,status,created_at,offer_ends_at,view_ends_at)
     SELECT gen_random_uuid(),snapshot_id,workspace_id,source_record_id,from_id,
      ${changes.workspace ?? 'recipient_workspace_id'},${changes.to ?? 'to_id'},
      ${changes.status ?? "'pending'"},now(),now()+interval '336 hours',now()+interval '20 days'
     FROM agreements.crm_listing_shares WHERE id='${share.id}'`;
  const colleague = `'${teams.colleague.user.id}'`;
  refused(copy({ to: colleague, status: "'accepted'" }), /starts pending|check/i, 'accepted');
  refused(copy({ to: `'${teams.two.user.id}'` }), /starts pending/, 'same-company agent');
  refused(
    copy({ workspace: 'workspace_id', to: `'${teams.two.user.id}'` }),
    /check/i,
    'same company',
  );
  refused(
    copy({ to: `'${teams.owner.user.id}'`, workspace: "'super-admin-workspace'" }),
    /starts pending/,
    'the Super Admin',
  );
  query(copy({ to: colleague }));
  refused(copy({ to: colleague }), /duplicate key/, 'one open share per listing and agent');
});
