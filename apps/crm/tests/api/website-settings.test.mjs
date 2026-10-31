import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { ok, publicPath, publicRequest, put, setup, websitePath } from './website-helpers.mjs';

let t;
before(async () => {
  t = await setup('settings');
});
const current = async () => ok(await t.admin.request(websitePath(t.admin))).site;

test('private drafts do not affect the website until direct publish, with optimistic version checks', async () => {
  const live = await current();
  const body = {
    version: live.version,
    name: live.name,
    theme: '2',
    company: live.company,
    content: { heroTitle: 'Changed public hero', about: 'Changed public story' },
  };
  // Only the public company field input shape is accepted on publish.
  delete body.company.name;
  const saved = ok(await put(t.admin, websitePath(t.admin, '/draft'), { version: 0, site: body }));
  assert.equal(saved.state, 'draft');
  const resolved = ok(await publicRequest(`sites/resolve?host=${t.a.host}`)).data;
  assert.notEqual(resolved.content.heroTitle, 'Changed public hero');
  assert.equal(
    (await put(t.admin, websitePath(t.admin, '/draft'), { version: 0, site: body })).status,
    409,
  );
  const read = ok(await t.admin.request(websitePath(t.admin, '/draft')));
  assert.equal(read.draft.version, saved.draft.version);
  const published = ok(
    await t.admin.request(websitePath(t.admin, '/publish'), {
      method: 'POST',
      body: { version: saved.draft.version },
    }),
  );
  assert.equal(published.state, 'published');
  assert.equal(
    ok(await publicRequest(`sites/resolve?host=${t.a.host}`)).data.content.heroTitle,
    'Changed public hero',
  );
  assert.equal(ok(await t.admin.request(websitePath(t.admin, '/draft'))).draft, null);
});

test('only owning Admin edits company content; personal profile consent cannot be supplied by the Admin', async () => {
  assert.equal((await t.other.request(websitePath(t.admin))).status, 403);
  assert.equal((await t.one.request(websitePath(t.admin, '/draft'))).status, 403);
  const profile = await put(t.admin, websitePath(t.admin, `/profiles/${t.one.user.id}`), {
    version: 0,
    name: 'Agent one',
    specialty: 'Homes',
    active: true,
    consent: true,
  });
  assert.equal(profile.status, 403);
  const live = await current();
  assert.equal(
    (
      await put(t.admin, websitePath(t.admin), {
        version: live.version,
        name: live.name,
        theme: '1',
        host: 'unverified.example',
        content: {},
      })
    ).status,
    400,
  );
  assert.equal((await publicRequest(publicPath(t.a, 'draft'))).status, 404);
});

test('a stale tab cannot overwrite or publish a replacement draft after the original is published', async () => {
  const before = ok(await t.admin.request(websitePath(t.admin, '/draft')));
  const site = await current();
  const content = {
    version: site.version,
    name: site.name,
    theme: '1',
    content: { heroTitle: 'Replacement draft' },
  };
  const next = ok(
    await put(t.admin, websitePath(t.admin, '/draft'), { version: before.version, site: content }),
  ).draft;
  assert.ok(next.version > 1);
  assert.equal(
    (await put(t.admin, websitePath(t.admin, '/draft'), { version: 1, site: content })).status,
    409,
  );
  const stalePublish = await t.admin.request(websitePath(t.admin, '/publish'), {
    method: 'POST',
    body: { version: 1 },
  });
  assert.equal(stalePublish.status, 409);
  assert.equal(
    ok(await t.admin.request(websitePath(t.admin, '/draft'))).draft.version,
    next.version,
  );
});
