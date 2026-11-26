import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { patch } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { jpegWithGps, upload } from './media-helpers.mjs';
import {
  accepted,
  act,
  canonical,
  dubaiDay,
  evidence,
  fileStatus,
  listing,
  outsideTeams,
  send,
  sha256,
} from './outside-sharing-helpers.mjs';

// The R2a security review fixes (docs/record-sharing.md, "R2a security review").
let teams;
before(async () => {
  teams = await outsideTeams('outside-review');
});

test('the other company keeps no listing facts in the evidence once a share closes', async () => {
  const stopped = await accepted(teams.one, await listing(teams), teams.agent);
  assert.equal((await act(teams.one, stopped, 'stop')).status, 200);
  const withdrawn = await send(teams.one, await listing(teams), teams.agent);
  assert.equal((await act(teams.one, withdrawn, 'withdraw')).status, 200);
  for (const share of [stopped, withdrawn]) {
    for (const reader of [teams.agent, teams.other]) {
      const { snapshot } = (await evidence(reader, share)).evidence;
      assert.equal(snapshot.basicFacts, null, `${share.status} for ${reader.user.email}`);
      assert.ok(snapshot.digest, 'the digest still proves what was introduced');
    }
    const own = (await evidence(teams.one, share)).evidence.snapshot;
    assert.ok(own.facts.listingTitle, 'the sender keeps the whole snapshot');
  }
});

test('the acceptance digest can still be recomputed after an extension', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent, { note: 'Hi' });
  const later = await act(teams.one, share, 'extend', { viewEndsOn: dubaiDay(60) });
  assert.equal(later.status, 200, JSON.stringify(later.value));
  const { share: row, snapshot } = (await evidence(teams.agent, share)).evidence;
  assert.notEqual(row.viewEndsAt, row.acceptedViewEndsAt, 'the share was extended');
  const digest = sha256(
    canonical({
      scheme: 1,
      shareId: row.id,
      snapshotDigest: snapshot.digest,
      sender: row.sender,
      recipient: row.recipient,
      sentAt: row.sentAt,
      viewEndsAt: row.acceptedViewEndsAt,
      note: row.note,
    }),
  );
  assert.equal(row.acceptedDigest, digest);
});

test('a changed listing shared again copies only its new photos', async () => {
  const id = async (name) => (await upload(teams.admin, jpegWithGps(), name)).value.media.id;
  const [front, garden] = [await id('owner-front.jpg'), await id('owner-garden.jpg')];
  const photo = (name, file) => ({ name, type: 'image/jpeg', file });
  const record = await listing(teams, 'one', {
    media_photos: [photo('owner-front.jpg', front)],
  });
  const first = await accepted(teams.one, record, teams.agent);
  const changed = await patch(teams.admin, 'Properties', record, {
    ...record.record,
    property_description: 'Bright villa, new garden',
    media_photos: [photo('owner-front.jpg', front), photo('owner-garden.jpg', garden)],
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  const second = await accepted(teams.one, record, teams.colleague);
  assert.notEqual(first.reference, second.reference, 'a new snapshot');
  const copies = (file) =>
    query(`SELECT count(*) FROM media.crm_media_objects
      WHERE origin='copy' AND copied_from='${file}' AND deleted_at IS NULL`);
  assert.equal(copies(front), '1', 'the unchanged photo reuses its copy');
  assert.equal(copies(garden), '1');
  assert.equal(second.photos[0].file, first.photos[0].file);
  for (const file of second.photos.map((entry) => entry.file)) {
    assert.equal(await fileStatus(teams.colleague, second, file), 200);
  }
  assert.equal(await fileStatus(teams.agent, first, second.photos[1].file), 404);
});
