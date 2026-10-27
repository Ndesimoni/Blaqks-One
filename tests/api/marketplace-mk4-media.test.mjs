import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { setAssignee } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { jpegPhoto, jpegWithGps, upload } from './media-helpers.mjs';
import { act, offers, propose, selectedFixture } from './marketplace-mk4-helpers.mjs';
import { fileStatus } from './outside-sharing-helpers.mjs';

let fixture;
let copies;
let originals;
let agreement;

before(async () => {
  fixture = await selectedFixture('mk4-media', async (teams) => {
    const photo = await upload(teams.other, jpegWithGps(), 'private-front.jpg');
    const plan = await upload(teams.other, jpegPhoto(), 'private-plan.jpg');
    assert.equal(photo.status, 201, JSON.stringify(photo.value));
    assert.equal(plan.status, 201, JSON.stringify(plan.value));
    originals = { photo: photo.value.media.id, plan: plan.value.media.id };
    return {
      media_photos: [{ name: 'private-front.jpg', type: 'image/jpeg', file: originals.photo }],
      media_floorplans: [{ name: 'private-plan.jpg', type: 'image/jpeg', file: originals.plan }],
    };
  });
  const media = (kind) =>
    query(
      `SELECT item->>'file' FROM agreements.crm_listing_shares s` +
        ` JOIN agreements.crm_listing_snapshots n ON n.id=s.snapshot_id,` +
        ` jsonb_array_elements(n.media) item WHERE s.id='${fixture.share.id}'` +
        ` AND item->>'kind'='${kind}'`,
    );
  copies = { photo: media('photo'), plan: media('floorPlan') };
});

test('marketplace media stays sealed until the exact agreement is accepted', async () => {
  const { teams, request, share } = fixture;
  for (const file of Object.values(copies)) {
    assert.equal(await fileStatus(teams.one, share, file), 404);
    assert.equal(await fileStatus(teams.admin, share, file), 404);
    assert.equal(await fileStatus(teams.other, share, file), 404);
    assert.equal(await fileStatus(teams.two, share, file), 404);
  }
  const created = await propose(teams.one, request);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  agreement = created.value.agreement;
  assert.equal((await act(teams.one, agreement.id, 'send')).status, 200);
  assert.equal((await act(teams.agent, agreement.id, 'accept')).status, 200);
  const release = (await offers(teams.one, request)).value.answers[0].release;
  assert.equal(release.released, true);
  assert.equal(release.photos[0].file, copies.photo);
  assert.equal(release.floorPlans[0].file, copies.plan);
  assert.notEqual(release.photos[0].file, originals.photo);
  assert.ok(release.contacts.broker.phone && release.contacts.requester.phone);
  for (const file of Object.values(copies)) {
    assert.equal(await fileStatus(teams.one, share, file), 200);
    assert.equal(await fileStatus(teams.agent, share, file), 200);
    assert.equal(await fileStatus(teams.admin, share, file), 404);
    assert.equal(await fileStatus(teams.other, share, file), 404);
  }
  assert.equal(await fileStatus(teams.one, share, originals.photo), 404);
});

test('current authority gates released media while immutable evidence remains', async () => {
  const { teams, request, share, record } = fixture;
  setAssignee(record.id, teams.colleague.user.id);
  const release = (await offers(teams.one, request)).value.answers[0].release;
  assert.notEqual(release?.released, true);
  assert.equal(await fileStatus(teams.one, share, copies.photo), 404);
  assert.equal(await fileStatus(teams.agent, share, copies.photo), 404);
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '1',
  );
  assert.throws(() => query(`UPDATE agreements.crm_market_releases SET broker_id=broker_id`));
});

test('moving the source client revokes the old requester’s released view', async () => {
  const fresh = await selectedFixture('mk4-client-moved');
  const created = await propose(fresh.teams.one, fresh.request);
  const id = created.value.agreement.id;
  assert.equal((await act(fresh.teams.one, id, 'send')).status, 200);
  assert.equal((await act(fresh.teams.agent, id, 'accept')).status, 200);
  assert.equal(
    (await offers(fresh.teams.one, fresh.request)).value.answers[0].release.released,
    true,
  );
  setAssignee(fresh.sourceClient.id, fresh.teams.two.user.id);
  const release = (await offers(fresh.teams.one, fresh.request)).value.answers[0].release;
  assert.notEqual(release?.released, true);
});
