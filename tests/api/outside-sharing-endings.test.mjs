import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { assigneeOf, patch, setAssignee, workspacePath } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  accepted,
  evidence,
  listing,
  outsideTeams,
  read,
  send,
  stored,
} from './outside-sharing-helpers.mjs';

// R2a endings (review amendment 2): every change to the listing ends its outside shares in
// the same transaction, and a failure there rolls the change back.
let teams;
before(async () => {
  teams = await outsideTeams('outside-endings');
});

test('a holder change ends the shares, from any writer', async () => {
  const record = await listing(teams);
  const share = await accepted(teams.one, record, teams.agent);
  const pending = await send(teams.one, record, teams.colleague);
  setAssignee(record.id, teams.two.user.id);
  assert.equal(stored(share), 'ended|holder_changed');
  assert.equal(stored(pending), 'ended|holder_changed');
  assert.equal((await read(teams.agent, share)).listing, null);
  const proof = await evidence(teams.one, share);
  assert.equal(proof.evidence.events.at(-1).reason, 'holder_changed');
});

test('a listing marked Sold, Rented or Withdrawn ends its shares', async () => {
  for (const status of ['Sold', 'Rented', 'Withdrawn']) {
    const record = await listing(teams);
    const share = await accepted(teams.one, record, teams.agent);
    const changed = await patch(teams.admin, 'Properties', record, {
      ...record.record,
      listing_status: status,
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.value));
    assert.equal(stored(share), 'ended|listing_closed', status);
  }
});

test('a deleted listing ends its shares; the evidence stays', async () => {
  const record = await listing(teams);
  const share = await send(teams.one, record, teams.agent);
  const removed = await teams.admin.request(workspacePath(teams.admin, 'Properties', record.id), {
    method: 'DELETE',
    body: { version: record.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.equal(stored(share), 'ended|listing_removed');
  const proof = await evidence(teams.one, share);
  assert.equal(proof.evidence.share.status, 'ended');
  assert.ok(proof.evidence.snapshot.facts.listingTitle, 'the snapshot outlives the listing');
});

test('an agent who leaves their company ends the shares they received', async () => {
  const leaver = await activate(
    await invite(teams.other, 'outside-endings-leaver', { positions: ['property-agent'] }),
  );
  const share = await accepted(teams.one, await listing(teams), leaver);
  const member = await findMember(teams.other, leaver.user.id);
  const result = await teams.other.request(teamPath(teams.other, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(stored(share), 'ended|member_left');
});

test('a failed ending rolls the listing change back', async () => {
  const record = await listing(teams);
  const share = await accepted(teams.one, record, teams.agent);
  const name = `outside_fail_${share.id.replaceAll('-', '')}`;
  query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected ending failure'; END; $$;
    CREATE TRIGGER ${name} BEFORE INSERT ON agreements.crm_listing_share_events FOR EACH ROW
    WHEN (NEW.share_id = '${share.id}') EXECUTE FUNCTION ${name}();`);
  try {
    assert.throws(() => setAssignee(record.id, teams.two.user.id), /injected ending failure/);
    assert.equal(assigneeOf(record.id), teams.one.user.id, 'the holder change rolled back');
    const sold = await patch(teams.admin, 'Properties', record, {
      ...record.record,
      listing_status: 'Sold',
    });
    assert.equal(sold.status, 503, JSON.stringify(sold.value));
    const status = query(`SELECT payload->>'listing_status' FROM crm_records
      WHERE id='${record.id}'`);
    assert.equal(status, 'Available', 'the status change rolled back');
    assert.equal(stored(share), 'accepted|-', 'and the share stays as it was');
  } finally {
    query(`DROP TRIGGER ${name} ON agreements.crm_listing_share_events; DROP FUNCTION ${name}();`);
  }
});
