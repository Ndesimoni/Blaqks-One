import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { setAssignee } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { jpegWithGps, upload } from './media-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  accepted,
  act,
  evidence,
  fileStatus,
  listing,
  listingRequest,
  outsideTeams,
  preview,
  read,
  send,
  sendBody,
} from './outside-sharing-helpers.mjs';

// The R2a security review follow-ups (docs/record-sharing.md, "R2a security review").
let teams;
before(async () => {
  teams = await outsideTeams('outside-follow');
});
const photographed = async () => {
  const file = (await upload(teams.admin, jpegWithGps(), 'front.jpg')).value.media.id;
  return listing(teams, 'one', { media_photos: [{ name: 'front.jpg', type: 'image/jpeg', file }] });
};
const sentReason = (share) =>
  query(`SELECT coalesce(reason,'') FROM agreements.crm_listing_share_events
    WHERE share_id='${share.id}' AND action='sent'`);

test('a contact-like note or flagged text needs the tick, which is recorded (L8)', async () => {
  const record = await listing(teams);
  const review = await preview(teams.one, record);
  const note = 'Call me on 050 123 4567';
  const body = (checked) => sendBody(record, teams.agent, review, { note, checked });
  const refused = await listingRequest(teams.one, '', { method: 'POST', body: body(false) });
  assert.equal(refused.status, 400, JSON.stringify(refused.value));
  assert.match(refused.value.message, /checked/);
  const sent = await listingRequest(teams.one, '', { method: 'POST', body: body(true) });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  assert.equal(sentReason(sent.value.share), 'text_checked');
  const located = await listing(teams);
  const links = await preview(teams.one, located, true);
  assert.ok(links.warnings.includes('links'), JSON.stringify(links.warnings));
  const unticked = sendBody(located, teams.agent, links, { exactLocation: true, checked: false });
  assert.equal(
    (await listingRequest(teams.one, '', { method: 'POST', body: unticked })).status,
    400,
  );
  const quiet = await send(teams.one, await listing(teams), teams.agent, { note: 'Hello' });
  assert.equal(sentReason(quiet), '', 'nothing needed checking');
});

test('a company shares one lookup budget among its members (L10)', async () => {
  const key = `agreement-recipients-company:${teams.one.user.workspaceId}`;
  const hash = createHash('sha256').update(key).digest('hex');
  query(`INSERT INTO crm_login_limits (key_hash,attempts,window_seconds) VALUES ('${hash}',60,3600)
    ON CONFLICT (key_hash) DO UPDATE SET attempts=60,window_started=now(),window_seconds=3600`);
  const lookup = await teams.two.request(
    `/workspaces/${teams.two.user.workspaceId}/agreements/recipients`,
    { method: 'POST', body: { email: 'nobody@team-fixture.test' } },
  );
  assert.equal(lookup.status, 429, JSON.stringify(lookup.value));
  assert.match(lookup.value.message, /Your company/);
});

test('whoever shared a listing keeps the record after it moves, never the listing (L7)', async () => {
  const record = await photographed();
  const share = await accepted(teams.one, record, teams.agent);
  const file = share.photos[0].file;
  assert.equal(await fileStatus(teams.one, share, file), 200);
  setAssignee(record.id, teams.two.user.id);
  const kept = await read(teams.one, share);
  assert.deepEqual([kept.viewer, kept.side, kept.status], ['introducer', 'sender', 'ended']);
  assert.deepEqual([kept.listing, kept.recordId, kept.photos], [null, null, []]);
  assert.equal(await fileStatus(teams.one, share, file), 404);
  const proof = (await evidence(teams.one, share)).evidence;
  assert.equal(proof.snapshot.facts, undefined);
  assert.equal(proof.snapshot.locationSalt, undefined);
  assert.ok(proof.snapshot.digest && proof.events.length >= 2);
  const sent = (await listingRequest(teams.one, '?side=sent')).value.shares;
  assert.equal(sent.find((row) => row.id === share.id).viewer, 'introducer');
  const admin = await read(teams.admin, share);
  assert.equal(admin.viewer, 'sender');
  assert.equal(admin.listing.description, 'Bright villa');
});

test('suspending the sending company pauses its shares until it is active again (L6)', async () => {
  const waiting = await send(teams.one, await listing(teams), teams.agent);
  const open = await accepted(teams.one, await photographed(), teams.agent);
  const company = async (active) => {
    const member = await findMember(teams.owner, teams.admin.user.id);
    const body = memberUpdate(member, { active });
    const result = await teams.owner.request(teamPath(teams.owner, member.id), {
      method: 'PATCH',
      body,
    });
    assert.equal(result.status, 200, JSON.stringify(result.value));
  };
  await company(false);
  const paused = await read(teams.agent, open);
  assert.equal(paused.paused, true);
  assert.deepEqual([paused.listing, paused.photos, paused.from.phone], [null, [], null]);
  assert.equal(await fileStatus(teams.agent, open, open.photos[0].file), 404);
  assert.equal((await read(teams.other, open)).listing, null, 'nor for their Admin');
  const blocked = await read(teams.agent, waiting);
  assert.deepEqual([blocked.paused, blocked.allowed.accept, blocked.openedAt], [true, false, null]);
  assert.equal((await act(teams.agent, waiting, 'accept')).status, 409);
  const evidenceFacts = (await evidence(teams.agent, open)).evidence.snapshot.basicFacts;
  assert.equal(evidenceFacts, null);
  await company(true);
  assert.ok((await read(teams.agent, waiting)).openedAt, 'the real first read counts');
  const back = await read(teams.agent, open);
  assert.equal(back.paused, false);
  assert.equal(back.listing.description, 'Bright villa');
});
