import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { patch } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import {
  ok,
  property,
  publicPath,
  publicRequest,
  publish,
  publishBody,
  put,
  setup,
  websitePath,
} from './website-helpers.mjs';

let t;
before(async () => {
  t = await setup('publication');
});

test('direct publish exposes only public snapshots, processed copies and correct host-scoped profiles', async () => {
  const entry = await property(t.admin);
  const publication = ok(await publish(t.admin, entry, t.profile)).publication;
  assert.equal(publication.state, 'published');
  assert.notEqual(publication.id, entry.id);
  const read = ok(await publicRequest(publicPath(t.platform, `listings/${publication.id}`)));
  for (const secret of [
    entry.id,
    t.admin.user.id,
    'PRIVATE-',
    'kws_crm_session',
    '/api/crm',
    'physical_key',
  ])
    assert.ok(!JSON.stringify(read).includes(secret), secret);
  assert.equal(read.data.advertisingPermit, 'SYNTHETIC-PERMIT');
  assert.equal(read.data.agent, t.profile.id);
  assert.equal(read.data.company, t.a.id);
  assert.equal(read.included.companies.find((c) => c.id === t.a.id).publicAgentCount, 1);
  assert.equal(read.data.photos.length, 1);
  const response = await fetch(
    `${process.env.CRM_TEST_API.replace('/api/crm', '')}${read.data.image}`,
  );
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes('GPS'));
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await publicRequest(publicPath(t.b, `listings/${publication.id}`))).status, 404);
  assert.equal((await publicRequest(`sites/${t.a.id}/home?host=${t.b.host}`)).status, 404);
  assert.equal((await publicRequest('sites/resolve?host=unknown.example')).status, 404);
});

test('real numeric bedroom filters, inclusive budgets and multiple amenities work', async () => {
  const entry = await property(t.admin, {
    bedrooms: 0,
    price_annual_rent_aed: 2400000,
    amenities: 'Swimming pool, Gym',
  });
  const publication = ok(await publish(t.admin, entry, t.profile)).publication;
  const selected = ok(
    await publicRequest(
      publicPath(
        t.a,
        'listings?purpose=buy&minPrice=2400000&maxPrice=2400000&bedrooms=studio&amenities=pool&amenities=gym',
      ),
    ),
  );
  assert.deepEqual(
    selected.data.map((p) => p.id),
    [publication.id],
  );
  const bedrooms = ok(await publicRequest(publicPath(t.a, 'listings?bedrooms=2')));
  assert.ok(bedrooms.data.length && bedrooms.data.every((p) => p.bedrooms === 2));
  const invalid = ok(
    await publicRequest(publicPath(t.a, 'listings?purpose=buy&minPrice=3&maxPrice=1')),
  );
  assert.equal(invalid.data.length, 0);
  assert.ok(invalid.errors.length);
  assert.equal(
    ok(await publicRequest(publicPath(t.a, 'listings?emirate=fujairah'))).pagination.total,
    0,
  );
});

test('private property edits require explicit republish and withdrawal immediately revokes media', async () => {
  let entry = await property(t.admin);
  let published = ok(await publish(t.admin, entry, t.profile)).publication;
  const old = ok(await publicRequest(publicPath(t.a, `listings/${published.id}`))).data;
  entry = ok(
    await patch(t.admin, 'Properties', entry, {
      ...entry.record,
      listing_title: 'New public title',
    }),
  );
  assert.equal(
    ok(await publicRequest(publicPath(t.a, `listings/${published.id}`))).data.title,
    'Public home',
  );
  published = ok(
    await publish(t.admin, entry, t.profile, { version: published.version }),
  ).publication;
  assert.equal(
    ok(await publicRequest(publicPath(t.a, `listings/${published.id}`))).data.title,
    'New public title',
  );
  const result = await t.admin.request(websitePath(t.admin, `/listings/${published.id}/withdraw`), {
    method: 'POST',
    body: { version: published.version },
  });
  ok(result);
  assert.equal((await publicRequest(publicPath(t.a, `listings/${published.id}`))).status, 404);
  const media = await fetch(`${process.env.CRM_TEST_API.replace('/api/crm', '')}${old.image}`);
  assert.equal(media.status, 404);
});

test('listing permissions, source versions, public media selection and trusted eligibility are enforced', async () => {
  const entry = await property(t.admin);
  assert.equal((await publish(t.other, entry, t.profile)).status, 403);
  assert.equal((await publish(t.admin, entry, t.profile, { recordVersion: 999 })).status, 409);
  assert.equal((await publish(t.admin, entry, t.profile, { photos: [] })).status, 400);
  const denied = await put(
    t.admin,
    `/platform/websites/companies/${t.admin.user.workspaceId}/eligibility`,
    { version: t.a.version, entitled: true, licenceVerified: true },
  );
  assert.equal(denied.status, 403);
  const noCsrf = await t.admin.request(websitePath(t.admin, '/listings'), {
    method: 'POST',
    csrf: '',
    body: publishBody(entry, t.profile),
  });
  assert.equal(noCsrf.status, 403);
  assert.equal(
    query(
      `SELECT count(*) FROM publications.crm_website_listings WHERE workspace='${t.admin.user.workspaceId}' AND record='${entry.id}'`,
    ),
    '0',
  );
});
