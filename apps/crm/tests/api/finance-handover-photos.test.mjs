import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { api } from './helpers.mjs';
import { jpegWithGps, pdf, upload } from './media-helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';
import { accept, offered, preview, reviewTeams } from './finance-handover-helpers.mjs';

// H3 (agreements design §18, amendment 8): the review shows the listing's own stored
// photos and floor plans to the people who may review the hand-over, and the sender keeps
// seeing them once the property has moved.
let teams;
before(async () => {
  teams = await reviewTeams('h3-photo');
});

const make = async (session, collection, record) => {
  const made = await session.request(
    `/workspaces/${session.user.workspaceId}/records/${collection}`,
    {
      method: 'POST',
      body: { record },
    },
  );
  assert.equal(made.status, 201, JSON.stringify(made.value));
  return made.value;
};
const stored = async (session, name, bytes = jpegWithGps()) =>
  (await upload(session, bytes, name)).value.media.id;
const status = async (session, path) =>
  (
    await fetch(`${api}/workspaces/${teams.admin.user.workspaceId}${path}`, {
      headers: { Cookie: session.cookie },
    })
  ).status;

test('review photos are served only to reviewers and only from the listing', async () => {
  const { admin, agent, second, viewer, owner } = teams;
  const [photo, plan, loose] = [
    await stored(agent, 'front.jpg'),
    await stored(agent, 'plan.pdf', pdf()),
    await stored(agent, 'not-attached.jpg'),
  ];
  const property = await make(agent, 'Properties', {
    listing_title: 'Synthetic photo villa',
    viewing_instructions: 'Zqx owner gate code 4411',
    photos_documents_url: 'https://docs.example.test/zqx-deeds',
    media_photos: [{ name: 'front.jpg', type: 'image/jpeg', file: photo }],
    media_floorplans: [{ name: 'plan.pdf', type: 'application/pdf', file: plan }],
  });
  const propertyId = property.record.property_id;
  const deal = await createDeal(agent, await heldClient(agent), { propertyId });
  const handover = await offered(admin, agent, deal, second);
  const shown = await preview(second, admin, handover.id);
  assert.equal(shown.status, 200, JSON.stringify(shown.value));
  const { photos, floorPlans } = shown.value.property;
  assert.deepEqual(photos, [{ name: 'front.jpg', file: photo, thumb: null }]);
  assert.deepEqual(floorPlans, [{ name: 'plan.pdf', file: plan, thumb: null }]);
  assert.doesNotMatch(JSON.stringify(shown.value), /zqx|4411/i, 'no instructions or deeds');
  const file = (id) => `/finance/handovers/${handover.id}/preview/files/${id}`;
  assert.equal(await status(second, file(photo)), 200);
  assert.equal(await status(second, file(plan)), 200);
  assert.equal(await status(admin, file(photo)), 200);
  assert.equal(await status(second, file(loose)), 404, 'only files the listing names');
  for (const session of [viewer, agent]) {
    assert.equal(await status(session, file(photo)), 404, 'only reviewers');
  }
  assert.ok([403, 404].includes(await status(owner, file(photo))), 'not the Super Admin');
  assert.equal((await accept(second, admin, handover)).status, 200);
  assert.equal(await status(second, file(photo)), 404, 'the review ends with the decision');
  const own = `/records/Properties/${property.id}/files/${photo}`;
  assert.equal(await status(second, own), 200, 'the receiver holds the listing now');
  assert.equal(await status(agent, own), 200, 'the sender keeps seeing its photos');
});
